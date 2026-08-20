import { NextRequest, NextResponse } from "next/server"
import { Prisma } from "@prisma/client"
import bcrypt from "bcryptjs"
import { prisma } from "@/lib/prisma"

export async function POST(req: NextRequest) {
  let body: { name?: unknown; email?: unknown; password?: unknown }
  try {
    body = (await req.json()) as typeof body
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 })
  }

  const name = typeof body.name === "string" ? body.name.trim() : ""
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : ""
  const password = typeof body.password === "string" ? body.password : ""

  if (!name || !email || password.length < 8) {
    return NextResponse.json({ error: "Dados incompletos ou senha inválida" }, { status: 400 })
  }

  try {
    const existing = await prisma.user.findUnique({ where: { email } })
    if (existing) return NextResponse.json({ error: "Email já cadastrado" }, { status: 400 })

    const hashed = await bcrypt.hash(password, 12)
    await prisma.user.create({
      data: {
        name,
        email,
        password: hashed,
        subscription: {
          create: { plan: "FREE", status: "ACTIVE" },
        },
        usage: {
          create: { freeGenerationsUsed: 0, monthlyGenerationsUsed: 0 },
        },
      },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json({ error: "Email já cadastrado" }, { status: 400 })
    }

    const errorCode =
      typeof error === "object" && error !== null && "code" in error
        ? String((error as { code?: unknown }).code)
        : "DATABASE_ERROR"
    console.error(`[api/auth/register] Banco indisponível (${errorCode}).`)
    return NextResponse.json(
      {
        error:
          "Não foi possível acessar o banco de dados. Verifique DATABASE_URL e execute npm run check:env.",
      },
      { status: 503 },
    )
  }
}
