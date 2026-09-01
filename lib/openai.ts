import "server-only"

import OpenAI from "openai"
import { isLessonPlanContent, type LessonPlanContent } from "@/lib/bncc-plan"

// Timeout controlado para o fallback OpenAI: cada requisição não pode passar de
// 45s e o SDK não faz retries automáticos (o fluxo de fallback já decide isso).
const OPENAI_TIMEOUT_MS = 45_000
const MAX_OPENAI_TIMEOUT_MS = 120_000

export async function generateStructuredWithOpenAI<T>(
  prompt: string,
  validator: (value: unknown) => value is T,
  formatName: string,
  timeoutMs?: number,
): Promise<T> {
  const apiKey = process.env.OPENAI_API_KEY?.trim()
  if (!apiKey) throw new Error("OPENAI_API_KEY não configurada.")

  const resolvedTimeout = Number.isFinite(timeoutMs) && timeoutMs && timeoutMs > 0
    ? Math.min(Math.max(timeoutMs, 10_000), MAX_OPENAI_TIMEOUT_MS)
    : OPENAI_TIMEOUT_MS
  const client = new OpenAI({ apiKey, timeout: resolvedTimeout, maxRetries: 0 })
  const response = await client.chat.completions.create({
    model: "gpt-4o",
    messages: [{ role: "user", content: prompt }],
    response_format: { type: "json_object" },
  })

  const text = response.choices[0]?.message.content
  if (!text) throw new Error("A OpenAI retornou uma resposta vazia.")

  const parsed: unknown = JSON.parse(text)
  if (!validator(parsed)) {
    throw new Error(`A OpenAI retornou conteúdo incompatível com ${formatName}.`)
  }
  return parsed
}

export async function generateWithOpenAI(prompt: string): Promise<LessonPlanContent> {
  return generateStructuredWithOpenAI(
    prompt,
    isLessonPlanContent,
    "plano de aula legado",
  )
}
