import {
  alternativeLetter,
  normalizeAlternativeText,
  normalizeAnswerLetter,
} from "@/lib/alternatives"
import { stripIdentificationLinesFromHtml } from "@/lib/identification"

export const EDITOR_DOCUMENT_SCHEMA_VERSION = 1 as const

export type PageSize = "A4" | "LETTER"
export type PageOrientation = "portrait" | "landscape"
export type TextAlignment = "left" | "center" | "right" | "justify"
export type ImageAlignment = "left" | "center" | "right"

export interface EditorTextStyle {
  fontFamily?: string
  fontSize?: number
  bold?: boolean
  italic?: boolean
  underline?: boolean
  color?: string
  alignment?: TextAlignment
  lineHeight?: number
  indent?: number
  spacingAfter?: number
}

export interface EditorAlternative {
  id: string
  /** Letra controlada pelo sistema ("A", "B", ...), SEMPRE derivada da posição. */
  letter: string
  /** Texto SEM o marcador de letra. */
  content: string
}

export interface EditorPageSettings {
  size: PageSize
  orientation: PageOrientation
  marginTop: number
  marginRight: number
  marginBottom: number
  marginLeft: number
  defaultFontFamily: string
  defaultFontSize: number
  lineHeight: number
  /** Layout das questões: uma coluna (padrão) ou duas colunas (simulado). */
  columns?: "one" | "two"
  /** Espaçamento entre as colunas, em px. */
  columnGap?: number
  /** Separador visual entre as colunas. */
  columnSeparator?: "none" | "line"
  /** Seções pedagógicas (BNCC/inclusão) iniciam em nova página. */
  pedagogicalPageBreakBefore?: boolean
  /** Alinhamento padrão do corpo do documento (estilos específicos prevalecem). */
  defaultAlignment?: TextAlignment
  /** Espaçamento padrão entre parágrafos/blocos, em px. */
  defaultSpacingAfter?: number
  /** Cor padrão do texto do corpo (estilos específicos prevalecem). */
  defaultColor?: string
}

export type HeaderFieldAlignment = "left" | "center" | "right"
export type HeaderLayout = "compact" | "normal" | "spacious"

export interface EditorHeaderField {
  id: string
  label: string
  value: string
  visible: boolean
  /** Linha em que o campo aparece (1-based). Campos com a mesma linha ficam lado a lado. */
  row?: number
  /** Legado: campo sozinho na linha (equivalente a ser o único campo da linha). */
  fullWidth?: boolean
  /** Largura em % dentro da linha (padrão: divisão igual entre os campos da linha). */
  widthPercent?: number
  fontSize?: number
  minHeight?: number
  lineHeight?: number
  spacingAfter?: number
  alignment?: HeaderFieldAlignment
  /** Campo criado pelo usuário (pode ser removido); os padrão apenas ocultados. */
  custom?: boolean
}

export interface EditorHeaderSettings {
  visible: boolean
  layout?: HeaderLayout
  fields: EditorHeaderField[]
}

/** Presets de espaçamento vertical do cabeçalho (compacto/normal/espaçado). */
export const HEADER_LAYOUT_PRESETS: Record<
  HeaderLayout,
  { fontSize: number; lineHeight: number; minHeight: number; spacingAfter: number }
> = {
  compact: { fontSize: 8.5, lineHeight: 1.25, minHeight: 12, spacingAfter: 4 },
  normal: { fontSize: 9.5, lineHeight: 1.4, minHeight: 15, spacingAfter: 7 },
  spacious: { fontSize: 10.5, lineHeight: 1.6, minHeight: 19, spacingAfter: 12 },
}

/**
 * Agrupa os campos visíveis do cabeçalho em linhas. A ordem do array é a ordem
 * visual (de cima para baixo); campos CONSECUTIVOS com a mesma `row` ficam lado
 * a lado na mesma linha. Campos com `row` ausente recebem linha própria
 * (um após o outro), preservando o comportamento legado de emparelhamento
 * quando necessário.
 */
