import { getServerSession } from "next-auth"
import { notFound, redirect } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, FileText } from "lucide-react"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { ensureEditorDocument } from "@/lib/editor-document.server"
import { PrintPreview } from "@/components/PrintPreview"
import { Button } from "@/components/ui/button"

export default async function PrintPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session) redirect("/login")

  const { id } = await params
  const plan = await prisma.lessonPlan.findFirst({
    where: { id, userId: session.user.id },
    include: {
      images: {
        where: { status: "READY", imageData: { not: null } },
        orderBy: [{ placementKey: "asc" }, { position: "asc" }],
      },
    },
  })
  if (!plan) notFound()

  const editor = await ensureEditorDocument(plan)
  const recommendedOrientation = editor.document.page.orientation

  return (
    <div className="mx-auto max-w-[1500px] space-y-6 px-4 py-8 sm:px-6 lg:px-8">
      <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-primary">
            <FileText className="h-5 w-5" /> Documento pedagógico
          </div>
          <h1 className="text-2xl font-bold">Visualizar impressão</h1>
          <p className="mt-1 text-sm text-muted-foreground">{plan.title}</p>
        </div>
        <Button variant="outline" asChild>
          <Link href={`/planos/${plan.id}`}>
            <ArrowLeft className="mr-2 h-4 w-4" /> Voltar ao resultado
          </Link>
        </Button>
      </header>

      <PrintPreview
        planId={plan.id}
        initialTeacher={session.user.name || ""}
        hasAdaptedVersion={Boolean(plan.adaptedContent)}
        recommendedOrientation={recommendedOrientation}
      />
    </div>
  )
}
