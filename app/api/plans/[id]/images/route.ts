import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { generateImageForPlan, materialImageToView } from "@/lib/images/service"
import { isImageStyle } from "@/lib/image-options"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 180

type RouteContext = { params: Promise<{ id: string }> }

export async function GET(_req: NextRequest, { params }: RouteContext) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
  const { id } = await params
  const images = await prisma.materialImage.findMany({
    where: { lessonPlanId: id, userId: session.user.id, status: { not: "DELETED" } },
    orderBy: [{ placementKey: "asc" }, { position: "asc" }],
    select: {
      id: true,
      prompt: true,
      style: true,
      status: true,
      altText: true,
      placementKey: true,
      position: true,
      widthPercent: true,
      version: true,
      error: true,
    },
  })
  return NextResponse.json({ images: images.map(materialImageToView) })
}

export async function POST(req: NextRequest, { params }: RouteContext) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
  const { id } = await params
  const plan = await prisma.lessonPlan.findFirst({ where: { id, userId: session.user.id } })
  if (!plan) return NextResponse.json({ error: "Material não encontrado" }, { status: 404 })

  let body: { prompt?: unknown; placementKey?: unknown; style?: unknown; altText?: unknown; coloringPage?: unknown; accessible?: unknown }
  try {
    body = (await req.json()) as typeof body
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 })
  }
  const prompt = typeof body.prompt === "string" ? body.prompt.trim() : ""
  const placementKey = typeof body.placementKey === "string" ? body.placementKey.trim() : ""
  const style = typeof body.style === "string" ? body.style : plan.imageStyle
  if (prompt.length < 5 || prompt.length > 1_000) {
    return NextResponse.json({ error: "Informe um prompt entre 5 e 1.000 caracteres." }, { status: 400 })
  }
  if (!placementKey || placementKey.length > 80 || !isImageStyle(style)) {
    return NextResponse.json({ error: "Posição ou estilo inválido." }, { status: 400 })
  }

  const outcome = await generateImageForPlan({
    userId: session.user.id,
    lessonPlanId: plan.id,
    placementKey,
    position: 0,
    basePrompt: prompt,
    altText: typeof body.altText === "string" ? body.altText.trim().slice(0, 500) : undefined,
    pedagogicalPurpose: "Recurso visual inserido manualmente pelo professor",
    style,
    coloringPage: body.coloringPage === true || style === "COLORING_PAGE",
    accessible: body.accessible === true,
    generateAltText: true,
    force: true,
  })

  return NextResponse.json(outcome, { status: outcome.status === "READY" ? 201 : 502 })
}
