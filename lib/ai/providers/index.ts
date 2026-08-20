import "server-only"

import { geminiImageProvider, geminiTextProvider } from "@/lib/ai/providers/gemini"
import { huggingFaceImageProvider } from "@/lib/ai/providers/huggingface"
import { openAIImageProvider, openAITextProvider } from "@/lib/ai/providers/openai"
import type { ImageAIProvider, TextAIProvider } from "@/lib/ai/providers/types"

export function getTextAIProvider(): TextAIProvider {
  const provider = process.env.AI_PROVIDER?.trim().toLowerCase() || "gemini"
  if (provider === "gemini") return geminiTextProvider
  if (provider === "openai") return openAITextProvider
  throw new Error(`AI_PROVIDER não suportado: ${provider}.`)
}

export function getFallbackTextAIProvider(primary: TextAIProvider): TextAIProvider | null {
  if (primary.id === "gemini" && process.env.OPENAI_API_KEY?.trim()) return openAITextProvider
  if (primary.id === "openai" && process.env.GEMINI_API_KEY?.trim()) return geminiTextProvider
  return null
}

function imageProviderById(provider: string): ImageAIProvider {
  if (provider === "huggingface") return huggingFaceImageProvider
  if (provider === "gemini") return geminiImageProvider
  if (provider === "openai") return openAIImageProvider
  throw new Error(`IMAGE_PROVIDER não suportado: ${provider}.`)
}

export function getImageAIProvider(): ImageAIProvider {
  const provider =
    process.env.IMAGE_PROVIDER?.trim().toLowerCase() ||
    process.env.AI_IMAGE_PROVIDER?.trim().toLowerCase() ||
    "huggingface"
  return imageProviderById(provider)
}

export function getImageAIProviders(): ImageAIProvider[] {
  const primary = getImageAIProvider()
  const enabled = process.env.IMAGE_FALLBACK_ENABLED?.trim().toLowerCase() !== "false"
  if (!enabled) return [primary]

  const configuredFallback = process.env.IMAGE_FALLBACK_PROVIDER?.trim().toLowerCase()
  const candidates: ImageAIProvider[] = [primary]
  const add = (provider: ImageAIProvider) => {
    if (!candidates.some((item) => item.id === provider.id)) candidates.push(provider)
  }

  if (configuredFallback) {
    add(imageProviderById(configuredFallback))
  } else if (primary.id === "huggingface" && process.env.GEMINI_API_KEY?.trim()) {
    add(geminiImageProvider)
  } else if (primary.id === "gemini" && process.env.HUGGINGFACE_API_KEY?.trim()) {
    add(huggingFaceImageProvider)
  }

  return candidates
}

export type { GeneratedImage, ImageGenerationRequest } from "@/lib/ai/providers/types"
