import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { createCheckoutState } from "@/lib/kiwify"
import { getKiwifyCheckoutUrl, isPaidPlanSlug } from "@/lib/plans"

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
  }

  let body: { plan?: unknown }
  try {
    body = (await req.json()) as { plan?: unknown }
  } catch {
    return NextResponse.json({ error: "JSON inválido." }, { status: 400 })
  }

  if (!isPaidPlanSlug(body.plan)) {
    return NextResponse.json({ error: "Plano inválido." }, { status: 400 })
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, name: true, email: true },
  })
  if (!user) return NextResponse.json({ error: "Usuário não encontrado." }, { status: 404 })

  try {
    const checkout = new URL(getKiwifyCheckoutUrl(body.plan))
    checkout.searchParams.set("email", user.email)
    if (user.name) checkout.searchParams.set("name", user.name)
    checkout.searchParams.set("s1", createCheckoutState(user.id))

    return NextResponse.json({ url: checkout.toString() })
  } catch {
    console.error(`[api/checkout] Checkout Kiwify do plano ${body.plan} não configurado.`)
    return NextResponse.json({ error: "Checkout Kiwify não configurado." }, { status: 503 })
  }
}
