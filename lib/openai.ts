import "server-only"

import OpenAI from "openai"
import { isLessonPlanContent, type LessonPlanContent } from "@/lib/bncc-plan"

// Timeout controlado para o fallback OpenAI: cada requisição não pode passar de
// 45s e o SDK não faz retries automáticos (o fluxo de fallback já decide isso).
const OPENAI_TIMEOUT_MS = 45_000

export async function generateStructuredWithOpenAI<T>(
  prompt: string,
  validator: (value: unknown) => value is T,
  formatName: string,
): Promise<T> {
  const apiKey = process.env.OPENAI_API_KEY?.trim()
  if (!apiKey) throw new Error("OPENAI_API_KEY não configurada.")

  const client = new OpenAI({ apiKey, timeout: OPENAI_TIMEOUT_MS, maxRetries: 0 })
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
