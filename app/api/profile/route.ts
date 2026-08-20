import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 })

  let body: { name?: unknown }
  try {
    body = (await req.json()) as typeof body
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 })
  }

  const name = typeof body.name === "string" ? body.name.trim() : ""
  if (name.length < 2 || name.length > 100) {
    return NextResponse.json({ error: "Informe um nome entre 2 e 100 caracteres." }, { status: 400 })
  }

  const user = await prisma.user.update({
    where: { id: session.user.id },
    data: { name },
    select: { id: true, name: true, email: true },
  })

  return NextResponse.json({ user })
}
