import dotenv from 'dotenv'
import { ApiError, GoogleGenAI } from '@google/genai'

dotenv.config({ path: '.env.local', quiet: true })
dotenv.config({ path: '.env', quiet: true })

const API_VERSION = 'v1beta'
const API_BASE_URL = 'https://generativelanguage.googleapis.com'
const API_NAME = 'Gemini Developer API'
const SDK_NAME = '@google/genai'
const LIST_ONLY = process.argv.includes('--list')
const MAX_MODELS_TO_TEST = 4
const RETRY_DELAYS_MS = [0, 750, 2_000]
const PREFERRED_MODEL_IDS = [
  'gemini-flash-latest',
  'gemini-3.6-flash',
  'gemini-3.5-flash',
  'gemini-flash-lite-latest',
  'gemini-3.5-flash-lite',
  'gemini-2.5-flash',
  'gemini-2.5-flash-lite',
]
const NON_TEXT_MODEL_MARKERS = [
  'audio',
  'computer-use',
  'customtools',
  'embedding',
  'image',
  'imagen',
  'live',
  'lyria',
  'omni',
  'robotics',
  'tts',
  'veo',
]

function listEndpoint() {
  return `${API_BASE_URL}/${API_VERSION}/models`
}

function generateEndpoint(model) {
  return `${API_BASE_URL}/${API_VERSION}/models/${model}:generateContent`
}

function normalizeModelId(name = '') {
  return name.replace(/^models\//, '').trim()
}

function supportsTextGeneration(model) {
  const id = normalizeModelId(model.name).toLowerCase()
  const actions = model.supportedActions ?? []

  return (
    id.startsWith('gemini-') &&
    actions.includes('generateContent') &&
    !NON_TEXT_MODEL_MARKERS.some((marker) => id.includes(marker))
  )
}

function modelScore(model) {
  const id = model.id.toLowerCase()
  const preferredIndex = PREFERRED_MODEL_IDS.indexOf(id)
  if (preferredIndex >= 0) return 10_000 - preferredIndex

  const version = id.match(/^gemini-(\d+)(?:\.(\d+))?/)
  const major = version ? Number(version[1]) : 0
  const minor = version?.[2] ? Number(version[2]) : 0
  let score = major * 100 + minor * 10

  if (id.includes('flash')) score += 1_000
  if (id.includes('pro')) score += 500
  if (id.includes('latest')) score += 300
  if (id.includes('lite')) score -= 100
  if (id.includes('preview')) score -= 500
  if (id.includes('experimental') || id.includes('exp-')) score -= 800

  return score
}

function sortModels(models) {
  return [...models].sort((a, b) => {
    const scoreDifference = modelScore(b) - modelScore(a)
    return scoreDifference || b.id.localeCompare(a.id)
  })
}

function createTimeout(timeoutMs) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  timer.unref?.()

  return {
    signal: controller.signal,
    clear: () => clearTimeout(timer),
  }
}

function wait(delayMs) {
  return new Promise((resolve) => setTimeout(resolve, delayMs))
}

function redactSecrets(value, apiKey) {
  let safeValue = String(value || '')
  if (apiKey) safeValue = safeValue.split(apiKey).join('[REDACTED]')

  return safeValue
    .replace(/AIza[0-9A-Za-z_-]{20,}/g, 'AIza[REDACTED]')
    .replace(/([?&](?:key|api_key)=)[^&\s]+/gi, '$1[REDACTED]')
    .replace(/(x-goog-api-key\s*[:=]\s*)[^\s,;]+/gi, '$1[REDACTED]')
}

function getStatus(error) {
  if (error instanceof ApiError) return error.status
  return typeof error?.status === 'number' ? error.status : undefined
}

function getRawMessage(error) {
  return error instanceof Error ? error.message : String(error || '')
}

