import "server-only"

import { createHash } from "node:crypto"
import { prisma } from "@/lib/prisma"
import { getImageAIProviders } from "@/lib/ai/providers"
import {
  AccessDeniedError,
  releaseImageGeneration,
  reserveImageGeneration,
  type ImageGenerationReservation,
} from "@/lib/access"
import {
  imageModeLimit,
  isImageMode,
  isImageStyle,
  type ImageModeId,
  type ImageStyleId,
} from "@/lib/image-options"
import { buildEducationalImagePrompt } from "@/lib/images/prompt"
import { normalizeImageForPersistence } from "@/lib/images/normalize"
import { isPlanningContent, type VisualResourceSpec } from "@/lib/planning-content"

export interface ImageGenerationOutcome {
  id?: string
  placementKey: string
  status: "READY" | "FAILED" | "SKIPPED"
  error?: string
  cacheHit?: boolean
}

function safeErrorMessage(error: unknown): string {
  if (error instanceof AccessDeniedError) return error.message
  const message = error instanceof Error ? error.message : "Falha desconhecida"
  return message.replace(/AIza[0-9A-Za-z_-]{20,}/g, "[REDACTED]").slice(0, 500)
}

function configuredModelFor(provider: string): string {
  if (provider === "huggingface") {
    return process.env.IMAGE_MODEL?.trim() || "black-forest-labs/FLUX.1-schnell"
  }
  if (provider === "gemini") {
    return process.env.GEMINI_IMAGE_MODEL?.trim() || "gemini-2.5-flash-image"
  }
  return "not-configured"
}

function cacheKey(input: {
  userId: string
  prompt: string
  style: string
  coloringPage: boolean
  accessible: boolean
  provider: string
  model: string
}) {
  return createHash("sha256").update(JSON.stringify(input)).digest("hex")
}

async function safelyRelease(reservation: ImageGenerationReservation) {
  try {
    await releaseImageGeneration(reservation)
  } catch {
    console.error("[images] Não foi possível liberar reserva de imagem.")
  }
}

