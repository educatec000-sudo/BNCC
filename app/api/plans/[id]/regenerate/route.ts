import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { Prisma } from "@prisma/client"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { generatePlanningContent } from "@/lib/planning-ai"
import { planningTypeIdFromLabel } from "@/lib/planning-templates"
import { IMAGE_MODES, imageStyleLabel, isImageStyle } from "@/lib/image-options"
import {
  INCLUSION_MODES,
  resolveNeedLabels,
  resolveResourceLabels,
  sanitizePedagogicalProfile,
} from "@/lib/inclusion-options"
import { toGeminiIntegrationError } from "@/lib/gemini"
import { rebuildEditorDocumentFromSource } from "@/lib/editor-document.server"
import {
  AccessDeniedError,
  releaseGeneration,
  reserveGeneration,
  type GenerationReservation,
} from "@/lib/access"

type RouteContext = { params: Promise<{ id: string }> }

async function safelyRelease(reservation: GenerationReservation) {
  try {
    await releaseGeneration(reservation)
  } catch {
    console.error("[regenerate] Não foi possível liberar a reserva de consumo.")
  }
}

export async function POST(req: NextRequest, { params }: RouteContext) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 })

  const { id } = await params
  const plan = await prisma.lessonPlan.findFirst({ where: { id, userId: session.user.id } })
  if (!plan) return NextResponse.json({ error: "Planejamento não encontrado" }, { status: 404 })

  let body: { mode?: unknown; instruction?: unknown }
  try {
    body = (await req.json()) as typeof body
  } catch {
    body = {}
  }
  const mode = body.mode === "improve" ? "improve" : "regenerate"
  const instruction = typeof body.instruction === "string" ? body.instruction.trim().slice(0, 500) : ""

  let reservation: GenerationReservation
  try {
    reservation = await reserveGeneration(session.user.id)
  } catch (error) {
    if (error instanceof AccessDeniedError) {
      return NextResponse.json(
        { error: error.code, code: error.code, message: error.message },
        { status: error.status },
      )
    }
    return NextResponse.json({ error: "Não foi possível verificar seu acesso." }, { status: 500 })
  }

  try {
    const inclusionNeedIds = Array.isArray(plan.inclusionNeeds)
      ? plan.inclusionNeeds.filter((item): item is string => typeof item === "string")
      : []
    const resourceIds = Array.isArray(plan.accessibilityResources)
      ? plan.accessibilityResources.filter((item): item is string => typeof item === "string")
      : []
    const inclusionLabel =
      INCLUSION_MODES.find((item) => item.id === plan.inclusionMode)?.label || "Turma regular"

    const generated = await generatePlanningContent({
      educationStage: plan.educationStage,
      area: plan.subject,
      grade: plan.grade,
      planningType: plan.planningType,
      planningTypeId: planningTypeIdFromLabel(plan.planningType),
      topic: plan.topic,
      request: plan.request,
      additionalPreferences: plan.additionalPreferences,
      inclusionMode: inclusionLabel,
      inclusionNeeds: resolveNeedLabels(inclusionNeedIds) || [],
      accessibilityResources: resolveResourceLabels(resourceIds) || [],
      pedagogicalProfile: sanitizePedagogicalProfile(plan.pedagogicalProfile) || {},
      imageMode: IMAGE_MODES.find((item) => item.id === plan.imageMode)?.label,
      imageStyle: isImageStyle(plan.imageStyle) ? imageStyleLabel(plan.imageStyle) : "Educacional",
      coloringPage: plan.coloringPage,
      accessibleImages: plan.accessibleImages,
      generateAltText: plan.generateAltText,
      improvementInstruction:
        mode === "improve"
          ? instruction ||
            "Melhore clareza, profundidade pedagógica, aplicabilidade e alinhamento à BNCC, preservando o contexto original."
          : "Crie uma versão nova, com abordagens e atividades diferentes, preservando o pedido original.",
    })

    const theme = generated.analysis.theme || generated.content.metadata.titulo || plan.theme
    const updated = await prisma.lessonPlan.update({
      where: { id: plan.id },
      data: {
        title: generated.content.metadata.titulo || `${plan.planningType} — ${theme}`,
        theme,
        requestedQuantity: generated.analysis.requestedQuantity,
        difficulty: generated.analysis.difficulty,
        outputFormat: generated.analysis.outputFormat,
        content: generated.content as unknown as Prisma.InputJsonValue,
        bnccSkills: generated.content.habilidadesBncc as unknown as Prisma.InputJsonValue,
        adaptedContent: Prisma.JsonNull,
        adaptedFor: [] as unknown as Prisma.InputJsonValue,
        status: "COMPLETED",
      },
    })
    await prisma.materialOperation.create({
      data: {
        lessonPlanId: plan.id,
        userId: session.user.id,
        type: mode === "improve" ? "TEXT_AI_IMPROVEMENT" : "TEXT_REGENERATION",
        usesAi: true,
        units: 1,
        provider: generated.provider,
      },
    })
    await rebuildEditorDocumentFromSource({
      lessonPlanId: plan.id,
      userId: session.user.id,
      changeType: mode === "improve" ? "AI_IMPROVEMENT" : "AI_REGENERATION",
    })

    return NextResponse.json({
      plan: updated,
      message: mode === "improve" ? "Conteúdo melhorado e salvo." : "Nova versão gerada e salva.",
      usage: { used: reservation.used, limit: reservation.limit },
    })
  } catch (error) {
    await safelyRelease(reservation)
    const geminiError = toGeminiIntegrationError(error)
    return NextResponse.json(
      { error: geminiError.message, code: geminiError.code },
      { status: geminiError.httpStatus },
    )
  }
}