function parseOriginalApiMessage(error, apiKey) {
  const rawMessage = redactSecrets(getRawMessage(error), apiKey)

  try {
    const parsed = JSON.parse(rawMessage)
    return {
      message: redactSecrets(parsed?.error?.message ?? rawMessage, apiKey),
      apiStatus: parsed?.error?.status,
      reasons: (parsed?.error?.details ?? [])
        .map((detail) => detail?.reason)
        .filter(Boolean),
    }
  } catch {
    return { message: rawMessage, apiStatus: undefined, reasons: [] }
  }
}

function classifyError(error, apiKey) {
  const status = getStatus(error)
  const original = parseOriginalApiMessage(error, apiKey)
  const message = original.message.toLowerCase()
  const reasons = original.reasons.map((reason) => String(reason).toLowerCase())

  if (
    message.includes('api key not valid') ||
    message.includes('invalid api key') ||
    message.includes('api_key_invalid') ||
    message.includes('api key expired') ||
    message.includes('key was reported as leaked') ||
    reasons.includes('api_key_invalid')
  ) {
    return { code: 'INVALID_API_KEY', error: 'A GEMINI_API_KEY é inválida, expirou ou foi bloqueada.', status }
  }

  if (status === 401) {
    return { code: 'AUTHENTICATION_ERROR', error: 'A API Gemini recusou a autenticação da requisição.', status }
  }

  if (
    message.includes('service_disabled') ||
    message.includes('api has not been used') ||
    message.includes('api is disabled') ||
    message.includes('enable it by visiting') ||
    reasons.includes('service_disabled')
  ) {
    return {
      code: 'API_NOT_ENABLED',
      error: 'A API Gemini/Generative Language não está habilitada para o projeto da chave.',
      status,
    }
  }

  if (
    status === 404 ||
    (message.includes('model') &&
      (message.includes('not found') ||
        message.includes('not supported') ||
        message.includes('not available')))
  ) {
    return { code: 'MODEL_NOT_FOUND', error: 'O modelo não está disponível para esta chave/API.', status }
  }

  if (status === 429 && (message.includes('quota') || reasons.includes('quota_exceeded'))) {
    return { code: 'QUOTA_EXCEEDED', error: 'A quota da Gemini foi excedida.', status }
  }

  if (
    status === 429 ||
    message.includes('resource_exhausted') ||
    message.includes('rate limit')
  ) {
    return { code: 'RATE_LIMITED', error: 'O limite de requisições da Gemini foi excedido.', status: status ?? 429 }
  }

  if (status === 403) {
    return {
      code: 'FORBIDDEN',
      error: 'A chave não tem permissão para a Gemini Developer API. Verifique suas restrições.',
      status,
    }
  }

  if (status === 500) {
    return { code: 'GEMINI_INTERNAL_ERROR', error: 'A API Gemini retornou um erro interno HTTP 500.', status }
  }

  if (status === 503) {
    return {
      code: 'GEMINI_SERVICE_UNAVAILABLE',
      error: 'A API Gemini retornou HTTP 503 (serviço indisponível ou modelo sobrecarregado).',
      status,
    }
  }

  if (status === 400) {
    return { code: 'BAD_REQUEST', error: 'A API Gemini rejeitou a configuração da solicitação.', status }
  }

  if (
    error instanceof DOMException &&
    (error.name === 'AbortError' || error.name === 'TimeoutError')
  ) {
    return { code: 'TIMEOUT', error: 'A API Gemini demorou para responder.', status }
  }

  if (
    error instanceof TypeError ||
    message.includes('fetch failed') ||
    message.includes('econnreset') ||
    message.includes('enotfound') ||
    message.includes('socket')
  ) {
    return { code: 'NETWORK_ERROR', error: 'Falha de rede ao acessar a API Gemini.', status }
  }

  if (status && status >= 500) {
    return { code: 'GEMINI_HTTP_ERROR', error: `A API Gemini retornou HTTP ${status}.`, status }
  }

  return { code: 'GEMINI_ERROR', error: 'Não foi possível concluir a chamada à API Gemini.', status }
}

