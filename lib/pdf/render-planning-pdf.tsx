import "server-only"

import { renderToBuffer } from "@react-pdf/renderer"
import { buildInitialEditorDocument } from "@/lib/editor-document.server"
import { documentAssetIds, sanitizeEditorDocument } from "@/lib/editor-document"
import { EditorPdfDocument, type ResolvedEditorAsset } from "@/lib/pdf/EditorPdfDocument"
import { imageBytesForPdf } from "@/lib/images/normalize"

export interface PdfPlanRecord {
  id?: string
  title: string
  topic: string
  educationStage: string
  subject: string
  grade: string
  planningType: string
  request: string
  content: unknown
  editorDocument?: unknown
  editorVersion?: number
  images?: {
    id: string
    placementKey: string
    position: number
    widthPercent: number
    mimeType: string | null
    imageData: Uint8Array | null
    altText: string | null
  }[]
}

function cleanMetadata(value: string | null | undefined): string | undefined {
  const cleaned = value?.replace(/[\r\n\t]+/g, " ").trim().slice(0, 120)
  return cleaned || undefined
}

export async function renderPlanningPdf(options: {
  plan: PdfPlanRecord
  school?: string | null
  teacher?: string | null
  orientation?: "portrait" | "landscape"
}) {
  const document = sanitizeEditorDocument(options.plan.editorDocument) || buildInitialEditorDocument(options.plan)
  const referencedIds = documentAssetIds(document)
  const assets: ResolvedEditorAsset[] = []
  for (const image of options.plan.images || []) {
    if (!referencedIds.has(image.id) || !image.imageData || !image.mimeType) continue
    try {
      const normalized = await imageBytesForPdf(image.imageData, image.mimeType)
      assets.push({
        id: image.id,
        data: normalized.data,
        format: normalized.format,
        altText: image.altText || "Imagem educacional",
      })
    } catch (error) {
      const errorName = error instanceof Error ? error.name : "UnknownError"
      console.error(`[pdf] Asset ${image.id} inválido (${errorName}).`)
    }
  }
  const orientation = options.orientation || document.page.orientation
  const buffer = await renderToBuffer(
    <EditorPdfDocument
      document={document}
      assets={assets}
      school={cleanMetadata(options.school)}
      teacher={cleanMetadata(options.teacher)}
      orientation={orientation}
    />,
  )

  return { buffer, document, orientation, embeddedAssetCount: assets.length }
}

function filenamePart(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 60)
}

export function buildPdfFilename(plan: PdfPlanRecord): string {
  const parts = [plan.planningType, plan.subject, plan.topic, plan.grade]
    .map(filenamePart)
    .filter(Boolean)
  return `${parts.join("_") || "Planejamento_Pedagogico"}.pdf`
}
