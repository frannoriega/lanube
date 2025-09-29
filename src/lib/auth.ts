import NextAuth from "next-auth"
import Google from "next-auth/providers/google"
import { PrismaAdapter } from "@auth/prisma-adapter"
import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

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
      if (session?.user && token) {
        session.user.id = token.sub as string
      }
      return session
    },
    async jwt({ token, user, account }) {
      if (account?.provider === "google" && user?.email) {
        // Check if this is the admin email
        if (user.email === "frannoriega.92@gmail.com") {
          token.role = "ADMIN"
        } else {
          token.role = "USER"
        }
      }
      return token
    },
    async signIn({ user, account }) {
      if (account?.provider === "google" && user.email) {
        // For JWT strategy, we can allow sign in and handle role in JWT callback
        return true
      }
      return true
    },
  },
  session: {
    strategy: "jwt",
  },
  pages: {
    signIn: "/auth/signin",
  },
})