import "server-only"

import { randomUUID } from "node:crypto"
import { Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import {
  buildPlanningDocumentModel,
  type DocumentBlock,
  type PlanningDocumentModel,
} from "@/lib/document-model"
import {
  EDITOR_DOCUMENT_SCHEMA_VERSION,
  escapeEditorText,
  sanitizeEditorDocument,
  type EditorDocument,
  type EditorElement,
} from "@/lib/editor-document"

export interface EditorPlanRecord {
  id?: string
  userId?: string
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

function id(prefix: string) {
  return `${prefix}-${randomUUID()}`
}

function blockElements(block: DocumentBlock): EditorElement[] {
  if (block.type === "paragraph") {
    return [{
      id: id("paragraph"),
      type: "paragraph",
      content: escapeEditorText(block.text),
      style: block.bold ? { bold: true } : undefined,
    }]
  }
  if (block.type === "bullets" || block.type === "numbered") {
    return [{
      id: id("list"),
      type: "list",
      ordered: block.type === "numbered",
      items: block.items.map(escapeEditorText),
    }]
  }
  if (block.type === "table") {
    return [{
      id: id("table"),
      type: "table",
      headers: block.headers.map(escapeEditorText),
      rows: block.rows.map((row) => row.map(escapeEditorText)),
    }]
  }
  if (block.type === "image") {
    if (!block.image.assetId) return []
    return [{
      id: id("image"),
      type: "image",
      assetId: block.image.assetId,
      widthPercent: block.image.widthPercent,
      alignment: "center",
    }]
  }
  return block.questions.map((question) => ({
    id: id("question"),
    type: "question" as const,
    number: question.numero,
    content: escapeEditorText(question.enunciado),
    alternatives: question.alternativas.map((alternative) => ({
      id: id("alternative"),
      content: escapeEditorText(alternative),
    })),
    responseLines: question.alternativas.length > 0 ? 0 : 2,
    images: block.images
      .filter((image) => image.placementKey === `question:${question.numero}` && image.assetId)
      .map((image) => ({
        assetId: image.assetId!,
        widthPercent: image.widthPercent,
        alignment: "center" as const,
      })),
  }))
}

export function buildInitialEditorDocument(plan: EditorPlanRecord): EditorDocument {
  const model = buildPlanningDocumentModel(plan)
  return editorDocumentFromPlanningModel(model)
}

export function editorDocumentFromPlanningModel(model: PlanningDocumentModel): EditorDocument {
  const subject = model.identificationFields.find((field) => field.label === "Área/Disciplina")?.value || ""
  const topic = model.topic
  return {
    schemaVersion: EDITOR_DOCUMENT_SCHEMA_VERSION,
    title: escapeEditorText(model.title),
    topic,
    subtitle: model.subtitle,
    page: {
      size: "A4",
      orientation: model.recommendedOrientation,
      marginTop: 20,
      marginRight: 18,
      marginBottom: 20,
      marginLeft: 18,
      defaultFontFamily: "Arial",
      defaultFontSize: 11,
      lineHeight: 1.5,
    },
    header: {
      visible: true,
      fields: [
        { id: "school", label: "NOME DA ESCOLA", value: "", visible: true },
        { id: "student", label: "ALUNO(A)", value: "", visible: true },
        { id: "class", label: "TURMA", value: "", visible: true },
        { id: "teacher", label: "PROFESSOR(A)", value: "", visible: true },
        { id: "subject", label: "DISCIPLINA", value: subject, visible: true },
        { id: "date", label: "DATA", value: "", visible: true },
        { id: "topic", label: "ASSUNTO", value: topic, visible: true },
      ],
    },
    footer: {
      visible: true,
      showPageNumber: true,
      showSchoolName: false,
      showMaterialName: false,
      customText: "",
    },
    sections: model.sections.map((section) => ({
      id: id("section"),
      title: escapeEditorText(section.title),
      pageBreakBefore: section.pageBreakBefore,
      elements: section.blocks.flatMap(blockElements),
    })),
  }
}

export async function ensureEditorDocument(plan: EditorPlanRecord & { id: string; userId: string }) {
  const saved = sanitizeEditorDocument(plan.editorDocument)
  if (saved) return { document: saved, version: plan.editorVersion || 1 }

  const document = buildInitialEditorDocument(plan)
  const serialized = document as unknown as Prisma.InputJsonValue
  const version = Math.max(1, plan.editorVersion || 1)
  const updated = await prisma.lessonPlan.updateMany({
    where: { id: plan.id, userId: plan.userId, editorDocument: { equals: Prisma.DbNull } },
    data: { editorDocument: serialized, editorVersion: version, editorUpdatedAt: new Date() },
  })
  if (updated.count > 0) {
    await prisma.documentRevision.create({
      data: {
        lessonPlanId: plan.id,
        userId: plan.userId,
        version,
        document: serialized,
        changeType: "INITIAL_GENERATION",
      },
    }).catch(() => undefined)
  }
  return { document, version }
}

export async function rebuildEditorDocumentFromSource(input: {
  lessonPlanId: string
  userId: string
  changeType?: string
}) {
  const plan = await prisma.lessonPlan.findFirst({
    where: { id: input.lessonPlanId, userId: input.userId },
    include: {
      images: {
        where: { status: "READY", imageData: { not: null } },
        orderBy: [{ placementKey: "asc" }, { position: "asc" }],
      },
    },
  })
  if (!plan) throw new Error("Material não encontrado.")
  const document = buildInitialEditorDocument(plan)
  const serialized = document as unknown as Prisma.InputJsonValue
  const existingDocument = sanitizeEditorDocument(plan.editorDocument)
  const nextVersion = existingDocument ? plan.editorVersion + 1 : 1

  await prisma.$transaction([
    prisma.lessonPlan.update({
      where: { id: plan.id },
      data: {
        editorDocument: serialized,
        editorVersion: nextVersion,
        editorUpdatedAt: new Date(),
      },
    }),
    prisma.documentRevision.upsert({
      where: { lessonPlanId_version: { lessonPlanId: plan.id, version: nextVersion } },
      update: { document: serialized, changeType: input.changeType || "INITIAL_GENERATION" },
      create: {
        lessonPlanId: plan.id,
        userId: input.userId,
        version: nextVersion,
        document: serialized,
        changeType: input.changeType || "INITIAL_GENERATION",
      },
    }),
  ])

  return { document, version: nextVersion }
}
