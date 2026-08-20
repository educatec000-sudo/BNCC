import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { generateImageForPlan } from "@/lib/images/service"
import { isImageStyle } from "@/lib/image-options"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 180

type RouteContext = { params: Promise<{ id: string }> }

export async function GET(req: NextRequest, { params }: RouteContext) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
  const { id } = await params
  const image = await prisma.materialImage.findFirst({
    where: { id, userId: session.user.id, status: "READY" },
    select: { imageData: true, mimeType: true, imageHash: true, version: true },
  })
  if (!image?.imageData) return NextResponse.json({ error: "Imagem não encontrada" }, { status: 404 })

  const requestedVersion = Number.parseInt(req.nextUrl.searchParams.get("version") || "", 10)
  const historical = Number.isInteger(requestedVersion) && requestedVersion > 0 && requestedVersion !== image.version
    ? await prisma.materialImageVersion.findFirst({
        where: { materialImageId: id, version: requestedVersion, materialImage: { userId: session.user.id } },
        select: { imageData: true, mimeType: true, imageHash: true },
      })
    : null
  const data = historical?.imageData || image.imageData
  const mimeType = historical?.mimeType || image.mimeType || "image/png"
  const imageHash = historical?.imageHash || image.imageHash || id

  return new NextResponse(new Uint8Array(data), {
    headers: {
      "Content-Type": mimeType,
      "Cache-Control": "private, max-age=3600, must-revalidate",
      ETag: `"${imageHash}"`,
      "X-Content-Type-Options": "nosniff",
    },
  })
}

export async function PATCH(req: NextRequest, { params }: RouteContext) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
  const { id } = await params
  let body: { prompt?: unknown; style?: unknown; widthPercent?: unknown; position?: unknown; placementKey?: unknown; altText?: unknown }
  try {
    body = (await req.json()) as typeof body
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 })
  }

  const existing = await prisma.materialImage.findFirst({ where: { id, userId: session.user.id } })
  if (!existing) return NextResponse.json({ error: "Imagem não encontrada" }, { status: 404 })
  const widthPercent = typeof body.widthPercent === "number" ? body.widthPercent : existing.widthPercent
  if (![50, 75, 100].includes(widthPercent)) {
    return NextResponse.json({ error: "Tamanho inválido" }, { status: 400 })
  }
  const style = typeof body.style === "string" ? body.style : existing.style
  if (!isImageStyle(style)) return NextResponse.json({ error: "Estilo inválido" }, { status: 400 })

  const [image] = await prisma.$transaction([
    prisma.materialImage.update({
      where: { id },
      data: {
        prompt: typeof body.prompt === "string" ? body.prompt.trim().slice(0, 1_000) : existing.prompt,
        style,
        widthPercent,
        position: typeof body.position === "number" ? Math.max(0, Math.min(100, body.position)) : existing.position,
        placementKey:
          typeof body.placementKey === "string"
            ? body.placementKey.trim().slice(0, 80)
            : existing.placementKey,
        altText: typeof body.altText === "string" ? body.altText.trim().slice(0, 500) : existing.altText,
      },
    }),
    prisma.materialOperation.create({
      data: {
        lessonPlanId: existing.lessonPlanId,
        userId: session.user.id,
        type: "IMAGE_MANUAL_EDIT",
        usesAi: false,
        units: 0,
      },
    }),
  ])
  return NextResponse.json({ image })
}

export async function POST(req: NextRequest, { params }: RouteContext) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
  const { id } = await params
  const image = await prisma.materialImage.findFirst({ where: { id, userId: session.user.id } })
  if (!image) return NextResponse.json({ error: "Imagem não encontrada" }, { status: 404 })

  let body: { prompt?: unknown; style?: unknown; coloringPage?: unknown; accessible?: unknown }
  try {
    body = (await req.json()) as typeof body
  } catch {
    body = {}
  }
  const style = typeof body.style === "string" ? body.style : image.style
  if (!isImageStyle(style)) return NextResponse.json({ error: "Estilo inválido" }, { status: 400 })
  const prompt = typeof body.prompt === "string" ? body.prompt.trim().slice(0, 1_000) : image.prompt
  if (prompt.length < 5) return NextResponse.json({ error: "Prompt muito curto" }, { status: 400 })

  const outcome = await generateImageForPlan({
    userId: session.user.id,
    lessonPlanId: image.lessonPlanId,
    existingImageId: image.id,
    placementKey: image.placementKey,
    position: image.position,
    basePrompt: prompt,
    altText: image.altText || undefined,
    pedagogicalPurpose: "Regenerar o recurso visual vinculado ao material",
    style,
    coloringPage: body.coloringPage === true || style === "COLORING_PAGE",
    accessible: body.accessible === true,
    generateAltText: true,
    force: true,
  })

  return NextResponse.json(outcome, { status: outcome.status === "READY" ? 200 : 502 })
}

export async function DELETE(_req: NextRequest, { params }: RouteContext) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
  const { id } = await params
  const existing = await prisma.materialImage.findFirst({
    where: { id, userId: session.user.id },
    select: { id: true, lessonPlanId: true },
  })
  if (!existing) return NextResponse.json({ error: "Imagem não encontrada" }, { status: 404 })
  await prisma.$transaction([
    prisma.materialImage.update({
      where: { id },
      data: { status: "DELETED", imageData: null },
    }),
    prisma.materialOperation.create({
      data: {
        lessonPlanId: existing.lessonPlanId,
        userId: session.user.id,
        type: "IMAGE_DELETE",
        usesAi: false,
        units: 0,
      },
    }),
  ])
  return NextResponse.json({ success: true })
}
