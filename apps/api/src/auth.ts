import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { compare } from "bcryptjs";
import { z } from "zod";
import { prisma } from "@devbattle/db";

const credentialsSchema = z.object({
  email: z.string().trim().email().transform((email) => email.toLowerCase()),
  password: z.string().min(1),
});

const authSecret =
  process.env.AUTH_SECRET ??
  process.env.NEXTAUTH_SECRET ??
  "devbattle-local-secret-change-before-deploy";
if (!process.env.AUTH_SECRET) {
  process.env.AUTH_SECRET = authSecret;
}

export const { handlers, auth } = NextAuth({
  secret: authSecret,
  trustHost: true,
  session: { strategy: "jwt" },
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const parsed = credentialsSchema.safeParse(credentials);
        if (!parsed.success) return null;

        const user = await prisma.user.findUnique({
          where: { email: parsed.data.email },
        });
        if (!user || !(await compare(parsed.data.password, user.passwordHash))) {
          return null;
        }

        return { id: user.id, email: user.email, name: user.username };
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.sub = user.id;
        token.name = user.name;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user && token.sub) {
        session.user.id = token.sub;
        const user = await prisma.user.findUnique({
          where: { id: token.sub },
          select: { username: true },
        });
        session.user.name = user?.username ?? token.name ?? session.user.name;
      }
      return session;
    },
  },
});