export function headerFieldRows(fields: EditorHeaderField[]): EditorHeaderField[][] {
  const rows: EditorHeaderField[][] = []
  let currentRow: number | undefined
  let current: EditorHeaderField[] = []
  for (const field of fields) {
    if (!field.visible) continue
    const row = typeof field.row === "number" ? field.row : (currentRow === undefined ? 1 : currentRow + 1)
    if (row === currentRow) {
      current.push(field)
    } else {
      if (current.length > 0) rows.push(current)
      current = [field]
      currentRow = row
    }
  }
  if (current.length > 0) rows.push(current)
  return rows
}

/**
 * Largura efetiva (em %) de um campo dentro da sua linha. Campo sozinho ocupa
 * 100%; caso contrário usa `widthPercent` ou divide igualmente entre os campos.
 */
export function headerFieldWidth(field: EditorHeaderField, rowLength: number): number {
  if (rowLength <= 1) return 100
  if (typeof field.widthPercent === "number") return field.widthPercent
  return Math.round(100 / rowLength)
}

/**
 * Reequilibra a largura dos campos visíveis de uma linha (divisão igual entre
 * eles). Campo sozinho recebe 100%.
 */
export function rebalanceHeaderRow(fields: EditorHeaderField[], row: number) {
  const members = fields.filter((field) => field.visible && field.row === row)
  const width = members.length <= 1 ? 100 : Math.round(100 / members.length)
  for (const member of members) member.widthPercent = width
}

/** Mantém o array ordenado por linha (estável) para que painel e página coincidam. */
export function sortHeaderFieldsByRow(fields: EditorHeaderField[]) {
  return fields
    .map((field, index) => ({ field, index }))
    .sort((a, b) => (a.field.row ?? 0) - (b.field.row ?? 0) || a.index - b.index)
    .map((entry) => entry.field)
}

/**
 * Move um campo para cima/baixo na ordem visual. Ao trocar de posição com um
 * campo de outra linha, o campo adota a linha do vizinho (entra/sai de linhas).
 */
export function moveHeaderField(fields: EditorHeaderField[], fieldId: string, direction: "up" | "down") {
  const index = fields.findIndex((field) => field.id === fieldId)
  if (index < 0) return fields
  const target = direction === "up" ? index - 1 : index + 1
  if (target < 0 || target >= fields.length) return fields
  const moved = fields[index]
  const neighbor = fields[target]
  ;[fields[index], fields[target]] = [fields[target], fields[index]]
  if (moved.row !== neighbor.row) {
    moved.row = neighbor.row
    if (moved.row !== undefined) rebalanceHeaderRow(fields, moved.row)
  }
  return sortHeaderFieldsByRow(fields)
}

/**
 * Solta um campo arrastado sobre outro (drag-and-drop): assume a posição e a
 * linha do alvo, e a linha é reequilibrada.
 */
export function relocateHeaderField(fields: EditorHeaderField[], draggedId: string, targetId: string) {
  if (draggedId === targetId) return fields
  const from = fields.findIndex((field) => field.id === draggedId)
  const targetIndex = fields.findIndex((field) => field.id === targetId)
  if (from < 0 || targetIndex < 0) return fields
  const targetField = fields[targetIndex]
  const [moved] = fields.splice(from, 1)
  const insertAt = fields.findIndex((field) => field.id === targetId)
  fields.splice(insertAt, 0, moved)
  moved.row = targetField.row
  if (moved.row !== undefined) rebalanceHeaderRow(fields, moved.row)
  return sortHeaderFieldsByRow(fields)
}

/** Altera a linha de um campo e reequilibra as linhas afetadas. */
export function setHeaderFieldRow(fields: EditorHeaderField[], fieldId: string, row: number) {
  const value = Math.max(1, Math.min(30, Math.round(row)))
  const field = fields.find((item) => item.id === fieldId)
  if (!field) return fields
  const previous = field.row
  field.row = value
  if (previous !== undefined && previous !== value) rebalanceHeaderRow(fields, previous)
  rebalanceHeaderRow(fields, value)
  return sortHeaderFieldsByRow(fields)
}

