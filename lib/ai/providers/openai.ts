import "server-only"

import { generateStructuredWithOpenAI } from "@/lib/openai"
import type {
  ImageAIProvider,
  StructuredGenerationRequest,
  TextAIProvider,
} from "@/lib/ai/providers/types"

export const openAITextProvider: TextAIProvider = {
  id: "openai",
  generateStructured<T>(request: StructuredGenerationRequest<T>) {
    request.onModel?.("gpt-4o")
    return generateStructuredWithOpenAI(
      request.prompt,
      request.validator,
      request.formatName,
      request.timeoutMs,
    )
  },
}

export const openAIImageProvider: ImageAIProvider = {
  id: "openai",
  async generate() {
    throw new Error(
      "Provedor de imagens OpenAI ainda não configurado. Use IMAGE_PROVIDER=huggingface ou gemini.",
    )
  },
}
