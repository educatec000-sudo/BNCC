import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { Prisma } from "@prisma/client"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { generatePlanningContent } from "@/lib/planning-ai"
import { planningTypeIdFromLabel } from "@/lib/planning-templates"
import { IMAGE_MODES, imageStyleLabel, isImageStyle } from "@/lib/image-options"
import {
  resolveNeedLabels,
  resolveResourceLabels,
  sanitizePedagogicalProfile,
} from "@/lib/inclusion-options"
import { toGeminiIntegrationError } from "@/lib/gemini"
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
    console.error("[adapt] Não foi possível liberar a reserva de consumo.")
  }
}

export async function POST(req: NextRequest, { params }: RouteContext) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 })

  const { id } = await params
  const plan = await prisma.lessonPlan.findFirst({ where: { id, userId: session.user.id } })
  if (!plan) return NextResponse.json({ error: "Planejamento não encontrado" }, { status: 404 })

  let body: { needs?: unknown; resources?: unknown; pedagogicalProfile?: unknown }
  try {
    body = (await req.json()) as typeof body
  } catch {
    return NextResponse.json({ error: "JSON inválido." }, { status: 400 })
  }

  const needIds = Array.isArray(body.needs)
    ? body.needs.filter((item): item is string => typeof item === "string")
    : []
  const resourceIds = Array.isArray(body.resources)
    ? body.resources.filter((item): item is string => typeof item === "string")
    : []
  const needs = resolveNeedLabels(needIds)
  const resources = resolveResourceLabels(resourceIds)
  const profile = sanitizePedagogicalProfile(body.pedagogicalProfile)

  if (!needs || needs.length === 0 || !resources || !profile) {
    return NextResponse.json(
      { error: "Selecione ao menos uma necessidade educacional válida." },
      { status: 400 },
    )
  }

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
    const adapted = await generatePlanningContent({
      educationStage: plan.educationStage,
      area: plan.subject,
      grade: plan.grade,
      planningType: plan.planningType,
      planningTypeId: planningTypeIdFromLabel(plan.planningType),
      topic: plan.topic,
      request: plan.request,
      additionalPreferences: plan.additionalPreferences,
      inclusionMode: "Adaptação inclusiva posterior",
      inclusionNeeds: needs,
      accessibilityResources: resources,
      pedagogicalProfile: profile,
      imageMode: IMAGE_MODES.find((item) => item.id === plan.imageMode)?.label,
      imageStyle: isImageStyle(plan.imageStyle) ? imageStyleLabel(plan.imageStyle) : "Educacional",
      coloringPage: plan.coloringPage,
      accessibleImages: true,
      generateAltText: plan.generateAltText,
      originalPlanning: plan.content,
      improvementInstruction:
        "Adapte o planejamento original preservando tema, objetivos e proposta central. Torne participação, recursos e avaliação acessíveis com princípios do DUA.",
    })

    await prisma.lessonPlan.update({
      where: { id: plan.id },
      data: {
        adaptedContent: adapted.content as unknown as Prisma.InputJsonValue,
        adaptedFor: needIds as unknown as Prisma.InputJsonValue,
      },
    })

    return NextResponse.json({
      success: true,
      message: "Versão inclusiva criada e salva.",
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