function createDiagnostic({ error, apiKey, model, attempt, method }) {
  const classification = classifyError(error, apiKey)
  const original = parseOriginalApiMessage(error, apiKey)

  return {
    api: API_NAME,
    sdk: SDK_NAME,
    endpoint: method === 'models.list' ? listEndpoint() : generateEndpoint(model),
    method: method === 'models.list' ? 'ai.models.list' : 'ai.models.generateContent',
    model: model ?? null,
    attempt,
    status: classification.status ?? null,
    code: classification.code,
    originalApiStatus: original.apiStatus ?? null,
    originalMessage: original.message || 'Sem mensagem original.',
  }
}

function isRetryable(classification) {
  return [
    'GEMINI_INTERNAL_ERROR',
    'GEMINI_SERVICE_UNAVAILABLE',
    'GEMINI_HTTP_ERROR',
    'NETWORK_ERROR',
    'TIMEOUT',
  ].includes(classification.code)
}

function canTryNextModel(classification) {
  return [
    'MODEL_NOT_FOUND',
    'GEMINI_INTERNAL_ERROR',
    'GEMINI_SERVICE_UNAVAILABLE',
  ].includes(classification.code)
}

async function listTextModels(ai) {
  const timeout = createTimeout(30_000)

  try {
    const pager = await ai.models.list({
      config: {
        pageSize: 1_000,
        queryBase: true,
        abortSignal: timeout.signal,
      },
    })

    const models = []
    for await (const model of pager) {
      if (!supportsTextGeneration(model)) continue
      const id = normalizeModelId(model.name)
      models.push({
        id,
        displayName: model.displayName ?? id,
        outputTokenLimit: model.outputTokenLimit,
      })
    }

    return sortModels(models)
  } finally {
    timeout.clear()
  }
}

function selectCandidates(models, configuredModel) {
  const candidates = []
  const add = (model) => {
    if (model && !candidates.some((candidate) => candidate.id === model.id)) candidates.push(model)
  }

  if (configuredModel) add(models.find((model) => model.id === configuredModel))
  for (const preferredId of PREFERRED_MODEL_IDS) {
    add(models.find((model) => model.id === preferredId))
  }
  for (const model of models) add(model)

  return candidates.slice(0, MAX_MODELS_TO_TEST)
}

async function generateTestText(ai, model) {
  const timeout = createTimeout(45_000)

  try {
    const response = await ai.models.generateContent({
      model: model.id,
      contents: 'Responda apenas: Gemini funcionando.',
      config: {
        abortSignal: timeout.signal,
        maxOutputTokens: Math.min(256, model.outputTokenLimit ?? 256),
        temperature: 0,
      },
    })

    const message = response.text?.trim()
    if (!message) throw new Error('A Gemini retornou uma resposta vazia.')
    return message
  } finally {
    timeout.clear()
  }
}

