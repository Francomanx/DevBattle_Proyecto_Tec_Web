//archivo relacionado a la vista de perfil de usuario
import { TRPCError } from "@trpc/server";
//zod valida el nombre de usuario que envia la pagina
import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "../trpc";
//con esto podemos consultar y obtener la informacion del perfil de suuario sin iniciar sesion
export const profileRouter = createTRPCRouter({
  byUsername: publicProcedure
    .input(
      z.object({
        username: z.string().trim().min(1).max(80),
      })
    )
    .query(async ({ ctx, input }) => {
      const user = await ctx.prisma.user.findUnique({
        where: { username: input.username },
        //select limita los campos consultados.
        //no sleccionamos email ni hash de contrasenia, por lo que
        //no se incluyen en la repsuesta
        select: {
          id: true,
          username: true,
          description: true,
          githubUrl: true,
          //este nos permite obtener las competencias
          //en las que hayan participado como HOST o DEV
          //(en un momento pense en agregar MOD tambien pero
          //la tarea no especifica la agregacion de esa lista,
          //asi que eso puede quedar para una tarea de estandarizacion
          //en caso de que consideren que se deba agregar a la
          //visualizacion del perifl de usuario)
          competitionParticipants: {
            where: {
              role: {
                in: ["HOST", "DEV"],
              },
            },
            select: {
              role: true,
              competition: {
                select: {
                  id: true,
                  title: true,
                  status: true,
                },
              },
            },
          },
          projects: {
            orderBy: {
              submissionDate: "desc",
            },
            select: {
              id: true,
              title: true,
              competitionId: true,
              competition: {
                select: {
                  title: true,
                  fileFormat: true,
                },
              },
            },
          },
        },
      });

      if (!user) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Usuario no encontrado",
        });
      }

      const hostedCompetitions = user.competitionParticipants
        .filter((participation) => participation.role === "HOST")
        .map((participation) => participation.competition);

      const devCompetitions = user.competitionParticipants
        .filter((participation) => participation.role === "DEV")
        .map((participation) => participation.competition);

      return {
        user: {
          id: user.id,
          username: user.username,
          description: user.description,
          githubUrl: user.githubUrl,
        },
        stats: {
          hostedCompetitions: hostedCompetitions.length,
          devCompetitions: devCompetitions.length,
        },
        hostedCompetitions,
        devCompetitions,
        projects: user.projects.map((project) => ({
          id: project.id,
          title: project.title,
          competitionId: project.competitionId,
          competitionTitle: project.competition.title,
          fileFormat: project.competition.fileFormat,
        })),
      };
    }),
});