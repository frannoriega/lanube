import { PrismaAdapter } from "@auth/prisma-adapter"
import { UserRole } from "@prisma/client"
import NextAuth from "next-auth"
import Google from "next-auth/providers/google"
import { getUserByEmail } from "./db/users"
import { prisma } from "./prisma"

const SESSION_EXPIRATION_TIME_MS = 1000 * 7 * 24 * 60 * 60 // 7 days

declare module 'next-auth' {
  interface Session {
    banned: boolean
    bannedReason: string
    bannedUntil: Date
    role: UserRole
    userId: string
  }

  interface JWT {
    banned: boolean
    bannedReason: string
    bannedUntil: Date
    role: UserRole
    userId: string
  }
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  providers: [
    Google({
      clientId: process.env.AUTH_GOOGLE_ID!,
      clientSecret: process.env.AUTH_GOOGLE_SECRET!,
    }),
  ],
  callbacks: {
    async session({ session, token }) {
      if (token) {
        session.banned = token.banned as boolean
        session.bannedReason = token.bannedReason as string
        session.bannedUntil = token.bannedUntil as Date
        session.role = token.role as UserRole
        session.userId = token.userId as string
        if (token.exp) {
          session.expires = new Date(token.exp * 1000) as any
        }
      }
      return session
    },
    async jwt({ token }) {
      if (token && token.email) {
        const registeredUser = await getUserByEmail(token.email)
        if (registeredUser) {
          const now = Date.now()
          const defaultExp = now + SESSION_EXPIRATION_TIME_MS
          const activeBan = registeredUser.bans[0] ?? null
          token.signedUp = registeredUser
          token.role = registeredUser.role
          token.userId = registeredUser.userId
          if (activeBan) {
            const minExp = Math.min(activeBan.endTime?.getTime() ?? Infinity, defaultExp)
            token.banned = true
            token.bannedUntil = activeBan.endTime
            token.bannedReason = activeBan.reason

            token.exp = Math.floor(minExp / 1000)
          } else {
            token.exp = Math.floor(defaultExp / 1000)
          }
        }
      }
      return token
    },
  },
  session: {
    strategy: "jwt",
  },
  pages: {
    signIn: "/auth/signin",
    newUser: "/auth/signup",
  },
})