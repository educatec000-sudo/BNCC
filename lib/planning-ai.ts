import "server-only"

import { buildBnccPrompt, type PlanningPromptInput } from "@/lib/prompt"
import {
  buildMaterialJsonSchema,
  analyzePlanningRequest,
  planningTypeIdFromLabel,
  validatePlanningContentForRequest,
  type RequestAnalysis,
} from "@/lib/planning-templates"
import { isPlanningContent, normalizePlanningContent, type PlanningContent } from "@/lib/planning-content"
import { GeminiIntegrationError, toGeminiIntegrationError } from "@/lib/gemini"
import {
  getFallbackTextAIProvider,
  getTextAIProvider,
} from "@/lib/ai/providers"
import type { TextAIProvider } from "@/lib/ai/providers/types"

export interface PlanningGenerationResult {
  content: PlanningContent
  analysis: RequestAnalysis
  provider: "gemini" | "openai"
  warning?: string
  corrected: boolean
}

function invalidStructureError(errors: string[]): GeminiIntegrationError {
  return new GeminiIntegrationError({
    code: "PARSE_ERROR",
    message: "A IA não respeitou o tipo ou a quantidade solicitada. Tente novamente.",
    httpStatus: 502,
    technicalMessage: errors.join(" ").slice(0, 1_000),
  })
}

// Tempo limite dedicado à GERAÇÃO DE PLANEJAMENTO (uma única chamada). 45s é o
// padrão genérico do módulo Gemini e se mostrou curto para saída estruturada
// grande (até 24k tokens + schema BNCC). 90s mantém folga dentro do limite da
// rota (maxDuration = 300s), que ainda comporta a passada de correção e o
// fallback de provedor. Configurável via PLANNING_GENERATION_TIMEOUT_MS.
const DEFAULT_PLANNING_TIMEOUT_MS = 90_000
const MIN_PLANNING_TIMEOUT_MS = 30_000
const MAX_PLANNING_TIMEOUT_MS = 120_000

function resolvePlanningTimeoutMs(): number {
  const configured = Number(process.env.PLANNING_GENERATION_TIMEOUT_MS?.trim())
  const value = Number.isFinite(configured) && configured > 0 ? configured : DEFAULT_PLANNING_TIMEOUT_MS
  return Math.min(Math.max(value, MIN_PLANNING_TIMEOUT_MS), MAX_PLANNING_TIMEOUT_MS)
}

async function generateAndCorrect(
  provider: TextAIProvider,
  prompt: string,
  schema: Record<string, unknown>,
  analysis: RequestAnalysis,
  timeoutMs: number,
  onModel?: (model: string) => void,
): Promise<{ content: PlanningContent; corrected: boolean }> {
  const generate = (currentPrompt: string) =>
    provider.generateStructured({
      prompt: currentPrompt,
      schema,
      validator: isPlanningContent,
      formatName: analysis.materialType,
      maxOutputTokens: (analysis.expectedCount || 0) > 20 ? 24_000 : 16_000,
      timeoutMs,
      onModel,
    })

  const first = await generate(prompt)
  const firstValidation = validatePlanningContentForRequest(first, analysis)
  if (firstValidation.valid) return { content: normalizePlanningContent(first), corrected: false }

  const correctionPrompt = `${prompt}

CORREÇÃO OBRIGATÓRIA DA RESPOSTA ANTERIOR:
${firstValidation.errors.map((error) => `- ${error}`).join("\n")}

RESPOSTA ANTERIOR PARA CORRIGIR:
${JSON.stringify(first)}

Gere novamente o JSON completo. Preserve o conteúdo válido, mas corrija o tipo, a estrutura, a numeração e a quantidade exata antes de responder.`
  const corrected = await generate(correctionPrompt)
  const correctedValidation = validatePlanningContentForRequest(corrected, analysis)
  if (!correctedValidation.valid) throw invalidStructureError(correctedValidation.errors)

  return { content: normalizePlanningContent(corrected), corrected: true }
}

export async function generatePlanningContent(
  input: PlanningPromptInput,
): Promise<PlanningGenerationResult> {
  const planningTypeId =
    input.planningTypeId || planningTypeIdFromLabel(input.planningType) || "outro"
  const detected = analyzePlanningRequest(planningTypeId, input.request)
  const analysis: RequestAnalysis = {
    ...detected,
    theme: input.topic?.trim() || detected.theme,
  }
  if (!analysis.quantityValid) {
    throw new GeminiIntegrationError({
      code: "BAD_REQUEST",
      message: "A quantidade solicitada deve estar entre 1 e 50 itens.",
      httpStatus: 400,
    })
  }

  const schema = buildMaterialJsonSchema(analysis)
  const prompt = `${buildBnccPrompt({ ...input, planningTypeId }, analysis)}

SCHEMA JSON OBRIGATÓRIO PARA A RESPOSTA:
${JSON.stringify(schema)}`
  const primary = getTextAIProvider()
  const fallback = getFallbackTextAIProvider(primary)
  const timeoutMs = resolvePlanningTimeoutMs()

  const run = async (
    provider: TextAIProvider,
  ): Promise<{ content: PlanningContent; corrected: boolean }> => {
    let model = provider.id === "openai" ? "gpt-4o" : "desconhecido"
    const startedAt = Date.now()
    console.log(`[planning-ai] provider=${provider.id}`)
    console.log(`[planning-ai] request started`)
    try {
      const generated = await generateAndCorrect(provider, prompt, schema, analysis, timeoutMs, (resolvedModel) => {
        model = resolvedModel
      })
      console.log(`[planning-ai] model=${model}`)
      console.log(`[planning-ai] request finished duration=${Date.now() - startedAt}ms`)
      return generated
    } catch (error) {
      const normalized = toGeminiIntegrationError(error)
      // O erro classificado carrega o modelo que estava sendo usado (ex.: em
      // TIMEOUT, o modelo que estourou o limite), preferível ao "desconhecido".
      const effectiveModel = normalized.model || model
      console.log(`[planning-ai] model=${effectiveModel}`)
      console.log(`[planning-ai] error=${normalized.code}`)
      console.log(`[planning-ai] duration=${Date.now() - startedAt}ms`)
      throw normalized
    }
  }

  try {
    const generated = await run(primary)
    return { ...generated, analysis, provider: primary.id }
  } catch (primaryError) {
    const normalizedError = toGeminiIntegrationError(primaryError)
    const upstreamInfo = normalizedError.upstreamStatus
      ? ` · HTTP ${normalizedError.upstreamStatus}`
      : ""
    const modelInfo = normalizedError.model ? ` · modelo ${normalizedError.model}` : ""
    console.error(
      `[planning-ai] Provedor ${primary.id} falhou (${normalizedError.code}${upstreamInfo}${modelInfo}).`,
    )
    if (!fallback) {
      console.log(`[planning-ai] fallback=none`)
      throw normalizedError
    }

    console.log(`[planning-ai] fallback=${fallback.id}`)
    try {
      const generated = await run(fallback)
      return {
        ...generated,
        analysis,
        provider: fallback.id,
        warning: `O provedor ${primary.id} falhou; ${fallback.id} foi utilizado como fallback.`,
      }
    } catch (fallbackError) {
      const errorName = fallbackError instanceof Error ? fallbackError.name : "UnknownError"
      console.error(`[planning-ai] Fallback ${fallback.id} também falhou (${errorName}).`)
      throw normalizedError
    }
  }
}
