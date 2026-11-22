import { describe, expect, it, vi } from "vitest";

vi.mock("@devbattle/db", () => ({
  prisma: {},
}));

vi.mock("../../auth", () => ({
  auth: vi.fn(),
  handlers: {},
  signIn: vi.fn(),
  signOut: vi.fn(),
}));

vi.mock("next-auth", () => ({
  default: vi.fn(),
}));

vi.mock("bcryptjs", () => ({
  hash: vi.fn().mockResolvedValue("mocked_hashed_password"),
}));

import { TRPCError } from "@trpc/server";
import { authRouter } from "./auth";
import { createCallerFactory, type Context } from "../trpc";

describe("authRouter - Pruebas Exhaustivas", () => {
  const createCaller = createCallerFactory(authRouter);

  describe("Procedimiento: register", () => {
    it("rechaza si el correo electrónico tiene un formato inválido", async () => {
      const caller = createCaller({
        prisma: {} as unknown as Context["prisma"],
        session: null,
        headers: new Headers(),
      });

      await expect(
        caller.register({
          email: "invalid-email-format",
          password: "password123",
          username: "validuser",
        })
      ).rejects.toThrow();
    });

    it("rechaza si la contraseña tiene menos de 8 caracteres", async () => {
      const caller = createCaller({
        prisma: {} as unknown as Context["prisma"],
        session: null,
        headers: new Headers(),
      });

      await expect(
        caller.register({
          email: "user@example.com",
          password: "short",
          username: "validuser",
        })
      ).rejects.toThrow();
    });

    it("rechaza si el email ya se encuentra registrado", async () => {
      const caller = createCaller({
        prisma: {
          user: {
            findFirst: async () => ({
              id: "existing-user-id",
              email: "existing@example.com",
              username: "other_user",
            }),
          },
        } as unknown as Context["prisma"],
        session: null,
        headers: new Headers(),
      });

      await expect(
        caller.register({
          email: "existing@example.com",
          password: "securePassword123",
          username: "newusername",
        })
      ).rejects.toThrowError(
        new TRPCError({
          code: "CONFLICT",
          message: "El email ya está registrado",
        })
      );
    });

    it("rechaza si el nombre de usuario ya se encuentra registrado", async () => {
      const caller = createCaller({
        prisma: {
          user: {
            findFirst: async () => ({
              id: "existing-user-id",
              email: "different@example.com",
              username: "existing_user",
            }),
          },
        } as unknown as Context["prisma"],
        session: null,
        headers: new Headers(),
      });

      await expect(
        caller.register({
          email: "newemail@example.com",
          password: "securePassword123",
          username: "existing_user",
        })
      ).rejects.toThrowError(
        new TRPCError({
          code: "CONFLICT",
          message: "El nombre de usuario ya está registrado",
        })
      );
    });

    it("deriva automáticamente el nombre de usuario a partir del email si no se especifica", async () => {
      let createdData: unknown = null;

      const caller = createCaller({
        prisma: {
          user: {
            findFirst: async () => null,
            create: async ({ data }: { data: unknown }) => {
              createdData = data;
              return {
                id: "generated-id",
                username: (data as { username: string }).username,
                email: (data as { email: string }).email,
                createdAt: new Date("2026-01-01"),
              };
            },
          },
        } as unknown as Context["prisma"],
        session: null,
        headers: new Headers(),
      });

      const res = await caller.register({
        email: "carlos.dev@example.com",
        password: "securePassword123",
      });

      expect(res.username).toBe("carlos.dev");
      expect((createdData as { username: string }).username).toBe("carlos.dev");
      expect((createdData as { passwordHash: string }).passwordHash).toBe(
        "mocked_hashed_password"
      );
    });

    it("captura errores de unicidad P2002 de Prisma y los convierte en TRPCError CONFLICT", async () => {
      const p2002Error = new Error("Unique constraint failed");
      (p2002Error as unknown as { code: string }).code = "P2002";

      const caller = createCaller({
        prisma: {
          user: {
            findFirst: async () => null,
            create: async () => {
              throw p2002Error;
            },
          },
        } as unknown as Context["prisma"],
        session: null,
        headers: new Headers(),
      });

      await expect(
        caller.register({
          email: "racecondition@example.com",
          password: "securePassword123",
          username: "race_user",
        })
      ).rejects.toThrowError(
        new TRPCError({
          code: "CONFLICT",
          message: "El email o usuario ya está registrado",
        })
      );
    });
  });

  describe("Procedimiento: me", () => {
    it("devuelve los datos del usuario si hay sesión activa", async () => {
      const caller = createCaller({
        prisma: {} as unknown as Context["prisma"],
        session: {
          user: {
            id: "user-session-id",
            name: "John Doe",
            email: "john@example.com",
          },
          expires: "",
        },
        headers: new Headers(),
      });

      const res = await caller.me();
      expect(res).toEqual({
        id: "user-session-id",
        name: "John Doe",
        email: "john@example.com",
      });
    });

    it("lanza UNAUTHORIZED si no hay sesión activa", async () => {
      const caller = createCaller({
        prisma: {} as unknown as Context["prisma"],
        session: null,
        headers: new Headers(),
      });

      await expect(caller.me()).rejects.toThrowError(
        new TRPCError({ code: "UNAUTHORIZED", message: "Debes iniciar sesión" })
      );
    });
  });
});
