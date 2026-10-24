import { TRPCError } from "@trpc/server";
import { hash } from "bcryptjs";
import { z } from "zod";
import { createTRPCRouter, protectedProcedure, publicProcedure } from "../trpc";

const registerInput = z.object({
  name: z.string().trim().min(2).max(80).optional(),
  username: z.string().trim().min(2).max(80).optional(),
  email: z.string().trim().email().transform((email) => email.toLowerCase()),
  password: z.string().min(8).max(72),
});

export const authRouter = createTRPCRouter({
  register: publicProcedure.input(registerInput).mutation(async ({ ctx, input }) => {
    const username = (input.username || input.name || input.email.split("@")[0]).trim();
    if (!username) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "Nombre de usuario requerido" });
    }

    const existingUser = await ctx.prisma.user.findFirst({
      where: {
        OR: [{ email: input.email }, { username }],
      },
      select: { id: true, email: true, username: true },
    });
    if (existingUser) {
      if (existingUser.email === input.email) {
        throw new TRPCError({ code: "CONFLICT", message: "El email ya está registrado" });
      }
      throw new TRPCError({
        code: "CONFLICT",
        message: "El nombre de usuario ya está registrado",
      });
    }

    try {
      const user = await ctx.prisma.user.create({
        data: {
          username,
          email: input.email,
          passwordHash: await hash(input.password, 12),
        },
        select: { id: true, username: true, email: true, createdAt: true },
      });
      return {
        id: user.id,
        name: user.username,
        username: user.username,
        email: user.email,
        createdAt: user.createdAt,
      };
    } catch (error) {
      if (
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        error.code === "P2002"
      ) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "El email o usuario ya está registrado",
        });
      }
      throw error;
    }
  }),

  me: protectedProcedure.query(({ ctx }) => {
    const user = ctx.session.user;
    if (!user) throw new TRPCError({ code: "UNAUTHORIZED" });
    return { id: user.id, name: user.name ?? "", email: user.email ?? "" };
  }),
});