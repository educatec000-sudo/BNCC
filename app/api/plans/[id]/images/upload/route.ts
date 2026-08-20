import { createHash } from "node:crypto"
import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { normalizeImageForPersistence } from "@/lib/images/normalize"

export const runtime = "nodejs"

type RouteContext = { params: Promise<{ id: string }> }
const ALLOWED_TYPES = new Set(["image/png", "image/jpeg", "image/webp"])

export async function POST(req: NextRequest, { params }: RouteContext) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
  const { id } = await params
  const plan = await prisma.lessonPlan.findFirst({ where: { id, userId: session.user.id }, select: { id: true } })
  if (!plan) return NextResponse.json({ error: "Material não encontrado" }, { status: 404 })

  const form = await req.formData()
  const file = form.get("file")
  const altText = typeof form.get("altText") === "string" ? String(form.get("altText")).trim().slice(0, 500) : ""
  if (!(file instanceof File) || !ALLOWED_TYPES.has(file.type)) {
    return NextResponse.json({ error: "Envie PNG, JPEG ou WebP." }, { status: 400 })
  }
  if (file.size > 5 * 1024 * 1024) {
    return NextResponse.json({ error: "A imagem deve ter no máximo 5 MB." }, { status: 400 })
  }

  let normalized
  try {
    normalized = await normalizeImageForPersistence(Buffer.from(await file.arrayBuffer()))
  } catch {
    return NextResponse.json({ error: "O arquivo não contém uma imagem válida." }, { status: 400 })
  }
  const imageHash = createHash("sha256").update(normalized.data).digest("hex")
  const cacheKey = createHash("sha256").update(`${session.user.id}:${id}:upload:${imageHash}`).digest("hex")
  const subscription = await prisma.subscription.findUnique({ where: { userId: session.user.id }, select: { plan: true } })

  const image = await prisma.materialImage.create({
    data: {
      userId: session.user.id,
      lessonPlanId: id,
      prompt: "Imagem adicionada manualmente pelo professor.",
      model: "manual-upload",
      provider: "upload",
      planCode: subscription?.plan || "FREE",
      usageUnits: 0,
      style: "EDUCATIONAL",
      status: "READY",
      altText: altText || null,
      placementKey: "editor:manual",
      position: 0,
      widthPercent: 75,
      version: 1,
      mimeType: normalized.mimeType,
      imageData: Uint8Array.from(normalized.data),
      imageHash,
      cacheKey,
    },
  })
  await prisma.$transaction([
    prisma.materialImageVersion.create({
      data: {
        materialImageId: image.id,
        version: 1,
        provider: image.provider,
        model: image.model,
        mimeType: normalized.mimeType,
        imageData: Uint8Array.from(normalized.data),
        imageHash,
      },
    }),
    prisma.materialOperation.create({
      data: {
        lessonPlanId: id,
        userId: session.user.id,
        type: "IMAGE_UPLOAD",
        usesAi: false,
        units: 0,
        provider: "upload",
        model: "manual-upload",
      },
    }),
  ])

  return NextResponse.json({ id: image.id, status: "READY" }, { status: 201 })
}
