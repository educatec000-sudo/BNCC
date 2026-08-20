import { getServerSession } from "next-auth"
import { notFound, redirect } from "next/navigation"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { buildInitialEditorDocument, ensureEditorDocument } from "@/lib/editor-document.server"
import type { EditorAssetView } from "@/lib/editor-document"
import { DocumentRenderer } from "@/components/DocumentRenderer"
import { PrintDocumentActions } from "@/components/PrintDocumentActions"

export default async function CleanPrintPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ version?: string }>
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
  const useAdapted = query.version === "adapted" && Boolean(plan.adaptedContent)
  const editor = useAdapted
    ? { document: buildInitialEditorDocument({ ...plan, content: plan.adaptedContent, editorDocument: null }), version: 1 }
    : await ensureEditorDocument(plan)
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
  const pageSize = editor.document.page.size === "LETTER" ? "Letter" : "A4"
  const orientation = editor.document.page.orientation === "landscape" ? "landscape" : "portrait"

  return (
    <div className="min-h-screen bg-slate-200 print:bg-white">
      <style dangerouslySetInnerHTML={{ __html: `@media print { @page { size: ${pageSize} ${orientation}; margin: 0; } }` }} />
      <PrintDocumentActions planId={plan.id} />
      <div className="overflow-auto p-4 print:p-0">
        <DocumentRenderer document={editor.document} assets={assets} />
      </div>
    </div>
  )
}
