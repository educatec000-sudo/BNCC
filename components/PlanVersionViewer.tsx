"use client"

import { useState } from "react"
import Link from "next/link"
import { Accessibility, Edit3, FileText } from "lucide-react"
import { cn } from "@/lib/utils"
import { MaterialResult } from "@/components/MaterialResult"
import { PlanResult } from "@/components/PlanResult"
import { DocumentRenderer } from "@/components/DocumentRenderer"
import { Button } from "@/components/ui/button"
import { isPlanningContent, type PlanningContent } from "@/lib/planning-content"
import type { LessonPlanContent } from "@/lib/bncc-plan"
import type { MaterialImageView } from "@/lib/images/types"
import type { EditorAssetView, EditorDocument } from "@/lib/editor-document"

type StoredContent = PlanningContent | LessonPlanContent

interface PlanVersionViewerProps {
  planId: string
  original: StoredContent
  adapted?: StoredContent | null
  initialImages: MaterialImageView[]
  initialDocument: EditorDocument
  initialAssets: EditorAssetView[]
}

function AdaptedContentRenderer({
  content,
  images,
  onImagesChanged,
}: {
  content: StoredContent
  images: MaterialImageView[]
  onImagesChanged: () => void
}) {
  return isPlanningContent(content) ? (
    <MaterialResult content={content} images={images} onImagesChanged={onImagesChanged} />
  ) : (
    <PlanResult content={content as LessonPlanContent} />
  )
}

export function PlanVersionViewer({
  planId,
  adapted,
  initialImages,
  initialDocument,
  initialAssets,
}: PlanVersionViewerProps) {
  const [version, setVersion] = useState<"original" | "adapted">("original")
  const [images, setImages] = useState(initialImages)
  const [document, setDocument] = useState(initialDocument)
  const [assets, setAssets] = useState(initialAssets)

  const refreshImages = async () => {
    const [imagesResponse, documentResponse] = await Promise.all([
      fetch(`/api/plans/${planId}/images`),
      fetch(`/api/plans/${planId}/document`),
    ])
    const imageData: { images?: MaterialImageView[] } = await imagesResponse.json().catch(() => ({}))
    const documentData: { assets?: EditorAssetView[]; document?: EditorDocument } = await documentResponse.json().catch(() => ({}))
    if (imagesResponse.ok && imageData.images) setImages(imageData.images)
    if (documentResponse.ok && documentData.assets) setAssets(documentData.assets)
    if (documentResponse.ok && documentData.document) setDocument(documentData.document)
  }

  return (
    <div className="space-y-5">
      <div className="border-b print:hidden">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="flex gap-1" role="tablist" aria-label="Versões do planejamento">
            <button
              type="button"
              role="tab"
              aria-selected={version === "original"}
              onClick={() => setVersion("original")}
              className={cn(
                "flex min-h-11 items-center gap-2 border-b-2 px-4 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                version === "original" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              <FileText className="h-4 w-4" /> Material editado
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={version === "adapted"}
              disabled={!adapted}
              onClick={() => adapted && setVersion("adapted")}
              className={cn(
                "flex min-h-11 items-center gap-2 border-b-2 px-4 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-45",
                version === "adapted" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              <Accessibility className="h-4 w-4" /> Material Adaptado
            </button>
          </div>
          <div className="pb-2">
            <Button size="sm" variant="outline" asChild>
              <Link href={`/planos/${planId}/editar-conteudo`}><Edit3 className="mr-2 h-4 w-4" />Editar documento e imagens</Link>
            </Button>
          </div>
        </div>
        {!adapted && <p className="pb-3 pt-2 text-xs text-muted-foreground">Use “Adaptar para Inclusão” para criar uma versão acessível sem substituir a original.</p>}
      </div>

      <div role="tabpanel" aria-label={version === "adapted" ? "Material Adaptado" : "Material Editado"}>
        {version === "original" ? (
          <div className="overflow-auto bg-slate-200 p-2 sm:p-5">
            <DocumentRenderer document={document} assets={assets} />
          </div>
        ) : adapted ? (
          <AdaptedContentRenderer content={adapted} images={images} onImagesChanged={refreshImages} />
        ) : null}
      </div>
    </div>
  )
}