export function headerFieldMetrics(field: EditorHeaderField, layout: HeaderLayout) {
  const preset = HEADER_LAYOUT_PRESETS[layout] || HEADER_LAYOUT_PRESETS.normal
  return {
    fontSize: field.fontSize ?? preset.fontSize,
    lineHeight: field.lineHeight ?? preset.lineHeight,
    minHeight: field.minHeight ?? preset.minHeight,
    spacingAfter: field.spacingAfter ?? preset.spacingAfter,
  }
}

export interface EditorFooterSettings {
  visible: boolean
  showPageNumber: boolean
  showSchoolName: boolean
  showMaterialName: boolean
  customText: string
}

export interface EditorImageReference {
  assetId: string
  widthPercent: number
  alignment: ImageAlignment
}

interface EditorElementBase {
  id: string
  style?: EditorTextStyle
}

export type EditorElement =
  | (EditorElementBase & { type: "heading"; level: 1 | 2 | 3; content: string })
  | (EditorElementBase & { type: "paragraph"; content: string })
  | (EditorElementBase & { type: "instruction"; content: string })
  | (EditorElementBase & { type: "textBox"; content: string })
  | (EditorElementBase & { type: "list"; ordered: boolean; items: string[] })
  | (EditorElementBase & { type: "table"; headers: string[]; rows: string[][] })
  | (EditorElementBase & {
      type: "question"
      number: number
      content: string
      alternatives: EditorAlternative[]
      /** Resposta correta: letra (múltipla escolha) ou texto (questão aberta). */
      answer?: string
      justification?: string
      bnccSkill?: string
      objective?: string
      responseLines: number
      images: EditorImageReference[]
    })
  | (EditorElementBase & {
      type: "image"
      assetId: string
      widthPercent: number
      alignment: ImageAlignment
    })
  | (EditorElementBase & { type: "responseSpace"; lines: number })
  | (EditorElementBase & { type: "separator" })
  | (EditorElementBase & { type: "pageBreak" })

export interface EditorSection {
  id: string
  title: string
  pageBreakBefore?: boolean
  /**
   * "pedagogical" marca seções que não fazem parte da folha do aluno
   * (Habilidades BNCC, competências, inclusão/DUA). São renderizadas em uma
   * coluna e, por padrão, iniciam em nova página.
   */
  kind?: "activity" | "pedagogical"
  elements: EditorElement[]
}

export interface EditorDocument {
  schemaVersion: typeof EDITOR_DOCUMENT_SCHEMA_VERSION
  title: string
  topic: string
  subtitle: string
  page: EditorPageSettings
  header: EditorHeaderSettings
  footer: EditorFooterSettings
  sections: EditorSection[]
}

export interface EditorAssetView {
  id: string
  url: string
  originalUrl: string
  status: string
  prompt: string
  provider: string
  model: string
  style: string
  altText: string | null
  placementKey: string
  version: number
  createdAt: string
  updatedAt: string
}

const ALLOWED_FONTS = new Set([
  "Arial",
  "Helvetica",
  "Times New Roman",
  "Georgia",
  "Verdana",
  "Trebuchet MS",
  "Courier New",
])

const ALLOWED_TAGS = new Set(["b", "strong", "i", "em", "u", "span", "font", "br", "ul", "ol", "li", "h1", "h2", "h3"])

