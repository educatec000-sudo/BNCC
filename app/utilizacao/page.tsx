import { getServerSession } from "next-auth"
import { redirect } from "next/navigation"
import Link from "next/link"
import { BarChart3, CalendarClock, CreditCard, ImageIcon, Pencil, Sparkles } from "lucide-react"
import { authOptions } from "@/lib/auth"
import { getAccessSnapshot } from "@/lib/access"
import { prisma } from "@/lib/prisma"
import { Button } from "@/components/ui/button"

const planLabels = { FREE: "Teste Grátis", PROFESSOR: "Professor", PREMIUM: "Premium" }

export default async function UsagePage() {
  const session = await getServerSession(authOptions)
  if (!session) redirect("/login")

  const [access, total, operations] = await Promise.all([
    getAccessSnapshot(session.user.id),
    prisma.lessonPlan.count({ where: { userId: session.user.id } }),
    prisma.materialOperation.groupBy({
      by: ["type", "usesAi"],
      where: { userId: session.user.id },
      _count: { _all: true },
      orderBy: { type: "asc" },
    }),
  ])
  const percentage = Math.min(100, Math.round((access.used / access.limit) * 100))
  const operationCount = (types: string[]) => operations
    .filter((operation) => types.includes(operation.type))
    .reduce((totalCount, operation) => totalCount + operation._count._all, 0)
  const textAiOperations = operationCount(["TEXT_GENERATION", "TEXT_REGENERATION", "TEXT_AI_IMPROVEMENT"])
  const imageAiOperations = operationCount(["IMAGE_GENERATION", "IMAGE_REGENERATION"])
  const manualOperations = operations
    .filter((operation) => !operation.usesAi)
    .reduce((totalCount, operation) => totalCount + operation._count._all, 0)

  return (
    <div className="mx-auto max-w-6xl space-y-8 px-4 py-8 sm:px-6 lg:px-8">
      <header>
        <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-primary">
          <BarChart3 className="h-5 w-5" /> Utilização
        </div>
        <h1 className="text-3xl font-bold tracking-tight">Acompanhe seu uso</h1>
        <p className="mt-2 text-muted-foreground">Limites claros e associados à sua conta.</p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          [Sparkles, "Gerações de texto", `${access.used} de ${access.limit}`],
          [Sparkles, "Gerações de imagem", `${access.imageUsed} de ${access.imageLimit}`],
          [CreditCard, "Plano", planLabels[access.plan]],
          [CalendarClock, "Planejamentos salvos", String(total)],
        ].map(([Icon, label, value]) => {
          const Component = Icon as typeof Sparkles
          return (
            <div key={String(label)} className="border bg-card p-5">
              <Component className="h-5 w-5 text-primary" />
              <p className="mt-4 text-sm text-muted-foreground">{String(label)}</p>
              <p className="mt-1 text-2xl font-bold">{String(value)}</p>
            </div>
          )
        })}
      </div>

      <section className="border bg-card p-6">
        <h2 className="text-lg font-semibold">Operações registradas</h2>
        <p className="mt-1 text-sm text-muted-foreground">Edição manual é auditada separadamente e nunca reduz seus créditos de IA.</p>
        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <div className="border p-4"><Sparkles className="h-5 w-5 text-primary" /><p className="mt-2 text-sm text-muted-foreground">Texto com IA</p><p className="text-xl font-bold">{textAiOperations}</p></div>
          <div className="border p-4"><ImageIcon className="h-5 w-5 text-sky-600" /><p className="mt-2 text-sm text-muted-foreground">Imagem com IA</p><p className="text-xl font-bold">{imageAiOperations}</p></div>
          <div className="border p-4"><Pencil className="h-5 w-5 text-emerald-600" /><p className="mt-2 text-sm text-muted-foreground">Operações sem IA</p><p className="text-xl font-bold">{manualOperations}</p></div>
        </div>
      </section>

      <section className="border bg-card p-6 sm:p-8">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
          <div>
            <h2 className="text-lg font-semibold">
              {access.plan === "FREE" ? "Gerações gratuitas" : "Período atual"}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {access.remaining} utilizações disponíveis
            </p>
          </div>
          <p className="text-sm font-semibold">{percentage}% utilizado</p>
        </div>
        <div className="mt-5 h-3 overflow-hidden bg-muted" role="progressbar" aria-valuenow={percentage} aria-valuemin={0} aria-valuemax={100} aria-label="Uso do plano">
          <div className="h-full bg-primary transition-[width]" style={{ width: `${percentage}%` }} />
        </div>
        <div className="mt-7 border-t pt-5">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium">Imagens geradas no período</span>
            <span>{access.imageUsed}/{access.imageLimit}</span>
          </div>
          <div className="mt-3 h-2 overflow-hidden bg-muted" role="progressbar" aria-valuenow={Math.min(100, Math.round((access.imageUsed / access.imageLimit) * 100))} aria-valuemin={0} aria-valuemax={100} aria-label="Uso de imagens">
            <div
              className="h-full bg-sky-600"
              style={{ width: `${Math.min(100, (access.imageUsed / access.imageLimit) * 100)}%` }}
            />
          </div>
          <p className="mt-2 text-xs text-muted-foreground">{access.imageRemaining} gerações de imagem disponíveis.</p>
        </div>
        {access.message && (
          <div className="mt-5 border-l-4 border-amber-500 bg-amber-50 p-4 text-sm text-amber-950">
            {access.message}
          </div>
        )}
        <div className="mt-6 flex flex-wrap gap-2">
          <Button asChild><Link href="/dashboard#criador">Novo planejamento</Link></Button>
          {access.plan !== "PREMIUM" && (
            <Button variant="outline" asChild><Link href="/assinatura">Ver planos</Link></Button>
          )}
        </div>
      </section>
    </div>
  )
}
