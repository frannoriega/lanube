import "server-only";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { UserRole } from "@/types/prisma";
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import {
  getRegisteredUserByEmail,
  getUserByEmailAndPassword,
} from "./db/users";
import { prisma } from "./prisma";
import { CredentialsSignin } from "next-auth";
import { signInSchema } from "./schemas/auth";

const SESSION_EXPIRATION_TIME_MS = 1000 * 7 * 24 * 60 * 60; // 7 days

declare module "next-auth" {
  interface Session {
    banned: boolean;
    bannedReason: string;
    bannedUntil: Date;
    role: UserRole;
    userId: string;
  }

  interface JWT {
    banned: boolean;
    bannedReason: string;
    bannedUntil: Date;
    role: UserRole;
    userId: string;
  }
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  providers: [
    Credentials({
      credentials: {
        email: {
          type: "email",
          label: "Email",
          placeholder: "jejemplo@gmail.com",
        },
        password: {
          type: "password",
          label: "Contraseña",
          placeholder: "*****",
        },
      },
      authorize: async (credentials) => {
        try {
          const { email, password } =
            await signInSchema.parseAsync(credentials);
          const user = await getUserByEmailAndPassword(email, password);
          if (!user) return null;
          if (!user.emailVerified) {
            const err = new CredentialsSignin(
              "Debes confirmar tu correo electrónico antes de iniciar sesión. Revisa tu bandeja de entrada."
            );
            err.code = "email_not_verified";
            throw err;
          }
          return user;
        } catch (error) {
          if (error instanceof CredentialsSignin) throw error;
          return null;
        }
      },
    }),
  ],
  callbacks: {
    async session({ session, token }) {
      if (token) {
        session.banned = token.banned as boolean;
        session.bannedReason = token.bannedReason as string;
        session.bannedUntil = token.bannedUntil as Date;
        session.role = token.role as UserRole;
        session.userId = token.userId as string;
        if (token.exp) {
          session.expires = new Date(token.exp * 1000) as Date & string;
        }
      }
      return session;
    },
    async jwt({ token }) {
      if (token && token.email) {
        const registeredUser = await getRegisteredUserByEmail(token.email);
        if (registeredUser) {
          const now = Date.now();
          const defaultExp = now + SESSION_EXPIRATION_TIME_MS;
          const activeBan = registeredUser.bans[0] ?? null;
          token.signedUp = registeredUser;
          token.role = registeredUser.role;
          token.userId = registeredUser.id;
          if (activeBan) {
            const minExp = Math.min(
              activeBan.endTime?.getTime() ?? Infinity,
              defaultExp,
            );
            token.banned = true;
            token.bannedUntil = activeBan.endTime;
            token.bannedReason = activeBan.reason;

            token.exp = Math.floor(minExp / 1000);
          } else {
            token.exp = Math.floor(defaultExp / 1000);
          }
        }
      }
      return token;
    },
  },
  session: {
    strategy: "jwt",
  },
  pages: {
    signIn: "/auth/signin",
    newUser: "/auth/signup",
  },
});

async function verifyCaptcha(captcha: string): Promise<boolean> {
  const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      secret: process.env.TURNSTILE_SECRET_KEY ?? "1x0000000000000000000000000000000AA",
      response: captcha,
    }),
  })
  const data = await res.json()
  return data.success === true
}

export { verifyCaptcha };