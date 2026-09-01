import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import {
  generateGeminiTextResult,
  getSafeGeminiLog,
  toGeminiIntegrationError,
} from "@/lib/gemini"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET() {
  if (process.env.NODE_ENV === "production") {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ success: false, error: "Não autorizado." }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true },
    })
    if (user?.role !== "SUPER_ADMIN") {
      return NextResponse.json({ success: false, error: "Acesso restrito." }, { status: 403 })
    }
  }

  // Nenhum segredo é exposto: apenas presença da chave, nunca o valor.
  const apiKeyConfigured = Boolean(process.env.GEMINI_API_KEY?.trim())
  const configuredModel = process.env.GEMINI_MODEL?.trim() || null
  const startedAt = Date.now()

  try {
    const result = await generateGeminiTextResult(
      "Responda apenas: Gemini funcionando.",
      {
        timeoutMs: 30_000,
        maxOutputTokens: 256,
        temperature: 0,
      },
    )

    return NextResponse.json({
      success: true,
      apiKeyConfigured,
      configuredModel,
      effectiveModel: result.model,
      usedFallback: result.usedFallback,
      elapsedMs: Date.now() - startedAt,
      message: result.text,
      ...(result.warning ? { warning: result.warning } : {}),
      compatibleModels: result.compatibleModels,
    })
  } catch (error) {
    const geminiError = toGeminiIntegrationError(error)
    console.error("[api/test-gemini] Falha na Gemini:", getSafeGeminiLog(geminiError))

    return NextResponse.json(
      {
        success: false,
        apiKeyConfigured,
        configuredModel,
        elapsedMs: Date.now() - startedAt,
        code: geminiError.code,
        error: geminiError.message,
        ...(geminiError.upstreamStatus !== undefined
          ? { upstreamStatus: geminiError.upstreamStatus }
          : {}),
        ...(geminiError.model ? { model: geminiError.model } : {}),
        ...(geminiError.compatibleModels?.length
          ? { compatibleModels: geminiError.compatibleModels }
          : {}),
      },
      { status: geminiError.httpStatus },
    )
  }
}
