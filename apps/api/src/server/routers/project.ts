import { z } from "zod";
import { createTRPCRouter, publicProcedure, protectedProcedure } from "../trpc";
import { TRPCError } from "@trpc/server";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const ALLOWED_EXTENSIONS = [
  ".py", ".js", ".ts", ".java", ".md", ".cpp", ".c", ".html", ".css", ".json", ".txt", ".sql"
];

const BANNED_EXTENSIONS = [".exe", ".bat", ".sh", ".cmd", ".msi", ".vbs"];

export const submitProjectSchema = z.object({
  competitionId: z.string().cuid("ID de competencia inválido"),
  title: z
    .string()
    .min(1, "El título no puede estar vacío")
    .max(120, "El título no puede superar los 120 caracteres"),
  description: z
    .string()
    .min(200, "La descripción debe tener al menos 200 caracteres"),
  deliverableType: z.string().refine((val) => ["link", "zip", "archivo"].includes(val), {
    message: "Formato de entregable inválido",
  }),
  deliverableContent: z.string().min(1, "El contenido del entregable es requerido"),
}).superRefine((data, ctx) => {
  const { deliverableType, deliverableContent } = data;

  if (deliverableType === "link") {
    try {
      const url = new URL(deliverableContent);
      if (url.protocol !== "http:" && url.protocol !== "https:") {
        throw new Error();
      }
    } catch {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "El enlace proporcionado no es una URL válida (requiere http/https)",
        path: ["deliverableContent"],
      });
    }
  }

  if (deliverableType === "zip") {
    if (!deliverableContent.toLowerCase().endsWith(".zip")) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "El archivo debe tener extensión .zip",
        path: ["deliverableContent"],
      });
    }
  }

  if (deliverableType === "archivo") {
    const fileName = deliverableContent.toLowerCase();
    const hasAllowedExt = ALLOWED_EXTENSIONS.some(ext => fileName.endsWith(ext));
    const hasBannedExt = BANNED_EXTENSIONS.some(ext => fileName.endsWith(ext));

    if (hasBannedExt || !hasAllowedExt) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Extensión de archivo no permitida. Sube un archivo de código válido (ej: .js, .py, .java).",
        path: ["deliverableContent"],
      });
    }
  }
});

const s3Client = new S3Client({
  region: process.env.AWS_REGION!,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});


