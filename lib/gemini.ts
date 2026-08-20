import "server-only"

import {
  ApiError,
  GoogleGenAI,
  type GenerateContentConfig,
  type Model,
} from "@google/genai"
import {
  BNCC_PLAN_JSON_SCHEMA,
  isLessonPlanContent,
  type LessonPlanContent,
} from "@/lib/bncc-plan"

const DEFAULT_TIMEOUT_MS = 120_000
const MODEL_LIST_TIMEOUT_MS = 30_000
const MAX_GENERATION_MODELS = 4
const GENERATION_RETRY_DELAYS_MS = [0, 750, 2_000]

const PREFERRED_MODEL_IDS = [
  "gemini-flash-latest",
  "gemini-3.6-flash",
  "gemini-3.5-flash",
  "gemini-flash-lite-latest",
  "gemini-3.5-flash-lite",
  "gemini-2.5-flash",
  "gemini-2.5-flash-lite",
]
const NON_TEXT_MODEL_MARKERS = [
  "audio",
  "computer-use",
  "customtools",
  "embedding",
  "image",
  "imagen",
  "live",
  "lyria",
  "omni",
  "robotics",
  "tts",
  "veo",
]

export type GeminiErrorCode =
  | "MISSING_API_KEY"
  | "INVALID_API_KEY"
  | "AUTHENTICATION_ERROR"
  | "API_NOT_ENABLED"
  | "BAD_REQUEST"
  | "FORBIDDEN"
  | "MODEL_NOT_FOUND"
  | "NO_COMPATIBLE_MODEL"
  | "QUOTA_EXCEEDED"
  | "RATE_LIMITED"
  | "TIMEOUT"
  | "NETWORK_ERROR"
  | "GEMINI_INTERNAL_ERROR"
  | "GEMINI_SERVICE_UNAVAILABLE"
  | "EMPTY_RESPONSE"
  | "PARSE_ERROR"
  | "UPSTREAM_ERROR"
  | "INTERNAL_ERROR"

export interface GeminiModelInfo {
  id: string
  displayName: string
  outputTokenLimit?: number
  thinking: boolean
}

export interface GeminiModelResolution extends GeminiModelInfo {
  configuredModel?: string
  usedFallback: boolean
  compatibleModels: string[]
  warning?: string
}

export interface GeminiTextResult {
  text: string
  model: string
  configuredModel?: string
  usedFallback: boolean
  compatibleModels: string[]
  warning?: string
}

export class GeminiIntegrationError extends Error {
  readonly code: GeminiErrorCode
  readonly httpStatus: number
  readonly upstreamStatus?: number
  readonly technicalMessage: string
  readonly model?: string
  readonly compatibleModels?: string[]

  constructor(options: {
    code: GeminiErrorCode
    message: string
    httpStatus: number
    upstreamStatus?: number
    technicalMessage?: string
    model?: string
    compatibleModels?: string[]
  }) {
    super(options.message)
    this.name = "GeminiIntegrationError"
    this.code = options.code
    this.httpStatus = options.httpStatus
    this.upstreamStatus = options.upstreamStatus
    this.technicalMessage = options.technicalMessage ?? options.message
    this.model = options.model
    this.compatibleModels = options.compatibleModels
  }
}

interface GenerateTextOptions {
  responseJson?: boolean
  responseJsonSchema?: unknown
  timeoutMs?: number
  maxOutputTokens?: number
  temperature?: number
}

interface ErrorContext {
  model?: string
  compatibleModels?: string[]
}

let availableModelsPromise: Promise<GeminiModelInfo[]> | undefined

function getApiKey(): string {
  const apiKey = process.env.GEMINI_API_KEY?.trim()

  if (!apiKey) {
    throw new GeminiIntegrationError({
      code: "MISSING_API_KEY",
      message: "GEMINI_API_KEY não configurada.",
      httpStatus: 500,
    })
  }

  return apiKey
}

function createClient(apiKey: string): GoogleGenAI {
  // API Key simples do Google AI Studio usa a Gemini Developer API, não Vertex AI.
  return new GoogleGenAI({ apiKey, apiVersion: "v1beta", vertexai: false })
}

