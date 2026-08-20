import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { getAccessSnapshot } from "@/lib/access"
import { getPlanDisplayConfig } from "@/lib/plans"
import { PricingCards } from "@/components/PricingCards"

export default async function AssinaturaPage() {
  const session = await getServerSession(authOptions)
  const access = session ? await getAccessSnapshot(session.user.id) : null
  const config = getPlanDisplayConfig()

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16 space-y-12">
      <div className="text-center space-y-4">
        <h1 className="text-4xl font-bold">Planos do BNCC Planner</h1>
        <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
          Comece com 2 planos gratuitos e escolha a assinatura ideal quando precisar continuar.
        </p>
      </div>

      <PricingCards
        currentPlan={access?.plan || "FREE"}
        isAuthenticated={Boolean(session)}
        config={config}
      />

      <div className="text-center text-sm text-muted-foreground max-w-3xl mx-auto">
        Checkout, cobrança recorrente, renovação, cancelamento e reembolso são processados pela Kiwify.
        O acesso só é liberado depois da confirmação segura enviada pelo webhook da Kiwify.
      </div>
    </div>
  )
}
