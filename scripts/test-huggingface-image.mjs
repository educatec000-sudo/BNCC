import fs from 'node:fs/promises'
import dotenv from 'dotenv'
import { InferenceClient } from '@huggingface/inference'

dotenv.config({ path: '.env.local', quiet: true })
dotenv.config({ path: '.env', quiet: true })

const token = process.env.HUGGINGFACE_API_KEY?.trim()
const model = process.env.IMAGE_MODEL?.trim() || 'black-forest-labs/FLUX.1-schnell'
const provider = process.env.HUGGINGFACE_INFERENCE_PROVIDER?.trim() || 'auto'

async function main() {
  if (!token) {
    console.error(JSON.stringify({ success: false, code: 'MISSING_HUGGINGFACE_API_KEY', error: 'HUGGINGFACE_API_KEY não configurada.' }, null, 2))
    process.exitCode = 1
    return
  }

  try {
    const client = new InferenceClient(token)
    const blob = await client.textToImage({
      model,
      provider: provider,
      inputs:
        'Educational illustration of the Solar System for fifth-grade students, clean light background, Sun and planets in orbit, no watermark, no tiny text.',
      parameters: {
        width: 1024,
        height: 768,
        num_inference_steps: model.includes('schnell') ? 4 : 20,
        negative_prompt: 'watermark, logo, illegible text, clutter, low resolution',
      },
    })
    const buffer = Buffer.from(await blob.arrayBuffer())
    const mimeType = blob.type || 'image/png'
    const extension = mimeType.includes('jpeg') ? 'jpg' : mimeType.includes('webp') ? 'webp' : 'png'
    const path = `image-test-output-hf.${extension}`
    await fs.writeFile(path, buffer)
    console.log(JSON.stringify({ success: true, provider: 'huggingface', inferenceProvider: provider, model, mimeType, bytes: buffer.length, path }, null, 2))
  } catch (error) {
    const status = typeof error?.status === 'number' ? error.status : null
    const raw = error instanceof Error ? error.message.replaceAll(token, '[REDACTED]') : 'Erro desconhecido'
    const code = status === 401 || status === 403
      ? 'HUGGINGFACE_AUTH_ERROR'
      : status === 402 || status === 429
        ? 'HUGGINGFACE_QUOTA_OR_CREDIT_ERROR'
        : status === 404
          ? 'HUGGINGFACE_MODEL_NOT_AVAILABLE'
          : 'HUGGINGFACE_IMAGE_ERROR'
    console.error(JSON.stringify({ success: false, code, provider: 'huggingface', inferenceProvider: provider, model, status, error: raw.slice(0, 700) }, null, 2))
    process.exitCode = 1
  }
}

await main()
if (process.platform === 'win32') await new Promise((resolve) => setTimeout(resolve, 250))