function normalizeModelId(name: string): string {
  return name.replace(/^models\//, "").trim()
}

function normalizeConfiguredModel(): string | undefined {
  const configured = process.env.GEMINI_MODEL?.trim()
  return configured ? normalizeModelId(configured) : undefined
}

function supportsTextGeneration(model: Model): boolean {
  const id = normalizeModelId(model.name ?? "")
  const actions = model.supportedActions ?? []
  const normalizedId = id.toLowerCase()

  return (
    id.length > 0 &&
    normalizedId.startsWith("gemini-") &&
    actions.includes("generateContent") &&
    !NON_TEXT_MODEL_MARKERS.some((marker) => normalizedId.includes(marker))
  )
}

function modelScore(model: GeminiModelInfo): number {
  const id = model.id.toLowerCase()
  const preferredIndex = PREFERRED_MODEL_IDS.indexOf(id)
  if (preferredIndex >= 0) return 10_000 - preferredIndex

  const version = id.match(/^gemini-(\d+)(?:\.(\d+))?/)
  const major = version ? Number(version[1]) : 0
  const minor = version?.[2] ? Number(version[2]) : 0
  let score = major * 100 + minor * 10

  if (id.includes("flash")) score += 1_000
  if (id.includes("pro")) score += 500
  if (id.includes("latest")) score += 300
  if (id.includes("lite")) score -= 100
  if (id.includes("preview")) score -= 500
  if (id.includes("experimental") || id.includes("exp-")) score -= 800

  return score
}

function sortModels(models: GeminiModelInfo[]): GeminiModelInfo[] {
  return [...models].sort((a, b) => {
    const scoreDifference = modelScore(b) - modelScore(a)
    return scoreDifference || b.id.localeCompare(a.id)
  })
}

function createTimeout(timeoutMs: number) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  timer.unref?.()

  return {
    signal: controller.signal,
    clear: () => clearTimeout(timer),
  }
}

function wait(delayMs: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, delayMs))
}

async function requestAvailableModels(ai: GoogleGenAI): Promise<GeminiModelInfo[]> {
  const timeout = createTimeout(MODEL_LIST_TIMEOUT_MS)

  try {
    const pager = await ai.models.list({
      config: {
        pageSize: 1_000,
        queryBase: true,
        abortSignal: timeout.signal,
      },
    })

    const models: GeminiModelInfo[] = []
    for await (const model of pager) {
      if (!supportsTextGeneration(model)) continue

      const id = normalizeModelId(model.name ?? "")
      models.push({
        id,
        displayName: model.displayName ?? id,
        outputTokenLimit: model.outputTokenLimit,
        thinking: model.thinking ?? false,
      })
    }

    return sortModels(models)
  } finally {
    timeout.clear()
  }
}

async function getAvailableModels(ai: GoogleGenAI): Promise<GeminiModelInfo[]> {
  availableModelsPromise ??= requestAvailableModels(ai)

  try {
    return await availableModelsPromise
  } catch (error) {
    availableModelsPromise = undefined
    throw error
  }
}

export async function listAvailableGeminiTextModels(): Promise<GeminiModelInfo[]> {
  const apiKey = getApiKey()
  const ai = createClient(apiKey)

  try {
    return await getAvailableModels(ai)
  } catch (error) {
    throw toGeminiIntegrationError(error)
  }
}

async function resolveModel(ai: GoogleGenAI): Promise<GeminiModelResolution> {
  const models = await getAvailableModels(ai)
  const configuredModel = normalizeConfiguredModel()
  const compatibleModels = models.map((model) => model.id)

  if (models.length === 0) {
    throw new GeminiIntegrationError({
      code: "NO_COMPATIBLE_MODEL",
      message:
        "A chave não possui nenhum modelo Gemini de texto compatível com generateContent.",
      httpStatus: 502,
      technicalMessage: "models.list não retornou modelos Gemini de texto com generateContent.",
      model: configuredModel,
      compatibleModels,
    })
  }

  const configuredMatch = configuredModel
    ? models.find((model) => model.id === configuredModel)
    : undefined
  const selected = configuredMatch ?? models[0]
  const usedFallback = Boolean(configuredModel && !configuredMatch)

  return {
    ...selected,
    configuredModel,
    usedFallback,
    compatibleModels,
    ...(usedFallback
      ? {
          warning: `O modelo configurado ${configuredModel} não está disponível. ${selected.id} foi selecionado automaticamente.`,
        }
      : {}),
  }
}

async function resolveModelCandidates(ai: GoogleGenAI): Promise<GeminiModelResolution[]> {
  const primary = await resolveModel(ai)
  const models = await getAvailableModels(ai)
  const ordered = [
    models.find((model) => model.id === primary.id),
    ...models.filter((model) => model.id !== primary.id),
  ].filter((model): model is GeminiModelInfo => Boolean(model))

  return ordered.slice(0, MAX_GENERATION_MODELS).map((model, index) => ({
    ...model,
    configuredModel: primary.configuredModel,
    usedFallback: primary.usedFallback || index > 0,
    compatibleModels: primary.compatibleModels,
    warning:
      index === 0
        ? primary.warning
        : `O modelo ${primary.id} ficou indisponível; ${model.id} foi usado como fallback.`,
  }))
}

