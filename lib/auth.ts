import "@/lib/env"

import type { NextAuthOptions } from "next-auth"
import type { Adapter, AdapterUser } from "next-auth/adapters"
import { PrismaAdapter } from "@next-auth/prisma-adapter"
import CredentialsProvider from "next-auth/providers/credentials"
import GoogleProvider from "next-auth/providers/google"
import bcrypt from "bcryptjs"
import { prisma } from "./prisma"
import { getGoogleOAuthConfig } from "./env"

const googleOAuth = getGoogleOAuthConfig()
const baseAdapter = PrismaAdapter(prisma)

const adapter = {
  ...baseAdapter,
  async createUser(user: Omit<AdapterUser, "id">) {
    return prisma.user.create({
      data: {
        name: user.name,
        email: user.email.trim().toLowerCase(),
        emailVerified: user.emailVerified,
        image: user.image,
        subscription: {
          create: { plan: "FREE", status: "ACTIVE" },
        },
        usage: {
          create: { freeGenerationsUsed: 0, monthlyGenerationsUsed: 0 },
        },
      },
    })
  },
} satisfies Adapter

const providers: NextAuthOptions["providers"] = [
  CredentialsProvider({
    name: "credentials",
    credentials: {
      email: { label: "Email", type: "email" },
      password: { label: "Senha", type: "password" },
    },
    async authorize(credentials) {
      if (!credentials?.email || !credentials?.password) return null
      const email = credentials.email.trim().toLowerCase()
      const user = await prisma.user.findUnique({ where: { email } })
      if (!user?.password) return null
      const valid = await bcrypt.compare(credentials.password, user.password)
      return valid ? user : null
    },
  }),
]

if (googleOAuth.configured) {
  providers.unshift(
    GoogleProvider({
      clientId: googleOAuth.clientId!,
      clientSecret: googleOAuth.clientSecret!,
      allowDangerousEmailAccountLinking: true,
      authorization: {
        params: {
          prompt: "select_account",
          access_type: "offline",
          response_type: "code",
        },
      },
    }),
  )
} else if (process.env.NODE_ENV !== "production") {
  console.warn(
    "[auth] Google OAuth desabilitado: GOOGLE_CLIENT_ID e/ou GOOGLE_CLIENT_SECRET não foram carregados.",
  )
}

export const authOptions: NextAuthOptions = {
  adapter,
  secret: process.env.NEXTAUTH_SECRET?.trim(),
  session: { strategy: "jwt" },
  providers,
  callbacks: {
    async signIn({ account, profile }) {
      if (account?.provider !== "google") return true
      return Boolean(
        profile &&
          "email_verified" in profile &&
          (profile as { email_verified?: unknown }).email_verified === true,
      )
    },
    async jwt({ token, user }) {
      if (user) token.id = user.id
      else if (!token.id && token.sub) token.id = token.sub
      return token
    },
    async session({ session, token }) {
      if (session.user) session.user.id = String(token.id || token.sub || "")
      return session
    },
  },
  pages: {
    signIn: "/login",
    error: "/login",
  },
}
