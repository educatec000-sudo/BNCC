import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { Prisma } from "@prisma/client"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { resolvePlanningSelection } from "@/lib/planning-options"
import {
  INCLUSION_MODES,
  isInclusionMode,
  resolveNeedLabels,
  resolveResourceLabels,
  sanitizePedagogicalProfile,
} from "@/lib/inclusion-options"
import { generatePlanningContent } from "@/lib/planning-ai"
import { IMAGE_MODES, isImageMode, isImageStyle, imageStyleLabel } from "@/lib/image-options"
import { analyzePlanningRequest, requiresTopic } from "@/lib/planning-templates"
import { generateImagesForPlan } from "@/lib/images/service"
import { toGeminiIntegrationError } from "@/lib/gemini"
import { rebuildEditorDocumentFromSource } from "@/lib/editor-document.server"
import {
  AccessDeniedError,
  releaseGeneration,
  reserveGeneration,
  type GenerationReservation,
} from "@/lib/access"

export const runtime = "nodejs"
export const maxDuration = 300

interface GenerateRequestBody {
  stageId?: unknown
  areaId?: unknown
  gradeId?: unknown
  planningTypeId?: unknown
  inclusionMode?: unknown
  inclusionNeeds?: unknown
  accessibilityResources?: unknown
  pedagogicalProfile?: unknown
  imageMode?: unknown
  imageStyle?: unknown
  coloringPage?: unknown
  accessibleImages?: unknown
  generateAltText?: unknown
  topic?: unknown
  request?: unknown
  additionalPreferences?: unknown
  planId?: unknown
}

async function safelyRelease(reservation: GenerationReservation) {
  try {
    await releaseGeneration(reservation)
  } catch {
    console.error("[api/generate] Não foi possível liberar a reserva de consumo.")
  }
}

