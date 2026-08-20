import "server-only"

import { GoogleGenAI } from "@google/genai"
import { generateStructuredWithGemini } from "@/lib/gemini"
import type {
  GeneratedImage,
  ImageAIProvider,
  ImageGenerationRequest,
  StructuredGenerationRequest,
  TextAIProvider,
} from "@/lib/ai/providers/types"

const IMAGE_MODEL = process.env.GEMINI_IMAGE_MODEL?.trim() || "gemini-2.5-flash-image"

export const geminiTextProvider: TextAIProvider = {
  id: "gemini",
  generateStructured<T>(request: StructuredGenerationRequest<T>) {
    return generateStructuredWithGemini(
      request.prompt,
      request.schema,
      request.validator,
      request.formatName,
      request.maxOutputTokens,
    )
  },
}

export const geminiImageProvider: ImageAIProvider = {
  id: "gemini",
  async generate(request: ImageGenerationRequest): Promise<GeneratedImage> {
    const apiKey = process.env.GEMINI_API_KEY?.trim()
    if (!apiKey) throw new Error("GEMINI_API_KEY não configurada.")

    const client = new GoogleGenAI({ apiKey, apiVersion: "v1beta", vertexai: false })
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 120_000)
    timer.unref?.()

    try {
      const response = await client.models.generateContent({
        model: IMAGE_MODEL,
        contents: `${request.prompt}\n\nProporção desejada: ${request.aspectRatio || "4:3"}. Gere uma única imagem, sem marca d'água.`,
        config: { abortSignal: controller.signal },
      })
      const parts = response.candidates?.[0]?.content?.parts || []
      const imagePart = parts.find((part) => Boolean(part.inlineData?.data))
      const data = imagePart?.inlineData?.data
      if (!data) {
        const reason = response.promptFeedback?.blockReason || "IMAGE_NOT_RETURNED"
        throw new Error(`A Gemini não retornou imagem (${reason}).`)
      }

      return {
        data: Buffer.from(data, "base64"),
        mimeType: imagePart.inlineData?.mimeType || "image/png",
        provider: "gemini",
        model: IMAGE_MODEL,
        responseText: parts.map((part) => part.text).filter(Boolean).join(" ") || undefined,
      }
    } finally {
      clearTimeout(timer)
    }
  },
}
