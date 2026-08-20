"use client"

import { useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Check, Loader2 } from "lucide-react"

interface PricingCardsProps {
  currentPlan: "FREE" | "PROFESSOR" | "PREMIUM"
  isAuthenticated: boolean
  config: {
    free: { price: string; limit: number; imageLimit: number }
    professor: { price: string; limit: number; imageLimit: number }
    premium: { price: string; limit: number; imageLimit: number }
  }
}

export function PricingCards({ currentPlan, isAuthenticated, config }: PricingCardsProps) {
  const [loadingPlan, setLoadingPlan] = useState<"professor" | "premium" | null>(null)
  const [error, setError] = useState("")

  const plans = [
    {
      id: "free",
      name: "Teste Grátis",
      price: config.free.price,
      description: "Para conhecer o BNCC Planner",
      features: [
        `${config.free.limit} planos de aula gratuitos no total`,
        `${config.free.imageLimit} imagens geradas no total`,
        "Não exige cartão",
        "Alinhamento automático à BNCC",
        "Acesso ao histórico e exportação",
      ],
      cta: "Começar grátis",
      popular: false,
    },
    {
      id: "professor",
      name: "Professor",
      price: config.professor.price,
      description: "Assinatura recorrente para uso individual",
      features: [
        `${config.professor.limit} gerações de texto por período`,
        `${config.professor.imageLimit} gerações de imagem por período`,
        "Alinhamento automático à BNCC",
        "Exportação PDF e Word",
        "Histórico completo",
        "Renovação gerenciada pela Kiwify",
      ],
      cta: "Assinar Plano Professor",
      popular: true,
    },
    {
      id: "premium",
      name: "Premium",
      price: config.premium.price,
      description: "Maior limite para professores com uso intensivo",
      features: [
        `${config.premium.limit} gerações de texto por período`,
        `${config.premium.imageLimit} gerações de imagem por período`,
        "Todos os recursos do Professor",
        "Maior capacidade mensal",
        "Exportação PDF e Word",
        "Prioridade para novos recursos",
        "Renovação gerenciada pela Kiwify",
      ],
      cta: "Assinar Plano Premium",
      popular: false,
    },
  ] as const

  const handleSubscribe = async (plan: "professor" | "premium") => {
    if (!isAuthenticated) {
      window.location.href = "/login"
      return
    }

    setLoadingPlan(plan)
    setError("")

    try {
      const response = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan }),
      })
      const data: { url?: string; error?: string } = await response.json().catch(() => ({}))

      if (!response.ok || !data.url) {
        setError(data.error || "Não foi possível abrir o checkout da Kiwify.")
        return
      }

      window.location.href = data.url
    } catch {
      setError("Não foi possível conectar ao checkout. Tente novamente.")
    } finally {
      setLoadingPlan(null)
    }
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="max-w-2xl mx-auto p-3 text-sm text-red-800 bg-red-50 border border-red-200 rounded-lg">
          {error}
        </div>
      )}
      <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
        {plans.map((plan) => {
          const planCode = plan.id.toUpperCase()
          const isCurrent = currentPlan === planCode
          const isDowngrade = currentPlan === "PREMIUM" && plan.id === "professor"

          return (
            <Card
              id={plan.id}
              key={plan.id}
              className={`relative scroll-mt-24 ${plan.popular ? "border-primary shadow-lg" : ""}`}
            >
              {plan.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <Badge className="px-3 py-1">Mais popular</Badge>
                </div>
              )}
              <CardHeader className="text-center pb-2">
                <CardTitle>{plan.name}</CardTitle>
                <CardDescription>{plan.description}</CardDescription>
                <div className="mt-4">
                  <span className="text-3xl font-bold">{plan.price}</span>
                </div>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2 text-sm">
                      <Check className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                      {feature}
                    </li>
                  ))}
                </ul>
              </CardContent>
              <CardFooter>
                {plan.id === "free" ? (
                  <Button className="w-full" variant="outline" asChild>
                    <Link href={isAuthenticated ? "/dashboard" : "/register"}>
                      {isAuthenticated ? "Ir para o dashboard" : plan.cta}
                    </Link>
                  </Button>
                ) : (
                  <Button
                    className="w-full"
                    variant={plan.popular ? "default" : "outline"}
                    onClick={() => handleSubscribe(plan.id)}
                    disabled={loadingPlan !== null || isCurrent || isDowngrade}
                  >
                    {loadingPlan === plan.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    {isCurrent
                      ? "Plano ativo"
                      : isDowngrade
                        ? "Premium já ativo"
                        : currentPlan === "PROFESSOR" && plan.id === "premium"
                          ? "Fazer upgrade para Premium"
                          : plan.cta}
                  </Button>
                )}
              </CardFooter>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