export function plainTextFromHtml(value: string): string {
  return value
    .replace(/<br\s*\/?\s*>/gi, "\n")
    .replace(/<\/(?:ul|ol|li|h1|h2|h3|p|div)>/gi, "\n")
    .replace(/<[^>]*>/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .trim()
}

const PEDAGOGICAL_TITLE_HINTS = [
  "habilidades e competencias bncc",
  "inclusao acessibilidade e dua",
  "competencias gerais",
  "bncc",
  "inclusao",
  "acessibilidade",
]

/**
 * Reconhece títulos de seções pedagógicas (BNCC/inclusão). Usado na migração de
 * documentos antigos que não marcavam `kind` e na interface (marcação estrutural).
 */
export function isPedagogicalSectionTitle(title: string): boolean {
  const normalized = plainTextFromHtml(title)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
  if (!normalized) return false
  return PEDAGOGICAL_TITLE_HINTS.some((hint) => normalized.includes(hint))
}

export function escapeEditorText(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
    .replace(/\n/g, "<br>")
}

function sanitizeCss(style: string): string {
  const output: string[] = []
  for (const declaration of style.split(";")) {
    const [rawProperty, ...rawValueParts] = declaration.split(":")
    const property = rawProperty?.trim().toLowerCase()
    const value = rawValueParts.join(":").trim()
    if (!property || !value) continue
    if (property === "font-family") {
      const font = value.replace(/["']/g, "").split(",")[0].trim()
      if (ALLOWED_FONTS.has(font)) output.push(`font-family:${font}`)
    } else if (property === "font-size") {
      const size = Number.parseFloat(value)
      if (Number.isFinite(size)) output.push(`font-size:${Math.max(8, Math.min(36, size))}px`)
    } else if (property === "color" && /^(#[0-9a-f]{3,8}|rgb\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*\))$/i.test(value)) {
      output.push(`color:${value}`)
    } else if (property === "font-weight" && /^(bold|[5-9]00)$/i.test(value)) {
      output.push("font-weight:bold")
    } else if (property === "font-style" && value.toLowerCase() === "italic") {
      output.push("font-style:italic")
    } else if (property === "text-decoration" && value.toLowerCase().includes("underline")) {
      output.push("text-decoration:underline")
    } else if (property === "background-color" && /^(#[0-9a-f]{3,8}|rgb\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*\))$/i.test(value)) {
      output.push(`background-color:${value}`)
    }
  }
  return output.join(";")
}

export function sanitizeEditorHtml(input: unknown, maxLength = 20_000): string {
  if (typeof input !== "string") return ""
  const source = input
    .slice(0, maxLength)
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<(script|style|iframe|object|embed)[^>]*>[\s\S]*?<\/\1\s*>/gi, "")
    .replace(/<(div|p)[^>]*>/gi, "")
    .replace(/<\/(div|p)>/gi, "<br>")

  return source.replace(/<\/?([a-z0-9]+)([^>]*)>/gi, (match, rawTag: string, rawAttributes: string) => {
    const tag = rawTag.toLowerCase()
    if (!ALLOWED_TAGS.has(tag)) return ""
    const closing = match.startsWith("</")
    if (closing) return tag === "br" ? "" : `</${tag}>`
    if (tag === "br") return "<br>"

    if (tag === "span") {
      const styleMatch = rawAttributes.match(/\bstyle\s*=\s*["']([^"']*)["']/i)
      const style = styleMatch ? sanitizeCss(styleMatch[1]) : ""
      return style ? `<span style="${style}">` : "<span>"
    }
    if (tag === "font") {
      const faceMatch = rawAttributes.match(/\bface\s*=\s*["']([^"']*)["']/i)
      const colorMatch = rawAttributes.match(/\bcolor\s*=\s*["']([^"']*)["']/i)
      const sizeMatch = rawAttributes.match(/\bsize\s*=\s*["']?([1-7])["']?/i)
      const attributes: string[] = []
      const face = faceMatch?.[1]?.replace(/["']/g, "").split(",")[0].trim()
      if (face && ALLOWED_FONTS.has(face)) attributes.push(`face="${face}"`)
      if (colorMatch && /^(#[0-9a-f]{3,8}|rgb\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*\))$/i.test(colorMatch[1])) {
        attributes.push(`color="${colorMatch[1]}"`)
      }
      if (sizeMatch) attributes.push(`size="${sizeMatch[1]}"`)
      return `<font${attributes.length ? ` ${attributes.join(" ")}` : ""}>`
    }
    return `<${tag}>`
  })
}

function cleanString(value: unknown, max: number): string {
  return typeof value === "string" ? value.trim().slice(0, max) : ""
}

function cleanNumber(value: unknown, fallback: number, min: number, max: number): number {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.max(min, Math.min(max, value))
    : fallback
}

function cleanId(value: unknown, fallback: string): string {
  const id = cleanString(value, 100)
  return /^[a-zA-Z0-9:_-]+$/.test(id) ? id : fallback
}

function cleanStyle(value: unknown): EditorTextStyle | undefined {
  if (!value || typeof value !== "object") return undefined
  const source = value as Record<string, unknown>
  const alignment = ["left", "center", "right", "justify"].includes(String(source.alignment))
    ? (source.alignment as TextAlignment)
    : undefined
  const fontFamily = ALLOWED_FONTS.has(String(source.fontFamily)) ? String(source.fontFamily) : undefined
  const color = typeof source.color === "string" && /^#[0-9a-f]{6}$/i.test(source.color) ? source.color : undefined
  return {
    ...(fontFamily ? { fontFamily } : {}),
    ...(typeof source.fontSize === "number" ? { fontSize: cleanNumber(source.fontSize, 11, 8, 36) } : {}),
    ...(source.bold === true ? { bold: true } : {}),
    ...(source.italic === true ? { italic: true } : {}),
    ...(source.underline === true ? { underline: true } : {}),
    ...(color ? { color } : {}),
    ...(alignment ? { alignment } : {}),
    ...(typeof source.lineHeight === "number" ? { lineHeight: cleanNumber(source.lineHeight, 1.5, 1, 3) } : {}),
    ...(typeof source.indent === "number" ? { indent: cleanNumber(source.indent, 0, 0, 80) } : {}),
    ...(typeof source.spacingAfter === "number" ? { spacingAfter: cleanNumber(source.spacingAfter, 6, 0, 48) } : {}),
  }
}

function sanitizeElement(value: unknown, index: number): EditorElement | null {
  if (!value || typeof value !== "object") return null
  const source = value as Record<string, unknown>
  const type = source.type
  const id = cleanId(source.id, `element-${index}`)
  const style = cleanStyle(source.style)
  const base = { id, ...(style ? { style } : {}) }

  if (type === "heading") {
    const level = [1, 2, 3].includes(Number(source.level)) ? (Number(source.level) as 1 | 2 | 3) : 2
    return { ...base, type, level, content: stripIdentificationLinesFromHtml(sanitizeEditorHtml(source.content)) }
  }
  if (type === "paragraph" || type === "instruction" || type === "textBox") {
    return { ...base, type, content: stripIdentificationLinesFromHtml(sanitizeEditorHtml(source.content)) }
  }
  if (type === "list") {
    const items = Array.isArray(source.items)
      ? source.items.slice(0, 100).map((item) => sanitizeEditorHtml(item, 5_000))
      : []
    return { ...base, type, ordered: source.ordered === true, items }
  }
  if (type === "table") {
    const headers = Array.isArray(source.headers)
      ? source.headers.slice(0, 12).map((item) => sanitizeEditorHtml(item, 2_000))
      : []
    const rows = Array.isArray(source.rows)
      ? source.rows.slice(0, 100).map((row) =>
          Array.isArray(row)
            ? row.slice(0, Math.max(1, headers.length || 12)).map((cell) => sanitizeEditorHtml(cell, 5_000))
            : [],
        )
      : []
    return { ...base, type, headers, rows }
  }
  if (type === "question") {
    const alternatives: EditorAlternative[] = Array.isArray(source.alternatives)
      ? source.alternatives.slice(0, 12).map((item, alternativeIndex) => {
          const letter = alternativeLetter(alternativeIndex)
          const object = item && typeof item === "object" ? (item as Record<string, unknown>) : null
          const raw = object
            ? typeof object.content === "string"
              ? object.content
              : typeof object.text === "string"
                ? object.text
                : ""
            : typeof item === "string"
              ? item
              : ""
          const existingId = object ? cleanId(object.id, "") : ""
          return {
            id: existingId || `${id}-alternative-${alternativeIndex}`,
            letter,
            // remove o marcador de letra (ex.: "A) ...") antes de sanitizar/salvar
            content: sanitizeEditorHtml(normalizeAlternativeText(raw), 5_000),
          }
        })
      : []
    const rawImages = Array.isArray(source.images)
      ? source.images
      : Array.isArray(source.assetIds)
        ? source.assetIds.map((assetId) => ({ assetId, widthPercent: 75, alignment: "center" }))
        : []
    const images = rawImages.slice(0, 12).map((item) => {
      const image = item && typeof item === "object" ? item as Record<string, unknown> : {}
      const alignment = ["left", "center", "right"].includes(String(image.alignment))
        ? image.alignment as ImageAlignment
        : "center"
      return {
        assetId: cleanId(image.assetId, ""),
        widthPercent: Math.round(cleanNumber(image.widthPercent, 75, 20, 100)),
        alignment,
      }
    }).filter((image) => Boolean(image.assetId))
    const answer = typeof source.answer === "string" ? normalizeAnswerLetter(source.answer) : ""
    const justification = typeof source.justification === "string" ? sanitizeEditorHtml(source.justification, 5_000) : ""
    const bnccSkill = typeof source.bnccSkill === "string" ? cleanString(source.bnccSkill, 200) : ""
    const objective = typeof source.objective === "string" ? sanitizeEditorHtml(source.objective, 5_000) : ""
    return {
      ...base,
      type,
      number: Math.round(cleanNumber(source.number, index + 1, 1, 999)),
      content: stripIdentificationLinesFromHtml(sanitizeEditorHtml(source.content)),
      alternatives,
      ...(answer ? { answer } : {}),
      ...(justification ? { justification } : {}),
      ...(bnccSkill ? { bnccSkill } : {}),
      ...(objective ? { objective } : {}),
      responseLines: Math.round(cleanNumber(source.responseLines, alternatives.length ? 0 : 2, 0, 20)),
      images,
    }
  }
  if (type === "image") {
    const assetId = cleanId(source.assetId, "")
    if (!assetId) return null
    const alignment = ["left", "center", "right"].includes(String(source.alignment))
      ? (source.alignment as ImageAlignment)
      : "center"
    return {
      ...base,
      type,
      assetId,
      widthPercent: Math.round(cleanNumber(source.widthPercent, 75, 20, 100)),
      alignment,
    }
  }
  if (type === "responseSpace") {
    return { ...base, type, lines: Math.round(cleanNumber(source.lines, 3, 1, 20)) }
  }
  if (type === "separator" || type === "pageBreak") return { ...base, type }
  return null
}

function withoutIds(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(withoutIds)
  if (value && typeof value === "object") {
    const result: Record<string, unknown> = {}
    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
      if (key === "id") continue
      result[key] = withoutIds(child)
    }
    return result
  }
  return value
}

function elementSignature(element: EditorElement): string {
  return JSON.stringify(withoutIds(element))
}

function normalizedText(value: string): string {
  return value
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase()
}

function dedupeListItems(element: EditorElement): EditorElement {
  if (element.type !== "list") return element
  const items: string[] = []
  for (const item of element.items) {
    const previous = items[items.length - 1]
    const isRepeat =
      normalizedText(item) !== "" &&
      previous !== undefined &&
      normalizedText(previous) === normalizedText(item)
    if (!isRepeat) items.push(item)
  }
  return { ...element, items }
}

// Remove apenas duplicatas EXATAS e CONSECUTIVAS (de elementos, itens de lista e
// seções). A saída da IA às vezes repete o mesmo texto em sequência; isso limpa o
// conteúdo sem tocar em repetições legítimas que estejam separadas por outro bloco.
export function dedupeEditorDocument(document: EditorDocument): EditorDocument {
  const sections: EditorSection[] = []
  for (const section of document.sections) {
    const elements: EditorElement[] = []
    for (const element of section.elements) {
      const cleaned = dedupeListItems(element)
      const previous = elements[elements.length - 1]
      if (previous && elementSignature(previous) === elementSignature(cleaned)) continue
      elements.push(cleaned)
    }
    const cleanedSection: EditorSection = { ...section, elements }
    const previousSection = sections[sections.length - 1]
    if (previousSection && JSON.stringify(withoutIds(previousSection)) === JSON.stringify(withoutIds(cleanedSection))) {
      continue
    }
    sections.push(cleanedSection)
  }
  return { ...document, sections }
}

export function sanitizeEditorDocument(value: unknown): EditorDocument | null {
  if (!value || typeof value !== "object") return null
  const source = value as Record<string, unknown>
  if (source.schemaVersion !== EDITOR_DOCUMENT_SCHEMA_VERSION) return null
  const page = source.page && typeof source.page === "object" ? source.page as Record<string, unknown> : {}
  const header = source.header && typeof source.header === "object" ? source.header as Record<string, unknown> : {}
  const footer = source.footer && typeof source.footer === "object" ? source.footer as Record<string, unknown> : {}
  const rawHeaderFields = Array.isArray(header.fields) ? header.fields.slice(0, 30) : []
  // Atribui uma linha (row) a cada campo. Campos sem `row` (documentos antigos)
  // seguem a regra legada: fullWidth sozinho; os demais em pares.
  let rowCursor = 1
  let openRow: number | null = null
  let openCount = 0
  const fields = rawHeaderFields.map((item, index) => {
    const field = item && typeof item === "object" ? item as Record<string, unknown> : {}
    const visible = field.visible !== false
    const fullWidth = field.fullWidth === true
    const alignment = ["left", "center", "right"].includes(String(field.alignment))
      ? field.alignment as HeaderFieldAlignment
      : undefined
    const explicitRow = typeof field.row === "number"
      ? Math.round(cleanNumber(field.row, 1, 1, 30))
      : undefined
    let row: number
    if (explicitRow) {
      row = explicitRow
      rowCursor = Math.max(rowCursor, explicitRow + 1)
      openRow = null
      openCount = 0
    } else if (fullWidth || !visible) {
      // Campo legado de largura total, ou campo oculto: linha própria sem
      // interferir no emparelhamento dos demais campos visíveis.
      row = rowCursor
      rowCursor += 1
      openRow = null
      openCount = 0
    } else if (openRow !== null && openCount < 2) {
      row = openRow
      openCount += 1
    } else {
      row = rowCursor
      rowCursor += 1
      openRow = row
      openCount = 1
    }
    const widthPercent = typeof field.widthPercent === "number"
      ? Math.round(cleanNumber(field.widthPercent, fullWidth ? 100 : 50, 5, 100))
      : undefined
    return {
      id: cleanId(field.id, `header-${index}`),
      label: cleanString(field.label, 60),
      value: cleanString(field.value, 200),
      visible,
      row,
      ...(fullWidth ? { fullWidth: true } : {}),
      ...(widthPercent !== undefined ? { widthPercent } : {}),
      ...(field.custom === true ? { custom: true } : {}),
      ...(typeof field.fontSize === "number" ? { fontSize: cleanNumber(field.fontSize, 9.5, 6, 24) } : {}),
      ...(typeof field.minHeight === "number" ? { minHeight: cleanNumber(field.minHeight, 15, 8, 80) } : {}),
      ...(typeof field.lineHeight === "number" ? { lineHeight: cleanNumber(field.lineHeight, 1.4, 0.8, 3) } : {}),
      ...(typeof field.spacingAfter === "number" ? { spacingAfter: cleanNumber(field.spacingAfter, 7, 0, 40) } : {}),
      ...(alignment ? { alignment } : {}),
    }
  })
  const sections = Array.isArray(source.sections)
    ? source.sections.slice(0, 100).map((item, sectionIndex) => {
        const section = item && typeof item === "object" ? item as Record<string, unknown> : {}
        const title = sanitizeEditorHtml(section.title, 5_000)
        const elements = Array.isArray(section.elements)
          ? section.elements.slice(0, 500).map(sanitizeElement).filter((element): element is EditorElement => Boolean(element))
          : []
        // Migração: documentos antigos não marcavam `kind`. Seções com título de
        // BNCC/inclusão passam a ser pedagógicas (uma coluna + nova página).
        const kind = section.kind === "pedagogical" || isPedagogicalSectionTitle(title)
          ? ("pedagogical" as const)
          : undefined
        return {
          id: cleanId(section.id, `section-${sectionIndex}`),
          title,
          ...(kind ? { kind } : {}),
          ...(section.pageBreakBefore === true ? { pageBreakBefore: true } : {}),
          elements,
        }
      })
    : []

  // Migração: documentos antigos guardavam o gabarito como uma tabela estática.
  // Agora o gabarito é derivado das próprias questões (answer/justification).
  // Quando as questões já carregam essas informações, descartamos a tabela
  // estática antiga para evitar gabarito duplicado.
  const hasQuestionAnswers = sections.some((section) =>
    section.elements.some((element) => element.type === "question" && Boolean(element.answer || element.justification)),
  )
  const migratedSections = hasQuestionAnswers
    ? sections.filter((section) => {
        const title = plainTextFromHtml(section.title).trim()
        if (title !== "Gabarito" && title !== "Gabarito e critérios") return true
        const onlyTable = section.elements.length === 1 && section.elements[0].type === "table"
          ? section.elements[0]
          : null
        if (!onlyTable) return true
        const headers = onlyTable.headers.map((header) => plainTextFromHtml(header).trim())
        return !(headers[0] === "Questão" && headers[1] === "Resposta")
      })
    : sections

  return dedupeEditorDocument({
    schemaVersion: EDITOR_DOCUMENT_SCHEMA_VERSION,
    title: sanitizeEditorHtml(source.title, 5_000),
    topic: cleanString(source.topic, 200),
    subtitle: cleanString(source.subtitle, 300),
    page: {
      size: page.size === "LETTER" ? "LETTER" : "A4",
      orientation: page.orientation === "landscape" ? "landscape" : "portrait",
      marginTop: cleanNumber(page.marginTop, 15, 8, 50),
      marginRight: cleanNumber(page.marginRight, 15, 8, 50),
      marginBottom: cleanNumber(page.marginBottom, 15, 8, 50),
      marginLeft: cleanNumber(page.marginLeft, 15, 8, 50),
      defaultFontFamily: ALLOWED_FONTS.has(String(page.defaultFontFamily)) ? String(page.defaultFontFamily) : "Arial",
      defaultFontSize: cleanNumber(page.defaultFontSize, 11, 8, 20),
      lineHeight: cleanNumber(page.lineHeight, 1.5, 1, 3),
      columns: page.columns === "two" ? "two" : "one",
      columnGap: Math.round(cleanNumber(page.columnGap, 24, 8, 80)),
      columnSeparator: page.columnSeparator === "line" ? "line" : "none",
      pedagogicalPageBreakBefore: page.pedagogicalPageBreakBefore !== false,
      defaultAlignment: ["left", "center", "right", "justify"].includes(String(page.defaultAlignment))
        ? (page.defaultAlignment as TextAlignment)
        : "left",
      defaultSpacingAfter: Math.round(cleanNumber(page.defaultSpacingAfter, 6, 0, 48)),
      ...(typeof page.defaultColor === "string" && /^#[0-9a-f]{6}$/i.test(page.defaultColor)
        ? { defaultColor: page.defaultColor }
        : {}),
    },
    header: {
      visible: header.visible !== false,
      ...(["compact", "normal", "spacious"].includes(String(header.layout))
        ? { layout: header.layout as HeaderLayout }
        : {}),
      fields,
    },
    footer: {
      visible: footer.visible !== false,
      showPageNumber: footer.showPageNumber !== false,
      showSchoolName: footer.showSchoolName === true,
      showMaterialName: footer.showMaterialName === true,
      customText: cleanString(footer.customText, 200),
    },
    sections: migratedSections,
  })
}

export function documentAssetIds(document: EditorDocument): Set<string> {
  const ids = new Set<string>()
  for (const section of document.sections) {
    for (const element of section.elements) {
      if (element.type === "image") ids.add(element.assetId)
      if (element.type === "question") element.images.forEach((image) => ids.add(image.assetId))
    }
  }
  return ids
}
