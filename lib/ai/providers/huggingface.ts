import "server-only"

import { InferenceClient } from "@huggingface/inference"
import type {
  GeneratedImage,
  ImageAIProvider,
  ImageGenerationRequest,
} from "@/lib/ai/providers/types"

const DEFAULT_MODEL = "black-forest-labs/FLUX.1-schnell"

function imageDimensions(aspectRatio: ImageGenerationRequest["aspectRatio"]) {
  if (aspectRatio === "1:1") return { width: 1024, height: 1024 }
  if (aspectRatio === "3:4") return { width: 768, height: 1024 }
  if (aspectRatio === "16:9") return { width: 1024, height: 576 }
  if (aspectRatio === "9:16") return { width: 576, height: 1024 }
  return { width: 1024, height: 768 }
}

export const huggingFaceImageProvider: ImageAIProvider = {
  id: "huggingface",
  async generate(request: ImageGenerationRequest): Promise<GeneratedImage> {
    const token = process.env.HUGGINGFACE_API_KEY?.trim()
    if (!token) throw new Error("HUGGINGFACE_API_KEY não configurada.")

    const model = process.env.IMAGE_MODEL?.trim() || DEFAULT_MODEL
    const provider = process.env.HUGGINGFACE_INFERENCE_PROVIDER?.trim() || "auto"
    const client = new InferenceClient(token)
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 120_000)
    timer.unref?.()

    try {
      const dimensions = imageDimensions(request.aspectRatio)
      const blob = await client.textToImage(
        {
          model,
          provider: provider as "auto",
          inputs: request.prompt,
          parameters: {
            ...dimensions,
            num_inference_steps: model.includes("schnell") ? 4 : 20,
            negative_prompt:
              "watermark, logo, illegible text, distorted anatomy, cluttered composition, low resolution",
          },
        },
        {
          signal: controller.signal,
          retry_on_error: true,
        },
      )
      const data = Buffer.from(await blob.arrayBuffer())
      if (data.length === 0) throw new Error("Hugging Face retornou imagem vazia.")

      return {
        data,
        mimeType: blob.type || "image/png",
        provider: "huggingface",
        model,
      }
    } catch (error) {
      const status =
        typeof error === "object" && error !== null && "status" in error
          ? String((error as { status?: unknown }).status)
          : ""
      const message = error instanceof Error ? error.message : "Falha desconhecida"
      throw new Error(
        `Hugging Face/FLUX falhou${status ? ` (HTTP ${status})` : ""}: ${message}`,
      )
    } finally {
      clearTimeout(timer)
    }
  },
}