export async function resolveGeminiModel(): Promise<GeminiModelResolution> {
  const apiKey = getApiKey()
  const ai = createClient(apiKey)

  try {
    return await resolveModel(ai)
  } catch (error) {
    throw toGeminiIntegrationError(error)
  }
}

function redactSecrets(message: string): string {
  let safeMessage = message
  const configuredKey = process.env.GEMINI_API_KEY?.trim()

  if (configuredKey) {
    safeMessage = safeMessage.split(configuredKey).join("[REDACTED]")
  }

  return safeMessage
    .replace(/AIza[0-9A-Za-z_-]{20,}/g, "AIza[REDACTED]")
    .replace(/([?&](?:key|api_key)=)[^&\s]+/gi, "$1[REDACTED]")
    .replace(/(x-goog-api-key\s*[:=]\s*)[^\s,;]+/gi, "$1[REDACTED]")
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Erro desconhecido ao acessar a Gemini."
}

function getUpstreamStatus(error: unknown): number | undefined {
  if (error instanceof ApiError) return error.status

  if (typeof error === "object" && error !== null && "status" in error) {
    const status = (error as { status?: unknown }).status
    return typeof status === "number" ? status : undefined
  }

  return undefined
}

function isTransientGenerationError(error: unknown): boolean {
  const status = getUpstreamStatus(error)
  if (status !== undefined && [500, 502, 503, 504].includes(status)) return true
  if (error instanceof TypeError) return true

  return (
    error instanceof DOMException &&
    (error.name === "AbortError" || error.name === "TimeoutError")
  )
}

function canTryAlternativeModel(error: unknown): boolean {
  const status = getUpstreamStatus(error)
  return status === 404 || status === 500 || status === 503
}

