import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { Prisma } from "@prisma/client"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { ensureEditorDocument } from "@/lib/editor-document.server"
import {
  documentAssetIds,
  sanitizeEditorDocument,
  type EditorAssetView,
} from "@/lib/editor-document"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type RouteContext = { params: Promise<{ id: string }> }

function assetView(image: {
  id: string
  status: string
  prompt: string
  provider: string
  model: string
  style: string
  altText: string | null
  placementKey: string
  version: number
  createdAt: Date
  updatedAt: Date
}): EditorAssetView {
  return {
    ...image,
    url: `/api/images/${image.id}?v=${image.version}`,
    originalUrl: `/api/images/${image.id}?version=1`,
    createdAt: image.createdAt.toISOString(),
    updatedAt: image.updatedAt.toISOString(),
  }
}

export async function GET(_req: NextRequest, { params }: RouteContext) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
  const { id } = await params
  const plan = await prisma.lessonPlan.findFirst({
    where: { id, userId: session.user.id },
    include: {
      images: {
        where: { status: { not: "DELETED" } },
        orderBy: [{ placementKey: "asc" }, { position: "asc" }],
      },
    },
  })
  if (!plan) return NextResponse.json({ error: "Material não encontrado" }, { status: 404 })

  const result = await ensureEditorDocument(plan)
  const revisions = await prisma.documentRevision.findMany({
    where: { lessonPlanId: id, userId: session.user.id },
    orderBy: { version: "desc" },
    take: 30,
    select: { version: true, changeType: true, createdAt: true },
  })
  return NextResponse.json({
    document: result.document,
    version: result.version,
    assets: plan.images.map(assetView),
    revisions,
  })
}

export async function PATCH(req: NextRequest, { params }: RouteContext) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
  const { id } = await params
  let body: { document?: unknown; expectedVersion?: unknown }
  try {
    body = (await req.json()) as typeof body
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 })
  }

  const serializedSize = Buffer.byteLength(JSON.stringify(body.document ?? null), "utf8")
  if (serializedSize > 2 * 1024 * 1024) {
    return NextResponse.json({ error: "O documento excede o limite de 2 MB." }, { status: 413 })
  }
  const document = sanitizeEditorDocument(body.document)
  if (!document) {
    return NextResponse.json({ error: "A estrutura do documento é inválida." }, { status: 400 })
  }
  const expectedVersion =
    typeof body.expectedVersion === "number" && Number.isInteger(body.expectedVersion)
      ? body.expectedVersion
      : 0
  if (expectedVersion < 1) {
    return NextResponse.json({ error: "Versão de edição inválida." }, { status: 400 })
  }

  const existing = await prisma.lessonPlan.findFirst({
    where: { id, userId: session.user.id },
    select: { id: true, editorVersion: true },
  })
  if (!existing) return NextResponse.json({ error: "Material não encontrado" }, { status: 404 })
  if (existing.editorVersion !== expectedVersion) {
    return NextResponse.json(
      { error: "Este material foi atualizado em outra janela. Recarregue antes de continuar.", code: "VERSION_CONFLICT", currentVersion: existing.editorVersion },
      { status: 409 },
    )
  }

  const referencedIds = [...documentAssetIds(document)]
  if (referencedIds.length > 0) {
    const ownedAssets = await prisma.materialImage.count({
      where: {
        id: { in: referencedIds },
        lessonPlanId: id,
        userId: session.user.id,
        status: { not: "DELETED" },
      },
    })
    if (ownedAssets !== new Set(referencedIds).size) {
      return NextResponse.json({ error: "O documento referencia uma imagem indisponível." }, { status: 400 })
    }
  }

  const nextVersion = expectedVersion + 1
  const json = document as unknown as Prisma.InputJsonValue
  try {
    await prisma.$transaction(async (tx) => {
      const updated = await tx.lessonPlan.updateMany({
        where: { id, userId: session.user.id, editorVersion: expectedVersion },
        data: {
          editorDocument: json,
          editorVersion: nextVersion,
          editorUpdatedAt: new Date(),
        },
      })
      if (updated.count !== 1) throw new Error("VERSION_CONFLICT")
      await tx.documentRevision.create({
        data: {
          lessonPlanId: id,
          userId: session.user.id,
          version: nextVersion,
          document: json,
          changeType: "MANUAL_EDIT",
        },
      })
      await tx.materialOperation.create({
        data: {
          lessonPlanId: id,
          userId: session.user.id,
          type: "MANUAL_EDIT",
          usesAi: false,
          units: 0,
          metadata: { documentVersion: nextVersion },
        },
      })
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable })
  } catch (error) {
    if (error instanceof Error && (error.message === "VERSION_CONFLICT" || error.message.includes("Unique constraint"))) {
      return NextResponse.json(
        { error: "Este material foi atualizado em outra janela. Recarregue antes de continuar.", code: "VERSION_CONFLICT" },
        { status: 409 },
      )
    }
    console.error("[document] Falha ao salvar edição manual.")
    return NextResponse.json({ error: "Não foi possível salvar a edição." }, { status: 500 })
  }

  return NextResponse.json({ document, version: nextVersion, savedAt: new Date().toISOString() })
}
