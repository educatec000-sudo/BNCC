import { getServerSession } from "next-auth"
import { redirect } from "next/navigation"
import Link from "next/link"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { getAccessSnapshot } from "@/lib/access"
import { findPlanningSelectionIds } from "@/lib/planning-options"
import { isInclusionMode, sanitizePedagogicalProfile } from "@/lib/inclusion-options"
import { isImageMode, isImageStyle } from "@/lib/image-options"
import { PlanningWizard, type PlanningWizardInitialData } from "@/components/PlanningWizard"
import { Badge } from "@/components/ui/badge"
import {
  Accessibility,
  ArrowRight,
  BookMarked,
  BookOpen,
  History,
  Plus,
  Sparkles,
} from "lucide-react"

const PLAN_LABELS = {
  FREE: "TESTE GRÁTIS",
  PROFESSOR: "PROFESSOR",
  PREMIUM: "PREMIUM",
} as const

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ payment?: string; edit?: string; inclusive?: string }>
}) {
  const session = await getServerSession(authOptions)
  if (!session) redirect("/login")

  const query = await searchParams
  const userId = session.user.id
  const access = await getAccessSnapshot(userId)
  const [totalPlans, recentPlans, editingPlan] = await Promise.all([
    prisma.lessonPlan.count({ where: { userId } }),
    prisma.lessonPlan.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: {
        id: true,
        title: true,
        planningType: true,
        subject: true,
        grade: true,
        createdAt: true,
      },
    }),
    query.edit
      ? prisma.lessonPlan.findFirst({
          where: { id: query.edit, userId },
          select: {
            id: true,
            educationStage: true,
            subject: true,
            grade: true,
            planningType: true,
            inclusionMode: true,
            inclusionNeeds: true,
            accessibilityResources: true,
            pedagogicalProfile: true,
            imageMode: true,
            imageStyle: true,
            coloringPage: true,
            accessibleImages: true,
            generateAltText: true,
            topic: true,
            request: true,
            additionalPreferences: true,
          },
        })
      : Promise.resolve(null),
  ])

  let initialData: PlanningWizardInitialData | undefined
  if (editingPlan) {
    const ids = findPlanningSelectionIds({
      stage: editingPlan.educationStage,
      area: editingPlan.subject,
      grade: editingPlan.grade,
      planningType: editingPlan.planningType,
    })
    if (ids) {
      initialData = {
        planId: editingPlan.id,
        ...ids,
        inclusionMode: isInclusionMode(editingPlan.inclusionMode)
          ? editingPlan.inclusionMode
          : "REGULAR",
        inclusionNeeds: Array.isArray(editingPlan.inclusionNeeds)
          ? editingPlan.inclusionNeeds.filter((item): item is string => typeof item === "string")
          : [],
        accessibilityResources: Array.isArray(editingPlan.accessibilityResources)
          ? editingPlan.accessibilityResources.filter(
              (item): item is string => typeof item === "string",
            )
          : [],
        pedagogicalProfile: sanitizePedagogicalProfile(editingPlan.pedagogicalProfile) || {},
        imageMode: isImageMode(editingPlan.imageMode) ? editingPlan.imageMode : "NONE",
        imageStyle: isImageStyle(editingPlan.imageStyle) ? editingPlan.imageStyle : "EDUCATIONAL",
        coloringPage: editingPlan.coloringPage,
        accessibleImages: editingPlan.accessibleImages,
        generateAltText: editingPlan.generateAltText,
        topic: editingPlan.topic,
        request: editingPlan.request,
        additionalPreferences: editingPlan.additionalPreferences || "",
      }
    }
  } else if (query.inclusive === "true") {
    initialData = { inclusionMode: "INCLUSIVE_CLASS" }
  }

  const isPaid = access.plan !== "FREE"
  const usageLabel =
    access.plan === "FREE"
      ? `${access.used}/${access.limit} gratuitos usados`
      : `${access.used}/${access.limit} neste período`

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {query.payment === "processing" && (
        <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg text-blue-800 font-medium">
          Pagamento recebido pela Kiwify. O acesso será liberado assim que o webhook confirmar a compra.
        </div>
      )}

      {query.edit && !editingPlan && (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg text-amber-900 font-medium">
          O planejamento solicitado para edição não foi encontrado ou não pertence à sua conta.
        </div>
      )}

      {access.message && (
        <div className={`p-4 border rounded-lg ${access.canGenerate ? "bg-amber-50 border-amber-200 text-amber-900" : "bg-red-50 border-red-200 text-red-900"}`}>
          <p className="font-medium">{access.message}</p>
          {access.upgradeRequired && (
            <Link href="/assinatura" className="inline-block mt-2 font-semibold underline">
              Ver planos Professor e Premium →
            </Link>
          )}
        </div>
      )}

      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-3xl font-bold">
            {editingPlan ? "Editar planejamento" : `Olá, ${session.user?.name?.split(" ")[0]}!`}
          </h1>
          <p className="text-muted-foreground mt-1">
            {editingPlan
              ? "Revise as escolhas e gere uma nova versão sem perder o contexto."
              : "Construa seu planejamento passo a passo com apoio da IA."}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Badge variant={isPaid ? "default" : "secondary"} className="text-sm px-3 py-1">
            {PLAN_LABELS[access.plan]} · {usageLabel}
          </Badge>
          {access.plan !== "PREMIUM" && (
            <Link href="/assinatura" className="text-sm text-primary font-medium hover:underline">
              {access.plan === "PROFESSOR" ? "Fazer upgrade →" : "Assinar →"}
            </Link>
          )}
        </div>
      </div>

      <div className="grid sm:grid-cols-3 gap-4">
        {[
          { label: access.plan === "FREE" ? "Uso do teste" : "Uso no período", value: `${access.used}/${access.limit}`, icon: Sparkles },
          { label: "Planejamentos salvos", value: totalPlans, icon: BookOpen },
          { label: "Plano atual", value: PLAN_LABELS[access.plan], icon: History },
        ].map(({ label, value, icon: Icon }) => (
          <div key={label} className="p-4 rounded-lg border bg-card flex items-center gap-4">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Icon className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold">{value}</p>
              <p className="text-sm text-muted-foreground">{label}</p>
            </div>
          </div>
        ))}
      </div>

      <section aria-labelledby="quick-actions-title">
        <div className="mb-3 flex items-center justify-between">
          <h2 id="quick-actions-title" className="text-lg font-semibold">Ações rápidas</h2>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {[
            {
              href: "#criador",
              label: "Novo Planejamento",
              description: "Iniciar o fluxo guiado",
              icon: Plus,
            },
            {
              href: "/historico",
              label: "Meus Planejamentos",
              description: "Abrir histórico e versões",
              icon: History,
            },
            {
              href: "/inclusao",
              label: "Adaptar para Inclusão",
              description: "DUA e acessibilidade",
              icon: Accessibility,
            },
            {
              href: "/bncc",
              label: "Explorar BNCC",
              description: "Etapas, áreas e competências",
              icon: BookMarked,
            },
          ].map(({ href, label, description, icon: Icon }) => (
            <Link
              key={label}
              href={href}
              className="group flex min-h-24 items-center gap-4 border bg-card p-4 transition-all hover:border-primary/40 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center bg-primary/10 text-primary">
                <Icon className="h-5 w-5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold">{label}</span>
                <span className="block text-xs text-muted-foreground">{description}</span>
              </span>
              <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
            </Link>
          ))}
        </div>
      </section>

      <div id="criador" className="scroll-mt-6">
        <PlanningWizard
          initialAccess={{ canGenerate: access.canGenerate, message: access.message }}
          initialData={initialData}
        />
      </div>

      {recentPlans.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold">Planejamentos recentes</h2>
            <Link href="/historico" className="text-sm text-primary hover:underline">Ver todos →</Link>
          </div>
          <div className="space-y-2">
            {recentPlans.map((plan) => (
              <Link key={plan.id} href={`/planos/${plan.id}`} className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 hover:border-primary/50 transition-all">
                <div>
                  <p className="font-medium">{plan.title}</p>
                  <p className="text-sm text-muted-foreground">
                    {plan.planningType} · {plan.subject} · {plan.grade}
                  </p>
                </div>
                <p className="text-sm text-muted-foreground">
                  {new Date(plan.createdAt).toLocaleDateString("pt-BR")}
                </p>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
