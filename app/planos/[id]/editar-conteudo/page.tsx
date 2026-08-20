import { getServerSession } from "next-auth"
import { notFound, redirect } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, Edit3, ShieldCheck } from "lucide-react"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { ensureEditorDocument } from "@/lib/editor-document.server"
import type { EditorAssetView } from "@/lib/editor-document"
import { StructuredContentEditor } from "@/components/StructuredContentEditor"
import { Button } from "@/components/ui/button"

export default async function EditContentPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session) redirect("/login")

  const { id } = await params
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
  const editor = await ensureEditorDocument(plan)
  const assets: EditorAssetView[] = plan.images.map((image) => ({
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
    <div className="mx-auto max-w-[1700px] space-y-6 px-4 py-6 sm:px-6 lg:px-8">
      <header className="app-header flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-primary">
            <Edit3 className="h-5 w-5" /> Editor visual do material
          </div>
          <h1 className="text-2xl font-bold">{plan.title}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{plan.topic}</p>
          <p className="mt-2 flex items-center gap-2 text-xs text-emerald-700">
            <ShieldCheck className="h-4 w-4" /> Alterações manuais e salvamento automático não consomem créditos de IA.
          </p>
        </div>
        <Button variant="outline" asChild>
          <Link href={`/planos/${plan.id}`}>
            <ArrowLeft className="mr-2 h-4 w-4" /> Voltar ao resultado
          </Link>
        </Button>
      </header>

      <StructuredContentEditor
        planId={plan.id}
        initialDocument={editor.document}
        initialAssets={assets}
        initialVersion={editor.version}
      />
    </div>
  )
}
