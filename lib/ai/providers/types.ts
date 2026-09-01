export interface StructuredGenerationRequest<T> {
  prompt: string
  schema: unknown
  validator: (value: unknown) => value is T
  formatName: string
  maxOutputTokens?: number
  /** Limite de tempo da requisição ao provedor, em ms. */
  timeoutMs?: number
  /** Informa o modelo efetivamente usado (para logs), assim que resolvido. */
  onModel?: (model: string) => void
}

export interface TextAIProvider {
  id: "gemini" | "openai"
  generateStructured<T>(request: StructuredGenerationRequest<T>): Promise<T>
}

export interface ImageGenerationRequest {
  prompt: string
  aspectRatio?: "1:1" | "4:3" | "3:4" | "16:9" | "9:16"
}

export interface GeneratedImage {
  data: Buffer
  mimeType: string
  provider: string
  model: string
  responseText?: string
}

export interface ImageAIProvider {
  id: "gemini" | "huggingface" | "openai"
  generate(request: ImageGenerationRequest): Promise<GeneratedImage>
}