async function main() {
  const apiKey = process.env.GEMINI_API_KEY?.trim()
  if (!apiKey) {
    console.error(
      JSON.stringify(
        {
          success: false,
          code: 'MISSING_API_KEY',
          error: 'GEMINI_API_KEY não configurada.',
          diagnostic: {
            api: API_NAME,
            sdk: SDK_NAME,
            endpoint: listEndpoint(),
            method: 'ai.models.list',
          },
        },
        null,
        2,
      ),
    )
    process.exitCode = 1
    return
  }

  const configuredValue = process.env.GEMINI_MODEL?.trim()
  const configuredModel = configuredValue ? normalizeModelId(configuredValue) : undefined
  const ai = new GoogleGenAI({ apiKey, apiVersion: API_VERSION, vertexai: false })
  let models

  try {
    models = await listTextModels(ai)
  } catch (error) {
    const classification = classifyError(error, apiKey)
    console.error(
      JSON.stringify(
        {
          success: false,
          ...classification,
          diagnostic: createDiagnostic({
            error,
            apiKey,
            model: null,
            attempt: 1,
            method: 'models.list',
          }),
        },
        null,
        2,
      ),
    )
    process.exitCode = 1
    return
  }

  const compatibleModels = models.map((model) => model.id)
  if (models.length === 0) {
    console.error(
      JSON.stringify(
        {
          success: false,
          code: 'NO_COMPATIBLE_MODEL',
          error: 'Nenhum modelo Gemini de texto com generateContent foi encontrado para esta chave.',
          compatibleModels,
        },
        null,
        2,
      ),
    )
    process.exitCode = 1
    return
  }

  const candidates = selectCandidates(models, configuredModel)
  const configuredAvailable = configuredModel
    ? models.some((model) => model.id === configuredModel)
    : false
  const configurationWarning =
    configuredModel && !configuredAvailable
      ? `O modelo configurado ${configuredModel} não está disponível e foi ignorado.`
      : undefined

  if (LIST_ONLY) {
    console.log(
      JSON.stringify(
        {
          success: true,
          api: API_NAME,
          sdk: SDK_NAME,
          endpoint: listEndpoint(),
          method: 'ai.models.list',
          configuredModel: configuredModel ?? null,
          selectedModel: candidates[0]?.id ?? null,
          testCandidates: candidates.map((model) => model.id),
          ...(configurationWarning ? { warning: configurationWarning } : {}),
          compatibleModels,
        },
        null,
        2,
      ),
    )
    return
  }

  const diagnostics = []
  let lastError
  let lastClassification

  for (const candidate of candidates) {
    for (let attemptIndex = 0; attemptIndex < RETRY_DELAYS_MS.length; attemptIndex += 1) {
      const attempt = attemptIndex + 1
      const delayMs = RETRY_DELAYS_MS[attemptIndex]
      if (delayMs > 0) await wait(delayMs)

      try {
        const message = await generateTestText(ai, candidate)
        diagnostics.push({
          api: API_NAME,
          sdk: SDK_NAME,
          endpoint: generateEndpoint(candidate.id),
          method: 'ai.models.generateContent',
          model: candidate.id,
          attempt,
          status: 200,
          code: 'SUCCESS',
          originalApiStatus: 'OK',
          originalMessage: message,
        })

        console.log(
          JSON.stringify(
            {
              success: true,
              model: candidate.id,
              message,
              ...(configurationWarning ? { warning: configurationWarning } : {}),
              attemptedModels: [...new Set(diagnostics.map((item) => item.model).filter(Boolean))],
              compatibleModels,
              diagnostics,
            },
            null,
            2,
          ),
        )
        return
      } catch (error) {
        const classification = classifyError(error, apiKey)
        diagnostics.push(
          createDiagnostic({
            error,
            apiKey,
            model: candidate.id,
            attempt,
            method: 'generateContent',
          }),
        )
        lastError = error
        lastClassification = classification

        if (classification.code === 'MODEL_NOT_FOUND') break
        if (isRetryable(classification) && attempt < RETRY_DELAYS_MS.length) continue
        if (canTryNextModel(classification)) break

        console.error(
          JSON.stringify(
            {
              success: false,
              ...classification,
              model: candidate.id,
              compatibleModels,
              diagnostics,
            },
            null,
            2,
          ),
        )
        process.exitCode = 1
        return
      }
    }
  }

  const finalClassification = lastClassification ?? classifyError(lastError, apiKey)
  console.error(
    JSON.stringify(
      {
        success: false,
        ...finalClassification,
        error:
          finalClassification.code === 'GEMINI_SERVICE_UNAVAILABLE'
            ? 'Todos os modelos testados continuaram retornando HTTP 503 após retries limitados.'
            : finalClassification.error,
        testedModels: candidates.map((model) => model.id),
        compatibleModels,
        diagnostics,
      },
      null,
      2,
    ),
  )
  process.exitCode = 1
}

await main()

// Evita encerrar o transporte HTTP durante o fechamento de handles do libuv no Windows.
if (process.platform === 'win32') {
  await wait(250)
}
