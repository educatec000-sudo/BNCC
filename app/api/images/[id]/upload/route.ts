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
  const existing = await prisma.materialImage.findFirst({ where: { id, userId: session.user.id } })
  if (!existing) return NextResponse.json({ error: "Imagem não encontrada" }, { status: 404 })

  const formData = await req.formData()
  const file = formData.get("file")
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
  const hash = createHash("sha256").update(normalized.data).digest("hex")
  const nextVersion = existing.version + 1
  const operations = []
  if (existing.imageData && existing.mimeType && existing.imageHash) {
    operations.push(
      prisma.materialImageVersion.upsert({
        where: { materialImageId_version: { materialImageId: existing.id, version: existing.version } },
        update: {},
        create: {
          materialImageId: existing.id,
          version: existing.version,
          provider: existing.provider,
          model: existing.model,
          mimeType: existing.mimeType,
          imageData: existing.imageData,
          imageHash: existing.imageHash,
        },
      }),
    )
  }
  operations.push(
    prisma.materialImage.update({
      where: { id },
      data: {
        imageData: Uint8Array.from(normalized.data),
        imageHash: hash,
        mimeType: normalized.mimeType,
        status: "READY",
        provider: "upload",
        model: "manual-upload",
        version: nextVersion,
        error: null,
      },
    }),
    prisma.materialImageVersion.create({
      data: {
        materialImageId: existing.id,
        version: nextVersion,
        provider: "upload",
        model: "manual-upload",
        mimeType: normalized.mimeType,
        imageData: Uint8Array.from(normalized.data),
        imageHash: hash,
      },
    }),
    prisma.materialOperation.create({
      data: {
        lessonPlanId: existing.lessonPlanId,
        userId: session.user.id,
        type: "IMAGE_UPLOAD",
        usesAi: false,
        units: 0,
        provider: "upload",
        model: "manual-upload",
      },
    }),
  )
  await prisma.$transaction(operations)

  return NextResponse.json({ success: true, version: nextVersion })
}
