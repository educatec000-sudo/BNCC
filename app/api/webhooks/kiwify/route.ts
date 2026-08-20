import { NextRequest, NextResponse } from "next/server"
import {
  parseKiwifyPayload,
  verifyKiwifySignature,
} from "@/lib/kiwify"
import { processKiwifyWebhook } from "@/lib/kiwify-webhook"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function HEAD() {
  return new NextResponse(null, { status: 200 })
}

export async function POST(req: NextRequest) {
  const rawBody = await req.text()
  if (rawBody.length > 1_000_000) {
    return NextResponse.json({ error: "Payload muito grande." }, { status: 413 })
  }

  let payload
  try {
    payload = parseKiwifyPayload(JSON.parse(rawBody))
  } catch {
    return NextResponse.json({ error: "Payload JSON inválido." }, { status: 400 })
  }

  const signature = req.nextUrl.searchParams.get("signature")
  try {
    if (!verifyKiwifySignature(payload, signature)) {
      console.warn("[webhook/kiwify] Assinatura HMAC-SHA1 inválida; evento rejeitado.")
      return NextResponse.json({ error: "Assinatura inválida." }, { status: 401 })
    }
  } catch {
    console.error("[webhook/kiwify] KIWIFY_WEBHOOK_TOKEN não configurada.")
    return NextResponse.json({ error: "Webhook não configurado." }, { status: 503 })
  }

  try {
    const result = await processKiwifyWebhook(payload)
    return NextResponse.json({
      received: true,
      duplicate: result.duplicate,
      eventId: result.eventId,
      eventType: result.eventType,
    })
  } catch (error) {
    const errorName = error instanceof Error ? error.name : "UnknownError"
    console.error(`[webhook/kiwify] Falha ao processar evento válido (${errorName}).`)
    return NextResponse.json(
      { error: "Evento válido recebido, mas não pôde ser processado." },
      { status: 500 },
    )
  }
}