export const projectRouter = createTRPCRouter({
  byId: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const project = await ctx.prisma.project.findUnique({
        where: { id: input.id },
        include: {
          author: {
            select: { id: true, username: true },
          },
          competition: {
            select: {
              id: true,
              title: true,
              status: true,
              metrics: true,
              participants: {
                select: { userId: true, role: true },
              },
            },
          },
          votes: true,
        },
      });

      if (!project) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Proyecto no encontrado",
        });
      }

      return project;
    }),

  disqualify: publicProcedure
    .input(
      z.object({
        projectId: z.string().min(1),
        reason: z
          .string()
          .trim()
          .min(5, "Debes proporcionar un motivo para la descalificación (mínimo 5 caracteres)."),
        userId: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const currentUserId = ctx.session?.user?.id ?? input.userId;
      if (!currentUserId) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Debes iniciar sesión para descalificar un proyecto.",
        });
      }

      const project = await ctx.prisma.project.findUnique({
        where: { id: input.projectId },
        include: {
          competition: {
            include: {
              participants: true,
            },
          },
          author: {
            select: { id: true, username: true },
          },
        },
      });

      if (!project) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Proyecto no encontrado.",
        });
      }

      const callerParticipant = project.competition.participants.find(
        (p) => p.userId === currentUserId
      );

      const isHost = callerParticipant?.role === "HOST";
      const isMod = callerParticipant?.role === "MOD";

      if (!isHost && !isMod) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Solo el anfitrión o un moderador de la competencia pueden descalificar proyectos.",
        });
      }

      if (project.isDisqualified) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Este proyecto ya se encuentra descalificado.",
        });
      }

      const roleLabel = isHost ? "el anfitrión" : "un moderador";

      const [updatedProject] = await ctx.prisma.$transaction([
        ctx.prisma.project.update({
          where: { id: project.id },
          data: {
            isDisqualified: true,
            disqualificationReason: input.reason,
          },
        }),
        ctx.prisma.notification.create({
          data: {
            userId: project.authorId,
            content: `Tu proyecto "${project.title}" en la competencia "${project.competition.title}" ha sido descalificado por ${roleLabel}. Motivo: "${input.reason}".`,
            type: "DISQUALIFICATION",
          },
        }),
      ]);

      return {
        success: true,
        message: `El proyecto "${project.title}" ha sido descalificado exitosamente.`,
        project: updatedProject,
      };
    }),

  submitToCompetition: protectedProcedure
    .input(submitProjectSchema)
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;

      const competition = await ctx.prisma.competition.findUnique({
        where: { id: input.competitionId },
        select: {
          id: true,
          status: true,
          submissionDeadline: true,
          fileFormat: true,
        },
      });

      if (!competition) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "La competencia no existe.",
        });
      }

      if (competition.status !== "ACTIVE") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: `La competencia no acepta proyectos (Estado actual: ${competition.status}).`,
        });
      }

      if (new Date() > competition.submissionDeadline) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "La fecha límite de recepción de proyectos ya ha pasado.",
        });
      }

      const allowedFormats = (competition.fileFormat || "").toLowerCase();
      if (!allowedFormats.includes(input.deliverableType)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `La competencia no acepta el formato: ${input.deliverableType}`,
        });
      }

      const existingParticipant = await ctx.prisma.competitionParticipant.findUnique({
        where: {
          userId_competitionId: {
            userId,
            competitionId: input.competitionId,
          },
        },
      });

      if (existingParticipant?.role === "HOST") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "El host de la competencia no puede participar como dev en la misma competencia.",
        });
      }

      if (existingParticipant?.role === "MOD") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Un moderador de la competencia no puede participar como dev en la misma competencia.",
        });
      }

      const existingSubmission = await ctx.prisma.project.findFirst({
        where: {
          competitionId: input.competitionId,
          authorId: userId,
        },
      });

      if (existingSubmission || existingParticipant?.role === "DEV") {
        throw new TRPCError({
          code: "CONFLICT",
          message: "Ya has enviado un proyecto o participas como dev en esta competencia.",
        });
      }

      let presignedUrl: string | null = null;
      let s3FileKey: string | null = null;

      if (input.deliverableType === "zip" || input.deliverableType === "archivo") {
        const safeFileName = input.deliverableContent.replace(/[^a-zA-Z0-9.-]/g, "_");
        s3FileKey = `competitions/${input.competitionId}/projects/${userId}_${Date.now()}_${safeFileName}`;

        const command = new PutObjectCommand({
          Bucket: process.env.AWS_S3_BUCKET_NAME!,
          Key: s3FileKey,
        });

        presignedUrl = await getSignedUrl(s3Client, command, { expiresIn: 900 });
      }

      const createdProject = await ctx.prisma.$transaction(async (tx) => {
        
        const project = await tx.project.create({
          data: {
            title: input.title,
            description: input.description,
            repoUrl: input.deliverableType === "link" ? input.deliverableContent : null,
            fileUrl: (input.deliverableType === "zip" || input.deliverableType === "archivo") ? (s3FileKey || "") : null,
            authorId: userId,
            competitionId: input.competitionId,
          },
        });

        await tx.competitionParticipant.upsert({
          where: {
            userId_competitionId: {
              userId: userId,
              competitionId: input.competitionId,
            },
          },
          update: {},
          create: {
            userId: userId,
            competitionId: input.competitionId,
            role: "DEV",
          },
        });

        return project;
      });

      return {
        success: true,
        message: "Proyecto registrado exitosamente en la competencia.",
        projectId: createdProject.id,
        presignedUrl,
      };
    }),
});