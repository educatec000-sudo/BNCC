import fs from 'node:fs/promises'
import dotenv from 'dotenv'
import { ApiError, GoogleGenAI } from '@google/genai'

dotenv.config({ path: '.env.local', quiet: true })
dotenv.config({ path: '.env', quiet: true })

const apiKey = process.env.GEMINI_API_KEY?.trim()
const model = process.env.GEMINI_IMAGE_MODEL?.trim() || 'gemini-2.5-flash-image'

function safeApiError(error) {
  const status = error instanceof ApiError ? error.status : typeof error?.status === 'number' ? error.status : null
  const raw = error instanceof Error ? error.message.replaceAll(apiKey || '', '[REDACTED]') : 'Erro desconhecido'
  let originalMessage = raw
  let apiStatus = null
  try {
    const parsed = JSON.parse(raw)
    originalMessage = parsed?.error?.message || raw
    apiStatus = parsed?.error?.status || null
  } catch {
    // A mensagem não veio no envelope JSON da API.
  }

  if (status === 429 && /limit:\s*0/i.test(originalMessage)) {
    return {
      success: false,
      code: 'IMAGE_QUOTA_UNAVAILABLE',
      model,
      status,
      apiStatus,
      error:
        'O projeto desta chave possui quota zero para geração de imagens. Habilite faturamento/quota no Google AI Studio ou use outro projeto com acesso ao modelo.',
      action: 'Abra https://ai.dev/rate-limit, confira a quota do modelo e depois execute novamente npm run test:gemini-image.',
      originalMessage: originalMessage.slice(0, 700),
    }
  }
  if (status === 429) {
    return {
      success: false,
      code: 'IMAGE_RATE_LIMITED',
      model,
      status,
      apiStatus,
      error: 'A quota ou o limite de requisições de imagem foi atingido. Aguarde e tente novamente.',
      originalMessage: originalMessage.slice(0, 700),
    }
  }
  if (status === 401 || /api key not valid/i.test(originalMessage)) {
    return { success: false, code: 'INVALID_API_KEY', model, status, error: 'GEMINI_API_KEY inválida.' }
  }
  if (status === 404) {
    return {
      success: false,
      code: 'IMAGE_MODEL_NOT_AVAILABLE',
      model,
      status,
      error: 'O modelo de imagem não está disponível para esta chave/projeto.',
      originalMessage: originalMessage.slice(0, 700),
    }
  }
  return {
    success: false,
    code: 'IMAGE_GENERATION_ERROR',
    model,
    status,
    apiStatus,
    error: originalMessage.slice(0, 700),
  }
}

async function main() {
  if (!apiKey) {
    console.error(
      JSON.stringify(
        { success: false, code: 'MISSING_API_KEY', error: 'GEMINI_API_KEY não configurada.' },
        null,
        2,
      ),
    )
    process.exitCode = 1
    return
  }

  try {
    const client = new GoogleGenAI({ apiKey, apiVersion: 'v1beta', vertexai: false })
    const response = await client.models.generateContent({
      model,
      contents:
        'Crie uma ilustração educacional limpa do Sistema Solar para estudantes do 5º ano, mostrando Sol, órbitas e planetas, sem texto pequeno e sem marca d água.',
    })
    const parts = response.candidates?.[0]?.content?.parts || []
    const part = parts.find((item) => item.inlineData?.data)
    if (!part?.inlineData?.data) throw new Error('A API não retornou dados de imagem.')

    const mimeType = part.inlineData.mimeType || 'image/png'
    const extension = mimeType.includes('jpeg') ? 'jpg' : mimeType.includes('webp') ? 'webp' : 'png'
    const path = `image-test-output.${extension}`
    const buffer = Buffer.from(part.inlineData.data, 'base64')
    await fs.writeFile(path, buffer)
    console.log(JSON.stringify({ success: true, model, mimeType, bytes: buffer.length, path }, null, 2))
  } catch (error) {
    console.error(JSON.stringify(safeApiError(error), null, 2))
    process.exitCode = 1
  }
}

await main()
if (process.platform === 'win32') await new Promise((resolve) => setTimeout(resolve, 250))