export function toGeminiIntegrationError(
  error: unknown,
  context: ErrorContext = {},
): GeminiIntegrationError {
  if (error instanceof GeminiIntegrationError) return error

  const upstreamStatus = getUpstreamStatus(error)
  const rawMessage = getErrorMessage(error)
  const technicalMessage = redactSecrets(rawMessage)
  const normalizedMessage = rawMessage.toLowerCase()
  const common = {
    upstreamStatus,
    technicalMessage,
    model: context.model,
    compatibleModels: context.compatibleModels,
  }

  if (
    error instanceof DOMException &&
    (error.name === "AbortError" || error.name === "TimeoutError")
  ) {
    return new GeminiIntegrationError({
      code: "TIMEOUT",
      message: "A Gemini demorou para responder. Tente novamente.",
      httpStatus: 504,
      ...common,
    })
  }

  if (
    normalizedMessage.includes("timeout") ||
    normalizedMessage.includes("timed out") ||
    normalizedMessage.includes("deadline exceeded") ||
    normalizedMessage.includes("aborted")
  ) {
    return new GeminiIntegrationError({
      code: "TIMEOUT",
      message: "A Gemini demorou para responder. Tente novamente.",
      httpStatus: 504,
      ...common,
    })
  }

  if (
    normalizedMessage.includes("api key not valid") ||
    normalizedMessage.includes("invalid api key") ||
    normalizedMessage.includes("api_key_invalid") ||
    normalizedMessage.includes("api key expired") ||
    normalizedMessage.includes("key was reported as leaked")
  ) {
    return new GeminiIntegrationError({
      code: "INVALID_API_KEY",
      message: "A GEMINI_API_KEY é inválida, expirou ou foi bloqueada. Configure uma nova chave.",
      httpStatus: 401,
      ...common,
    })
  }

  if (upstreamStatus === 401) {
    return new GeminiIntegrationError({
      code: "AUTHENTICATION_ERROR",
      message: "A API Gemini recusou a autenticação da requisição.",
      httpStatus: 401,
      ...common,
    })
  }

  if (
    normalizedMessage.includes("service_disabled") ||
    normalizedMessage.includes("api has not been used") ||
    normalizedMessage.includes("api is disabled") ||
    normalizedMessage.includes("enable it by visiting")
  ) {
    return new GeminiIntegrationError({
      code: "API_NOT_ENABLED",
      message:
        "A API Gemini/Generative Language não está habilitada para o projeto desta chave.",
      httpStatus: 403,
      ...common,
    })
  }

  if (
    upstreamStatus === 404 ||
    (normalizedMessage.includes("model") &&
      (normalizedMessage.includes("not found") ||
        normalizedMessage.includes("not supported") ||
        normalizedMessage.includes("not available")))
  ) {
    const modelMessage = context.model
      ? `O modelo ${context.model} não foi encontrado ou não está disponível para esta chave.`
      : "O modelo solicitado não foi encontrado ou não está disponível para esta chave."
    const alternatives = context.compatibleModels?.length
      ? ` Modelos de texto encontrados: ${context.compatibleModels.join(", ")}.`
      : ""

    return new GeminiIntegrationError({
      code: "MODEL_NOT_FOUND",
      message: `${modelMessage}${alternatives}`,
      httpStatus: 502,
      ...common,
    })
  }

  if (upstreamStatus === 429 && normalizedMessage.includes("quota")) {
    return new GeminiIntegrationError({
      code: "QUOTA_EXCEEDED",
      message: "A quota da Gemini foi excedida. Aguarde a renovação da quota e tente novamente.",
      httpStatus: 429,
      ...common,
    })
  }

  if (
    upstreamStatus === 429 ||
    normalizedMessage.includes("resource_exhausted") ||
    normalizedMessage.includes("rate limit")
  ) {
    return new GeminiIntegrationError({
      code: "RATE_LIMITED",
      message: "O limite de requisições da Gemini foi excedido. Aguarde e tente novamente.",
      httpStatus: 429,
      ...common,
    })
  }

  if (upstreamStatus === 403) {
    return new GeminiIntegrationError({
      code: "FORBIDDEN",
      message:
        "A GEMINI_API_KEY não tem permissão para a API Gemini. Verifique as restrições da chave e do projeto.",
      httpStatus: 403,
      ...common,
    })
  }

  if (upstreamStatus === 400) {
    return new GeminiIntegrationError({
      code: "BAD_REQUEST",
      message: "A solicitação enviada à Gemini é inválida. Verifique os dados e tente novamente.",
      httpStatus: 400,
      ...common,
    })
  }

  if (upstreamStatus === 500) {
    return new GeminiIntegrationError({
      code: "GEMINI_INTERNAL_ERROR",
      message: "A API Gemini retornou um erro interno HTTP 500.",
      httpStatus: 502,
      ...common,
    })
  }

  if (upstreamStatus === 503) {
    return new GeminiIntegrationError({
      code: "GEMINI_SERVICE_UNAVAILABLE",
      message: "A API Gemini retornou HTTP 503 após retries e fallbacks limitados.",
      httpStatus: 503,
      ...common,
    })
  }

  if (upstreamStatus !== undefined && upstreamStatus >= 500) {
    return new GeminiIntegrationError({
      code: "UPSTREAM_ERROR",
      message: `A API Gemini retornou HTTP ${upstreamStatus}.`,
      httpStatus: 502,
      ...common,
    })
  }

  if (error instanceof TypeError) {
    return new GeminiIntegrationError({
      code: "NETWORK_ERROR",
      message: "Não foi possível conectar ao serviço da Gemini.",
      httpStatus: 502,
      ...common,
    })
  }

  return new GeminiIntegrationError({
    code: "INTERNAL_ERROR",
    message: "Ocorreu um erro interno ao consultar a Gemini. Tente novamente.",
    httpStatus: 500,
    ...common,
  })
}

export function getSafeGeminiLog(error: GeminiIntegrationError) {
  return {
    code: error.code,
    upstreamStatus: error.upstreamStatus,
    message: error.technicalMessage,
    model: error.model,
    compatibleModels: error.compatibleModels,
  }
}

function isUnsupportedStructuredOutput(error: unknown): boolean {
  const status = getUpstreamStatus(error)
  const message = getErrorMessage(error).toLowerCase()

  return (
    status === 400 &&
    (message.includes("responsejsonschema") ||
      message.includes("response_json_schema") ||
      message.includes("response schema") ||
      message.includes("response_schema"))
  )
}

