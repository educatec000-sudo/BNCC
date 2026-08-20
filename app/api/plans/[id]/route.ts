import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { Prisma } from "@prisma/client"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { isPlanningContent } from "@/lib/planning-content"
import { isLessonPlanContent } from "@/lib/bncc-plan"

type PlanRouteContext = {
  params: Promise<{ id: string }>
}

export async function GET(_req: NextRequest, { params }: PlanRouteContext) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
  }

  const { id } = await params
  const plan = await prisma.lessonPlan.findFirst({
    where: { id, userId: session.user.id },
  })

  if (!plan) return NextResponse.json({ error: "Plano não encontrado" }, { status: 404 })
  return NextResponse.json({ plan })
}

export async function PATCH(req: NextRequest, { params }: PlanRouteContext) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
  }

  const { id } = await params
  let body: { content?: unknown }
  try {
    body = (await req.json()) as typeof body
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 })
  }

  const valid = isPlanningContent(body.content) || isLessonPlanContent(body.content)
  if (!valid) {
    return NextResponse.json(
      { error: "O conteúdo editado não corresponde à estrutura do material." },
      { status: 400 },
    )
  }

  const existing = await prisma.lessonPlan.findFirst({
    where: { id, userId: session.user.id },
    select: { id: true },
  })
  if (!existing) return NextResponse.json({ error: "Planejamento não encontrado" }, { status: 404 })

  const dynamicContent = isPlanningContent(body.content) ? body.content : null
  const legacyContent = isLessonPlanContent(body.content) ? body.content : null
  const skills = dynamicContent?.habilidadesBncc || legacyContent?.habilidadesBncc || []
  const title = dynamicContent?.metadata.titulo || legacyContent?.identificacao.tema
  const topic = dynamicContent?.metadata.assunto || legacyContent?.identificacao.tema

  const plan = await prisma.lessonPlan.update({
    where: { id },
    data: {
      content: body.content as Prisma.InputJsonValue,
      bnccSkills: skills as unknown as Prisma.InputJsonValue,
      ...(title ? { title } : {}),
      ...(topic ? { topic, theme: topic } : {}),
      adaptedContent: Prisma.JsonNull,
      adaptedFor: [] as unknown as Prisma.InputJsonValue,
    },
  })

  return NextResponse.json({ plan })
}

export async function DELETE(_req: NextRequest, { params }: PlanRouteContext) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
  }

  const { id } = await params
  await prisma.lessonPlan.deleteMany({
    where: { id, userId: session.user.id },
  })

  return NextResponse.json({ success: true })
}