export async function generateImageForPlan(input: {
  userId: string
  lessonPlanId: string
  placementKey: string
  position?: number
  basePrompt: string
  altText?: string
  pedagogicalPurpose: string
  style: ImageStyleId
  coloringPage: boolean
  accessible: boolean
  generateAltText: boolean
  force?: boolean
  existingImageId?: string
}): Promise<ImageGenerationOutcome> {
  const plan = await prisma.lessonPlan.findFirst({
    where: { id: input.lessonPlanId, userId: input.userId },
    select: {
      id: true,
      topic: true,
      educationStage: true,
      grade: true,
      inclusionNeeds: true,
    },
  })
  if (!plan) throw new Error("Material não encontrado.")
  const subscription = await prisma.subscription.findUnique({
    where: { userId: input.userId },
    select: { plan: true },
  })
  const planCode = subscription?.plan || "FREE"

  const inclusionNeeds = Array.isArray(plan.inclusionNeeds)
    ? plan.inclusionNeeds.filter((item): item is string => typeof item === "string")
    : []
  const providers = getImageAIProviders()
  const primaryProvider = providers[0]
  const model = configuredModelFor(primaryProvider.id)
  const prompt = buildEducationalImagePrompt({
    basePrompt: input.basePrompt,
    topic: plan.topic,
    educationStage: plan.educationStage,
    grade: plan.grade,
    style: input.style,
    coloringPage: input.coloringPage,
    accessible: input.accessible,
    inclusionNeeds,
    pedagogicalPurpose: input.pedagogicalPurpose,
  })
  const key = cacheKey({
    userId: input.userId,
    prompt,
    style: input.style,
    coloringPage: input.coloringPage,
    accessible: input.accessible,
    provider: primaryProvider.id,
    model,
  })

  if (!input.force && !input.existingImageId) {
    const cached = await prisma.materialImage.findFirst({
      where: { userId: input.userId, cacheKey: key, status: "READY", imageData: { not: null } },
      orderBy: { updatedAt: "desc" },
    })
    if (cached?.imageData) {
      const copy = await prisma.materialImage.create({
        data: {
          userId: input.userId,
          lessonPlanId: plan.id,
          prompt: input.basePrompt,
          model: cached.model,
          provider: cached.provider,
          planCode,
          usageUnits: 0,
          style: input.style,
          status: "READY",
          altText: input.generateAltText ? input.altText : null,
          placementKey: input.placementKey,
          position: input.position || 0,
          widthPercent: cached.widthPercent,
          mimeType: cached.mimeType,
          imageData: cached.imageData,
          imageHash: cached.imageHash,
          cacheKey: key,
        },
      })
      if (copy.imageData && copy.mimeType && copy.imageHash) {
        await prisma.$transaction([
          prisma.materialImageVersion.create({
            data: {
              materialImageId: copy.id,
              version: 1,
              provider: copy.provider,
              model: copy.model,
              mimeType: copy.mimeType,
              imageData: copy.imageData,
              imageHash: copy.imageHash,
            },
          }),
          prisma.materialOperation.create({
            data: {
              lessonPlanId: plan.id,
              userId: input.userId,
              type: "IMAGE_CACHE_REUSE",
              usesAi: false,
              units: 0,
              provider: copy.provider,
              model: copy.model,
            },
          }),
        ])
      }
      return { id: copy.id, placementKey: input.placementKey, status: "READY", cacheHit: true }
    }
  }

  let previousImage: {
    id: string
    version: number
    provider: string
    model: string
    mimeType: string
    imageData: Uint8Array
    imageHash: string
  } | null = null
  if (input.existingImageId) {
    const previous = await prisma.materialImage.findFirst({
      where: {
        id: input.existingImageId,
        userId: input.userId,
        lessonPlanId: plan.id,
        imageData: { not: null },
      },
      select: {
        id: true,
        version: true,
        provider: true,
        model: true,
        mimeType: true,
        imageData: true,
        imageHash: true,
      },
    })
    if (previous?.imageData && previous.mimeType && previous.imageHash) {
      previousImage = {
        id: previous.id,
        version: previous.version,
        provider: previous.provider,
        model: previous.model,
        mimeType: previous.mimeType,
        imageData: previous.imageData,
        imageHash: previous.imageHash,
      }
      await prisma.materialImageVersion.upsert({
        where: {
          materialImageId_version: {
            materialImageId: previous.id,
            version: previous.version,
          },
        },
        update: {},
        create: {
          materialImageId: previous.id,
          version: previous.version,
          provider: previous.provider,
          model: previous.model,
          mimeType: previous.mimeType,
          imageData: previous.imageData,
          imageHash: previous.imageHash,
        },
      })
    }
  }

  const reservation = await reserveImageGeneration(input.userId)
  let record
  try {
    record = input.existingImageId
      ? await prisma.materialImage.update({
          where: { id: input.existingImageId, userId: input.userId, lessonPlanId: plan.id },
          data: {
            prompt: input.basePrompt,
            style: input.style,
            planCode: reservation.plan,
            usageUnits: 1,
            status: "PENDING",
            error: null,
            cacheKey: key,
            version: { increment: 1 },
          },
        })
      : await prisma.materialImage.create({
          data: {
            userId: input.userId,
            lessonPlanId: plan.id,
            prompt: input.basePrompt,
            model,
            provider: primaryProvider.id,
            planCode: reservation.plan,
            usageUnits: 1,
            style: input.style,
            status: "PENDING",
            altText: input.generateAltText ? input.altText : null,
            placementKey: input.placementKey,
            position: input.position || 0,
            cacheKey: key,
          },
        })

    let generated
    const providerErrors: string[] = []
    for (const candidate of providers) {
      try {
        generated = await candidate.generate({ prompt, aspectRatio: "4:3" })
        break
      } catch (providerError) {
        providerErrors.push(`${candidate.id}: ${safeErrorMessage(providerError)}`)
      }
    }
    if (!generated) {
      throw new Error(`Todos os provedores de imagem falharam. ${providerErrors.join(" | ")}`)
    }
    const normalized = await normalizeImageForPersistence(generated.data)
    const imageHash = createHash("sha256").update(normalized.data).digest("hex")
    const operationType = input.existingImageId ? "IMAGE_REGENERATION" : "IMAGE_GENERATION"
    await prisma.$transaction([
      prisma.materialImage.update({
        where: { id: record.id },
        data: {
          status: "READY",
          provider: generated.provider,
          model: generated.model,
          mimeType: normalized.mimeType,
          imageData: Uint8Array.from(normalized.data),
          imageHash,
          altText: input.generateAltText
            ? input.altText || generated.responseText || "Imagem educacional gerada por IA."
            : null,
          error: null,
        },
      }),
      prisma.materialImageVersion.upsert({
        where: {
          materialImageId_version: {
            materialImageId: record.id,
            version: record.version,
          },
        },
        update: {
          provider: generated.provider,
          model: generated.model,
          mimeType: normalized.mimeType,
          imageData: Uint8Array.from(normalized.data),
          imageHash,
        },
        create: {
          materialImageId: record.id,
          version: record.version,
          provider: generated.provider,
          model: generated.model,
          mimeType: normalized.mimeType,
          imageData: Uint8Array.from(normalized.data),
          imageHash,
        },
      }),
      prisma.materialOperation.create({
        data: {
          lessonPlanId: plan.id,
          userId: input.userId,
          type: operationType,
          usesAi: true,
          units: 1,
          provider: generated.provider,
          model: generated.model,
        },
      }),
    ])
    return { id: record.id, placementKey: input.placementKey, status: "READY" }
  } catch (error) {
    await safelyRelease(reservation)
    const safeError = safeErrorMessage(error)
    if (record) {
      await prisma.materialImage.updateMany({
        where: { id: record.id, userId: input.userId },
        data: previousImage
          ? {
              status: "READY",
              error: `A regeneração falhou; a versão anterior foi preservada. ${safeError}`.slice(0, 500),
              version: previousImage.version,
              provider: previousImage.provider,
              model: previousImage.model,
              mimeType: previousImage.mimeType,
              imageData: Uint8Array.from(previousImage.imageData),
              imageHash: previousImage.imageHash,
            }
          : { status: "FAILED", error: safeError, imageData: null },
      })
    }
    return { id: record?.id, placementKey: input.placementKey, status: "FAILED", error: safeError }
  }
}

