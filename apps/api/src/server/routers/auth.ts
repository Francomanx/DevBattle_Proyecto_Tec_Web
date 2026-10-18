import { TRPCError } from "@trpc/server";
import { hash } from "bcryptjs";
import { z } from "zod";
import { createTRPCRouter, protectedProcedure, publicProcedure } from "../trpc";

const registerInput = z.object({
  name: z.string().trim().min(2).max(80),
  email: z.string().trim().email().transform((email) => email.toLowerCase()),
  password: z.string().min(8).max(72),
});

export const authRouter = createTRPCRouter({
  register: publicProcedure.input(registerInput).mutation(async ({ ctx, input }) => {
    const existingUser = await ctx.prisma.user.findUnique({
      where: { email: input.email },
      select: { id: true },
    });
    if (existingUser) {
      throw new TRPCError({ code: "CONFLICT", message: "El email ya está registrado" });
    }

    try {
      const user = await ctx.prisma.user.create({
        data: {
          name: input.name,
          email: input.email,
          passwordHash: await hash(input.password, 12),
        },
        select: { id: true, name: true, email: true, createdAt: true },
      });
      return user;
    } catch (error) {
      if (
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        error.code === "P2002"
      ) {
        throw new TRPCError({ code: "CONFLICT", message: "El email ya está registrado" });
      }
      throw error;
    }
  }),

  me: protectedProcedure.query(({ ctx }) => {
    const user = ctx.session.user;
    if (!user) throw new TRPCError({ code: "UNAUTHORIZED" });
    return { id: user.id, name: user.name, email: user.email };
  }),
});