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
}

export interface EditorHeaderField {
  id: string
  label: string
  value: string
  visible: boolean
}

export interface EditorHeaderSettings {
  visible: boolean
  fields: EditorHeaderField[]
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
      alternatives: { id: string; content: string }[]
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

const ALLOWED_TAGS = new Set(["b", "strong", "i", "em", "u", "span", "font", "br"])

export function plainTextFromHtml(value: string): string {
  return value
    .replace(/<br\s*\/?\s*>/gi, "\n")
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
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
    return { ...base, type, level, content: sanitizeEditorHtml(source.content) }
  }
  if (type === "paragraph" || type === "instruction" || type === "textBox") {
    return { ...base, type, content: sanitizeEditorHtml(source.content) }
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
    const alternatives = Array.isArray(source.alternatives)
      ? source.alternatives.slice(0, 12).map((item, alternativeIndex) => {
          const alternative = item && typeof item === "object" ? item as Record<string, unknown> : {}
          return {
            id: cleanId(alternative.id, `${id}-alternative-${alternativeIndex}`),
            content: sanitizeEditorHtml(alternative.content, 5_000),
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
    return {
      ...base,
      type,
      number: Math.round(cleanNumber(source.number, index + 1, 1, 999)),
      content: sanitizeEditorHtml(source.content),
      alternatives,
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

export function sanitizeEditorDocument(value: unknown): EditorDocument | null {
  if (!value || typeof value !== "object") return null
  const source = value as Record<string, unknown>
  if (source.schemaVersion !== EDITOR_DOCUMENT_SCHEMA_VERSION) return null
  const page = source.page && typeof source.page === "object" ? source.page as Record<string, unknown> : {}
  const header = source.header && typeof source.header === "object" ? source.header as Record<string, unknown> : {}
  const footer = source.footer && typeof source.footer === "object" ? source.footer as Record<string, unknown> : {}
  const fields = Array.isArray(header.fields)
    ? header.fields.slice(0, 20).map((item, index) => {
        const field = item && typeof item === "object" ? item as Record<string, unknown> : {}
        return {
          id: cleanId(field.id, `header-${index}`),
          label: cleanString(field.label, 60),
          value: cleanString(field.value, 200),
          visible: field.visible !== false,
        }
      })
    : []
  const sections = Array.isArray(source.sections)
    ? source.sections.slice(0, 100).map((item, sectionIndex) => {
        const section = item && typeof item === "object" ? item as Record<string, unknown> : {}
        const elements = Array.isArray(section.elements)
          ? section.elements.slice(0, 500).map(sanitizeElement).filter((element): element is EditorElement => Boolean(element))
          : []
        return {
          id: cleanId(section.id, `section-${sectionIndex}`),
          title: sanitizeEditorHtml(section.title, 5_000),
          ...(section.pageBreakBefore === true ? { pageBreakBefore: true } : {}),
          elements,
        }
      })
    : []

  return {
    schemaVersion: EDITOR_DOCUMENT_SCHEMA_VERSION,
    title: sanitizeEditorHtml(source.title, 5_000),
    topic: cleanString(source.topic, 200),
    subtitle: cleanString(source.subtitle, 300),
    page: {
      size: page.size === "LETTER" ? "LETTER" : "A4",
      orientation: page.orientation === "landscape" ? "landscape" : "portrait",
      marginTop: cleanNumber(page.marginTop, 20, 8, 50),
      marginRight: cleanNumber(page.marginRight, 18, 8, 50),
      marginBottom: cleanNumber(page.marginBottom, 20, 8, 50),
      marginLeft: cleanNumber(page.marginLeft, 18, 8, 50),
      defaultFontFamily: ALLOWED_FONTS.has(String(page.defaultFontFamily)) ? String(page.defaultFontFamily) : "Arial",
      defaultFontSize: cleanNumber(page.defaultFontSize, 11, 8, 20),
      lineHeight: cleanNumber(page.lineHeight, 1.5, 1, 3),
    },
    header: { visible: header.visible !== false, fields },
    footer: {
      visible: footer.visible !== false,
      showPageNumber: footer.showPageNumber !== false,
      showSchoolName: footer.showSchoolName === true,
      showMaterialName: footer.showMaterialName === true,
      customText: cleanString(footer.customText, 200),
    },
    sections,
  }
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
