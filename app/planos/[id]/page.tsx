import { getServerSession } from "next-auth"
import { redirect, notFound } from "next/navigation"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { PlanVersionViewer } from "@/components/PlanVersionViewer"
import { PlanActions } from "@/components/PlanActions"
import { PlanningStepper } from "@/components/PlanningStepper"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import type { LessonPlanContent } from "@/lib/bncc-plan"
import type { PlanningContent } from "@/lib/planning-content"
import { materialImageToView } from "@/lib/images/service"
import { ensureEditorDocument } from "@/lib/editor-document.server"
import type { EditorAssetView } from "@/lib/editor-document"

type StoredPlanningContent = PlanningContent | LessonPlanContent

export default async function PlanPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ notice?: string }>
}) {
  const session = await getServerSession(authOptions)
  if (!session) redirect("/login")

  const [{ id }, query] = await Promise.all([params, searchParams])
  const plan = await prisma.lessonPlan.findFirst({
    where: { id, userId: session.user.id },
    include: {
      images: {
        where: { status: { not: "DELETED" } },
        orderBy: [{ placementKey: "asc" }, { position: "asc" }],
      },
    },
  })
  if (!plan) notFound()

  const content = plan.content as unknown as StoredPlanningContent
  const adaptedContent = plan.adaptedContent as unknown as StoredPlanningContent | null
  const editor = await ensureEditorDocument(plan)
  const editorAssets: EditorAssetView[] = plan.images.map((image) => ({
    id: image.id,
    url: `/api/images/${image.id}?v=${image.version}`,
    originalUrl: `/api/images/${image.id}?version=1`,
    status: image.status,
    prompt: image.prompt,
    provider: image.provider,
    model: image.model,
    style: image.style,
    altText: image.altText,
    placementKey: image.placementKey,
    version: image.version,
    createdAt: image.createdAt.toISOString(),
    updatedAt: image.updatedAt.toISOString(),
  }))

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <PlanningStepper currentStep={7} maxAccessibleStep={7} />

      <div className="flex flex-col gap-4 print:hidden lg:flex-row lg:items-center lg:justify-between">
        <Button variant="ghost" asChild className="w-fit">
          <Link href="/dashboard" className="gap-2">
            <ArrowLeft className="h-4 w-4" /> Novo planejamento
          </Link>
        </Button>
        <PlanActions planId={plan.id} title={plan.title} content={content} />
      </div>

      {query.notice && (
        <div className="print:hidden p-4 bg-blue-50 border border-blue-200 rounded-lg text-blue-900">
          <p className="font-medium">{query.notice}</p>
          {query.notice.includes("2 planos gratuitos") && (
            <div className="flex flex-wrap gap-2 mt-3">
              <Button size="sm" asChild>
                <Link href="/assinatura#professor">Assinar Plano Professor</Link>
              </Button>
              <Button size="sm" variant="outline" asChild>
                <Link href="/assinatura#premium">Assinar Plano Premium</Link>
              </Button>
            </div>
          )}
        </div>
      )}

      <div className="space-y-3 print:block">
        <div className="flex flex-wrap items-center gap-2 print:hidden">
          <Badge>{plan.planningType}</Badge>
          <Badge variant="secondary">{plan.educationStage}</Badge>
          <Badge variant="outline">{plan.subject}</Badge>
          <Badge variant="outline">{plan.grade}</Badge>
          <Badge variant={plan.inclusionMode === "REGULAR" ? "outline" : "default"}>
            {plan.inclusionMode === "REGULAR" ? "DUA · Turma regular" : "Planejamento inclusivo"}
          </Badge>
          <Badge variant="secondary">{plan.status === "COMPLETED" ? "Salvo" : plan.status}</Badge>
        </div>
        <div>
          <h1 className="text-2xl font-bold mb-1">{plan.title}</h1>
          <p className="text-sm"><strong>Assunto:</strong> {plan.topic}</p>
          <p className="text-muted-foreground text-sm print:hidden">
            Atualizado em {new Date(plan.updatedAt).toLocaleDateString("pt-BR", { dateStyle: "full" })}
          </p>
        </div>
      </div>

      <PlanVersionViewer
        planId={plan.id}
        original={content}
        adapted={adaptedContent}
        initialImages={plan.images.map(materialImageToView)}
        initialDocument={editor.document}
        initialAssets={editorAssets}
      />
    </div>
  )
}