async function requestText(
  ai: GoogleGenAI,
  resolution: GeminiModelResolution,
  prompt: string,
  options: GenerateTextOptions,
  includeSchema: boolean,
): Promise<string> {
  const timeout = createTimeout(options.timeoutMs ?? DEFAULT_TIMEOUT_MS)
  const requestedTokens = options.maxOutputTokens ?? 12_000
  const maxOutputTokens = resolution.outputTokenLimit
    ? Math.min(requestedTokens, resolution.outputTokenLimit)
    : requestedTokens

  const config: GenerateContentConfig = {
    abortSignal: timeout.signal,
    temperature: options.temperature ?? 0.4,
    maxOutputTokens,
    ...(options.responseJson
      ? {
          responseMimeType: "application/json",
          ...(includeSchema
            ? { responseJsonSchema: options.responseJsonSchema || BNCC_PLAN_JSON_SCHEMA }
            : {}),
        }
      : {}),
  }

  try {
    const response = await ai.models.generateContent({
      model: resolution.id,
      contents: prompt,
      config,
    })
    const text = response.text?.trim()

    if (!text) {
      throw new GeminiIntegrationError({
        code: "EMPTY_RESPONSE",
        message: "A Gemini retornou uma resposta vazia. Tente novamente.",
        httpStatus: 502,
        technicalMessage: "A resposta não continha texto.",
        model: resolution.id,
        compatibleModels: resolution.compatibleModels,
      })
    }

    return text
  } finally {
    timeout.clear()
  }
}

async function requestTextWithFormatFallback(
  ai: GoogleGenAI,
  resolution: GeminiModelResolution,
  prompt: string,
  options: GenerateTextOptions,
): Promise<string> {
  try {
    return await requestText(ai, resolution, prompt, options, true)
  } catch (error) {
    if (!options.responseJson || !isUnsupportedStructuredOutput(error)) throw error
    return await requestText(ai, resolution, prompt, options, false)
  }
}

export async function generateGeminiTextResult(
  prompt: string,
  options: GenerateTextOptions = {},
): Promise<GeminiTextResult> {
  if (!prompt.trim()) {
    throw new GeminiIntegrationError({
      code: "BAD_REQUEST",
      message: "O prompt enviado à Gemini está vazio.",
      httpStatus: 400,
    })
  }

  const apiKey = getApiKey()
  const ai = createClient(apiKey)
  let candidates: GeminiModelResolution[]

  try {
    candidates = await resolveModelCandidates(ai)
  } catch (error) {
    throw toGeminiIntegrationError(error)
  }

  let lastError: unknown
  let lastResolution = candidates[0]

  for (const resolution of candidates) {
    lastResolution = resolution

    for (let attempt = 0; attempt < GENERATION_RETRY_DELAYS_MS.length; attempt += 1) {
      const delayMs = GENERATION_RETRY_DELAYS_MS[attempt]
      if (delayMs > 0) await wait(delayMs)

      try {
        const text = await requestTextWithFormatFallback(ai, resolution, prompt, options)
        return {
          text,
          model: resolution.id,
          configuredModel: resolution.configuredModel,
          usedFallback: resolution.usedFallback,
          compatibleModels: resolution.compatibleModels,
          warning: resolution.warning,
        }
      } catch (error) {
        lastError = error
        const hasAnotherAttempt = attempt < GENERATION_RETRY_DELAYS_MS.length - 1

        if (isTransientGenerationError(error) && hasAnotherAttempt) continue
        if (canTryAlternativeModel(error)) break

        throw toGeminiIntegrationError(error, {
          model: resolution.id,
          compatibleModels: resolution.compatibleModels,
        })
      }
    }
  }

  throw toGeminiIntegrationError(lastError, {
    model: lastResolution?.id,
    compatibleModels: lastResolution?.compatibleModels,
  })
}

export async function generateGeminiText(
  prompt: string,
  options: GenerateTextOptions = {},
): Promise<string> {
  const result = await generateGeminiTextResult(prompt, options)
  return result.text
}

export async function generateStructuredWithGemini<T>(
  prompt: string,
  schema: unknown,
  validator: (value: unknown) => value is T,
  formatName: string,
  maxOutputTokens = 16_000,
): Promise<T> {
  const text = await generateGeminiText(prompt, {
    responseJson: true,
    responseJsonSchema: schema,
    maxOutputTokens,
  })

  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    throw new GeminiIntegrationError({
      code: "PARSE_ERROR",
      message: "A resposta da Gemini não pôde ser interpretada. Tente novamente.",
      httpStatus: 502,
      technicalMessage: `A resposta de ${formatName} não era um JSON válido.`,
    })
  }

  if (!validator(parsed)) {
    throw new GeminiIntegrationError({
      code: "PARSE_ERROR",
      message: `A resposta da Gemini não corresponde ao formato ${formatName}. Tente novamente.`,
      httpStatus: 502,
      technicalMessage: `O JSON retornado não corresponde ao schema de ${formatName}.`,
    })
  }

  return parsed
}

export async function generateWithGemini(prompt: string): Promise<LessonPlanContent> {
  return generateStructuredWithGemini(
    prompt,
    BNCC_PLAN_JSON_SCHEMA,
    isLessonPlanContent,
    "plano de aula legado",
  )
}