function fallbackVisualSpec(topic: string): VisualResourceSpec {
  return {
    placementKey: "cover",
    pedagogicalPurpose: "Introduzir visualmente o assunto do material",
    prompt: `Representação educacional clara sobre ${topic}`,
    altText: `Imagem educacional relacionada a ${topic}.`,
    required: false,
  }
}

export async function generateImagesForPlan(input: {
  userId: string
  lessonPlanId: string
  content: unknown
  mode: ImageModeId
  style: ImageStyleId
  coloringPage: boolean
  accessible: boolean
  generateAltText: boolean
  topic: string
}): Promise<ImageGenerationOutcome[]> {
  if (input.mode === "NONE" || !isPlanningContent(input.content)) return []

  const subscription = await prisma.subscription.findUnique({
    where: { userId: input.userId },
    select: { plan: true },
  })
  const currentPlanCode = subscription?.plan || "FREE"
  const limit = imageModeLimit(input.mode)
  let specs = input.content.visualResources
  if (input.mode === "WHEN_NEEDED") specs = specs.filter((item) => item.required)
  if (specs.length === 0 && input.mode === "WHEN_POSSIBLE") {
    specs = [fallbackVisualSpec(input.topic)]
  }
  specs = specs.slice(0, limit)

  const outcomes: ImageGenerationOutcome[] = []
  for (let position = 0; position < specs.length; position += 1) {
    const spec = specs[position]
    try {
      outcomes.push(
        await generateImageForPlan({
          userId: input.userId,
          lessonPlanId: input.lessonPlanId,
          placementKey: spec.placementKey,
          position,
          basePrompt: spec.prompt,
          altText: spec.altText,
          pedagogicalPurpose: spec.pedagogicalPurpose,
          style: input.style,
          coloringPage: input.coloringPage,
          accessible: input.accessible,
          generateAltText: input.generateAltText,
        }),
      )
    } catch (error) {
      const safeError = safeErrorMessage(error)
      let failedId: string | undefined
      try {
        const failed = await prisma.materialImage.create({
          data: {
            userId: input.userId,
            lessonPlanId: input.lessonPlanId,
            prompt: spec.prompt,
            model: process.env.IMAGE_MODEL?.trim() || "black-forest-labs/FLUX.1-schnell",
            provider:
              process.env.IMAGE_PROVIDER?.trim() ||
              process.env.AI_IMAGE_PROVIDER?.trim() ||
              "huggingface",
            planCode: currentPlanCode,
            usageUnits: 0,
            style: input.style,
            status: "FAILED",
            altText: input.generateAltText ? spec.altText : null,
            placementKey: spec.placementKey,
            position,
            cacheKey: createHash("sha256")
              .update(`${input.userId}:${input.lessonPlanId}:${spec.prompt}:${position}`)
              .digest("hex"),
            error: safeError,
          },
        })
        failedId = failed.id
      } catch {
        // O material textual permanece válido mesmo quando nem o registro de falha pode ser salvo.
      }
      outcomes.push({
        id: failedId,
        placementKey: spec.placementKey,
        status: "FAILED",
        error: safeError,
      })
    }
  }
  return outcomes
}

export function validateImageSettings(input: { mode: unknown; style: unknown }) {
  return isImageMode(input.mode) && isImageStyle(input.style)
}

export function materialImageToView(image: {
  id: string
  prompt: string
  style: string
  status: string
  altText: string | null
  placementKey: string
  position: number
  widthPercent: number
  version: number
  error: string | null
}) {
  return {
    ...image,
    url: `/api/images/${image.id}`,
  }
}