function asTrimmedString(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
  }

  let body: GenerateRequestBody
  try {
    body = (await req.json()) as GenerateRequestBody
  } catch {
    return NextResponse.json({ error: "O corpo da requisição deve ser um JSON válido." }, { status: 400 })
  }

  const selection = resolvePlanningSelection({
    stageId: asTrimmedString(body.stageId),
    areaId: asTrimmedString(body.areaId),
    gradeId: asTrimmedString(body.gradeId),
    planningTypeId: asTrimmedString(body.planningTypeId),
  })
  const topic = asTrimmedString(body.topic)
  const teacherRequest = asTrimmedString(body.request)
  const additionalPreferences = asTrimmedString(body.additionalPreferences)
  const planId = asTrimmedString(body.planId)
  const inclusionMode = body.inclusionMode
  const inclusionNeedIds = Array.isArray(body.inclusionNeeds)
    ? body.inclusionNeeds.filter((item): item is string => typeof item === "string")
    : []
  const accessibilityResourceIds = Array.isArray(body.accessibilityResources)
    ? body.accessibilityResources.filter((item): item is string => typeof item === "string")
    : []
  const inclusionNeeds = resolveNeedLabels(inclusionNeedIds)
  const accessibilityResources = resolveResourceLabels(accessibilityResourceIds)
  const pedagogicalProfile = sanitizePedagogicalProfile(body.pedagogicalProfile)
  const imageMode = body.imageMode
  const imageStyle = body.imageStyle
  const coloringPage = body.coloringPage === true
  const accessibleImages = body.accessibleImages === true
  const generateAltText = body.generateAltText !== false

  if (!selection) {
    return NextResponse.json({ error: "Seleção de etapa, área, série ou tipo inválida." }, { status: 400 })
  }
  if (!isInclusionMode(inclusionMode) || !inclusionNeeds || !accessibilityResources || !pedagogicalProfile) {
    return NextResponse.json({ error: "Configuração de inclusão ou acessibilidade inválida." }, { status: 400 })
  }
  if (!isImageMode(imageMode) || !isImageStyle(imageStyle)) {
    return NextResponse.json({ error: "Configuração de recursos visuais inválida." }, { status: 400 })
  }
  if (inclusionMode !== "REGULAR" && inclusionNeeds.length === 0) {
    return NextResponse.json(
      { error: "Selecione ao menos uma necessidade educacional para o contexto inclusivo." },
      { status: 400 },
    )
  }
  if (requiresTopic(selection.planningTypeId) && topic.length < 2) {
    return NextResponse.json(
      { error: "Informe o assunto da aula para que a IA possa gerar um material mais preciso." },
      { status: 400 },
    )
  }
  if (topic.length > 160) {
    return NextResponse.json({ error: "O assunto deve ter no máximo 160 caracteres." }, { status: 400 })
  }
  if (teacherRequest.length < 10 || teacherRequest.length > 2_000) {
    return NextResponse.json(
      { error: "Descreva o pedido com 10 a 2.000 caracteres." },
      { status: 400 },
    )
  }
  const requestAnalysis = analyzePlanningRequest(selection.planningTypeId, teacherRequest)
  if (!requestAnalysis.quantityValid) {
    return NextResponse.json(
      { error: "A quantidade solicitada deve estar entre 1 e 50 itens." },
      { status: 400 },
    )
  }
  if (additionalPreferences.length > 1_000) {
    return NextResponse.json(
      { error: "As preferências adicionais devem ter no máximo 1.000 caracteres." },
      { status: 400 },
    )
  }

  if (planId) {
    const existing = await prisma.lessonPlan.findFirst({
      where: { id: planId, userId: session.user.id },
      select: { id: true },
    })
    if (!existing) return NextResponse.json({ error: "Planejamento não encontrado." }, { status: 404 })
  }

  let reservation: GenerationReservation
  try {
    reservation = await reserveGeneration(session.user.id)
  } catch (error) {
    if (error instanceof AccessDeniedError) {
      return NextResponse.json(
        {
          error: error.code,
          code: error.code,
          message: error.message,
          upgradeRequired: error.upgradeRequired,
        },
        { status: error.status },
      )
    }

    console.error("[api/generate] Falha ao reservar o consumo do usuário.")
    return NextResponse.json(
      { error: "Não foi possível verificar seu acesso agora. Tente novamente." },
      { status: 500 },
    )
  }

  const inclusionLabel = INCLUSION_MODES.find((item) => item.id === inclusionMode)?.label || "Turma regular"

  // Códigos em que repetir a requisição é seguro e faz sentido para o usuário.
  const retryableCodes = new Set([
    "TIMEOUT",
    "RATE_LIMITED",
    "QUOTA_EXCEEDED",
    "GEMINI_SERVICE_UNAVAILABLE",
    "GEMINI_INTERNAL_ERROR",
    "UPSTREAM_ERROR",
    "NETWORK_ERROR",
  ])

  const generationStartedAt = Date.now()
  let generated
  try {
    generated = await generatePlanningContent({
      educationStage: selection.stageLabel,
      area: selection.areaLabel,
      grade: selection.gradeLabel,
      planningType: selection.planningTypeLabel,
      planningTypeId: selection.planningTypeId,
      topic: topic || null,
      request: teacherRequest,
      additionalPreferences: additionalPreferences || null,
      inclusionMode: inclusionLabel,
      inclusionNeeds,
      accessibilityResources,
      pedagogicalProfile,
      imageMode: IMAGE_MODES.find((item) => item.id === imageMode)?.label,
      imageStyle: imageStyleLabel(imageStyle),
      coloringPage,
      accessibleImages,
      generateAltText,
    })
  } catch (error) {
    await safelyRelease(reservation)
    const geminiError = toGeminiIntegrationError(error)
    console.error(
      `[api/generate] Geração falhou após ${Date.now() - generationStartedAt}ms: code=${geminiError.code} http=${geminiError.httpStatus}.`,
    )
    return NextResponse.json(
      {
        error: geminiError.message,
        code: geminiError.code,
        retryable: retryableCodes.has(geminiError.code),
      },
      { status: geminiError.httpStatus },
    )
  }

  console.log(
    `[api/generate] Geração concluída em ${Date.now() - generationStartedAt}ms: provider=${generated.provider}${generated.corrected ? " (corrigida)" : ""}.`,
  )

  const theme = generated.analysis.theme || generated.content.metadata.titulo || teacherRequest.slice(0, 100)
  const title = generated.content.metadata.titulo || `${selection.planningTypeLabel} — ${theme}`
  const bnccSkills = generated.content.habilidadesBncc as unknown as Prisma.InputJsonValue
  const content = generated.content as unknown as Prisma.InputJsonValue

  try {
    const data = {
      title,
      theme,
      topic: topic || theme,
      educationStage: selection.stageLabel,
      subject: selection.areaLabel,
      grade: selection.gradeLabel,
      planningType: selection.planningTypeLabel,
      request: teacherRequest,
      requestedQuantity: generated.analysis.requestedQuantity,
      difficulty: generated.analysis.difficulty,
      outputFormat: generated.analysis.outputFormat,
      imageMode,
      imageStyle,
      coloringPage,
      accessibleImages,
      generateAltText,
      additionalPreferences: additionalPreferences || null,
      inclusionMode,
      inclusionNeeds: inclusionNeedIds as unknown as Prisma.InputJsonValue,
      accessibilityResources: accessibilityResourceIds as unknown as Prisma.InputJsonValue,
      pedagogicalProfile: pedagogicalProfile as unknown as Prisma.InputJsonValue,
      bnccSkills,
      status: "COMPLETED" as const,
      content,
      adaptedContent: Prisma.JsonNull,
      adaptedFor: [] as unknown as Prisma.InputJsonValue,
    }

    const plan = planId
      ? await prisma.lessonPlan.update({ where: { id: planId }, data })
      : await prisma.lessonPlan.create({
          data: { ...data, userId: session.user.id },
        })

    let images: Awaited<ReturnType<typeof generateImagesForPlan>> = []
    try {
      images = await generateImagesForPlan({
        userId: session.user.id,
        lessonPlanId: plan.id,
        content: generated.content,
        mode: imageMode,
        style: imageStyle,
        coloringPage,
        accessible: accessibleImages,
        generateAltText,
        topic: plan.topic,
      })
    } catch (imageError) {
      const errorName = imageError instanceof Error ? imageError.name : "UnknownError"
      console.error(`[api/generate] Material salvo, mas imagens falharam (${errorName}).`)
    }

    try {
      await prisma.materialOperation.create({
        data: {
          lessonPlanId: plan.id,
          userId: session.user.id,
          type: planId ? "TEXT_REGENERATION" : "TEXT_GENERATION",
          usesAi: true,
          units: 1,
          provider: generated.provider,
        },
      })
      await rebuildEditorDocumentFromSource({
        lessonPlanId: plan.id,
        userId: session.user.id,
        changeType: planId ? "AI_REGENERATION" : "INITIAL_GENERATION",
      })
    } catch (documentError) {
      const errorName = documentError instanceof Error ? documentError.name : "UnknownError"
      console.error(`[api/generate] Material salvo, mas documento editável não foi inicializado (${errorName}).`)
    }

    return NextResponse.json({
      plan,
      images,
      provider: generated.provider,
      usage: {
        plan: reservation.plan,
        used: reservation.used,
        limit: reservation.limit,
        remaining: reservation.remaining,
        nearLimit: reservation.nearLimit,
      },
      message: reservation.message,
      ...(generated.warning ? { warning: generated.warning } : {}),
    })
  } catch (error) {
  await safelyRelease(reservation)

  console.error("[api/generate] Erro ao salvar planejamento:", error)

  if (error instanceof Error) {
    console.error("[api/generate] Nome:", error.name)
    console.error("[api/generate] Mensagem:", error.message)
    console.error("[api/generate] Stack:", error.stack)
  }

  return NextResponse.json(
    {
      error: "O planejamento foi gerado, mas não pôde ser salvo.",
      details: error instanceof Error ? error.message : String(error),
    },
    { status: 500 },
  )
}
}
