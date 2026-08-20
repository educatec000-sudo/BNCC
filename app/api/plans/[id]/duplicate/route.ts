import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { Prisma } from "@prisma/client"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { sanitizeEditorDocument } from "@/lib/editor-document"

type RouteContext = { params: Promise<{ id: string }> }

export async function POST(_req: NextRequest, { params }: RouteContext) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 })

  const { id } = await params
  const source = await prisma.lessonPlan.findFirst({
    where: { id, userId: session.user.id },
    include: { images: { where: { status: "READY" } } },
  })
  if (!source) return NextResponse.json({ error: "Planejamento não encontrado" }, { status: 404 })

  const duplicate = await prisma.lessonPlan.create({
    data: {
      userId: session.user.id,
      title: `${source.title} (Cópia)`,
      theme: source.theme,
      topic: source.topic,
      educationStage: source.educationStage,
      grade: source.grade,
      subject: source.subject,
      planningType: source.planningType,
      request: source.request,
      requestedQuantity: source.requestedQuantity,
      difficulty: source.difficulty,
      outputFormat: source.outputFormat,
      imageMode: source.imageMode,
      imageStyle: source.imageStyle,
      coloringPage: source.coloringPage,
      accessibleImages: source.accessibleImages,
      generateAltText: source.generateAltText,
      additionalPreferences: source.additionalPreferences,
      inclusionMode: source.inclusionMode,
      inclusionNeeds: source.inclusionNeeds as Prisma.InputJsonValue,
      accessibilityResources: source.accessibilityResources as Prisma.InputJsonValue,
      pedagogicalProfile:
        source.pedagogicalProfile === null
          ? Prisma.JsonNull
          : (source.pedagogicalProfile as Prisma.InputJsonValue),
      bnccSkills: source.bnccSkills as Prisma.InputJsonValue,
      status: source.status,
      content: source.content as Prisma.InputJsonValue,
      adaptedContent:
        source.adaptedContent === null
          ? Prisma.JsonNull
          : (source.adaptedContent as Prisma.InputJsonValue),
      adaptedFor: source.adaptedFor as Prisma.InputJsonValue,
    },
  })

  const assetIdMap = new Map<string, string>()
  for (const image of source.images) {
    const copy = await prisma.materialImage.create({
      data: {
        userId: session.user.id,
        lessonPlanId: duplicate.id,
        prompt: image.prompt,
        model: image.model,
        provider: image.provider,
        planCode: image.planCode,
        usageUnits: 0,
        style: image.style,
        status: "READY",
        altText: image.altText,
        placementKey: image.placementKey,
        position: image.position,
        widthPercent: image.widthPercent,
        version: 1,
        mimeType: image.mimeType,
        imageData: image.imageData,
        imageHash: image.imageHash,
        cacheKey: image.cacheKey,
      },
    })
    assetIdMap.set(image.id, copy.id)
    if (copy.imageData && copy.mimeType && copy.imageHash) {
      await prisma.materialImageVersion.create({
        data: {
          materialImageId: copy.id,
          version: 1,
          provider: copy.provider,
          model: copy.model,
          mimeType: copy.mimeType,
          imageData: copy.imageData,
          imageHash: copy.imageHash,
        },
      })
    }
  }

  const sourceDocument = sanitizeEditorDocument(source.editorDocument)
  if (sourceDocument) {
    const copiedDocument = structuredClone(sourceDocument)
    for (const section of copiedDocument.sections) {
      const nextElements: typeof section.elements = []
      for (const element of section.elements) {
        if (element.type === "image") {
          const copiedAssetId = assetIdMap.get(element.assetId)
          if (copiedAssetId) nextElements.push({ ...element, assetId: copiedAssetId })
          continue
        }
        if (element.type === "question") {
          element.images = element.images.flatMap((image) => {
            const copiedAssetId = assetIdMap.get(image.assetId)
            return copiedAssetId ? [{ ...image, assetId: copiedAssetId }] : []
          })
        }
        nextElements.push(element)
      }
      section.elements = nextElements
    }
    const json = copiedDocument as unknown as Prisma.InputJsonValue
    await prisma.$transaction([
      prisma.lessonPlan.update({
        where: { id: duplicate.id },
        data: { editorDocument: json, editorVersion: 1, editorUpdatedAt: new Date() },
      }),
      prisma.documentRevision.create({
        data: {
          lessonPlanId: duplicate.id,
          userId: session.user.id,
          version: 1,
          document: json,
          changeType: "DUPLICATED",
        },
      }),
    ])
  }
  await prisma.materialOperation.create({
    data: {
      lessonPlanId: duplicate.id,
      userId: session.user.id,
      type: "DUPLICATE",
      usesAi: false,
      units: 0,
      metadata: { sourcePlanId: source.id },
    },
  })

  return NextResponse.json({ plan: duplicate })
}
