import React from "react"
import {
  Document,
  Image as PdfImage,
  Page,
  StyleSheet,
  Text,
  View,
} from "@react-pdf/renderer"
import {
  plainTextFromHtml,
  type EditorDocument,
  type EditorElement,
  type EditorImageReference,
  type EditorTextStyle,
} from "@/lib/editor-document"

export interface ResolvedEditorAsset {
  id: string
  data: Buffer
  format: "png" | "jpg"
  altText: string
}

interface RichRun {
  text: string
  bold?: boolean
  italic?: boolean
  underline?: boolean
  color?: string
  fontFamily?: string
  fontSize?: number
}

const styles = StyleSheet.create({
  page: { color: "#172133", backgroundColor: "#ffffff" },
  title: { fontFamily: "Helvetica-Bold", fontSize: 18, marginBottom: 5, color: "#123f3b" },
  subtitle: { fontSize: 9, color: "#5b6875", marginBottom: 12 },
  headerGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    borderTopWidth: 0.6,
    borderTopColor: "#7e8b96",
    marginBottom: 14,
    paddingTop: 4,
  },
  headerField: { width: "48.5%", borderBottomWidth: 0.6, borderBottomColor: "#9ca8b2", paddingVertical: 5 },
  headerLabel: { fontFamily: "Helvetica-Bold", fontSize: 7.5, color: "#41505f" },
  headerValue: { fontSize: 9.5, minHeight: 12, paddingTop: 2 },
  fixedFooter: {
    position: "absolute",
    left: 48,
    right: 48,
    bottom: 20,
    borderTopWidth: 0.5,
    borderTopColor: "#b6c0c8",
    paddingTop: 5,
    flexDirection: "row",
    justifyContent: "space-between",
    fontSize: 7.5,
    color: "#66727e",
  },
  section: { marginBottom: 12 },
  sectionTitle: {
    fontFamily: "Helvetica-Bold",
    color: "#146f65",
    fontSize: 13,
    marginBottom: 7,
    paddingBottom: 3,
    borderBottomWidth: 0.6,
    borderBottomColor: "#b8d8d3",
  },
  paragraph: { marginBottom: 7 },
  instruction: { marginBottom: 8, padding: 7, backgroundColor: "#edf7f5", borderLeftWidth: 2.5, borderLeftColor: "#167c70" },
  textBox: { marginBottom: 8, padding: 8, borderWidth: 0.7, borderColor: "#84939f" },
  listRow: { flexDirection: "row", marginBottom: 3 },
  listMarker: { width: 18, color: "#146f65" },
  listContent: { flex: 1 },
  table: { borderWidth: 0.6, borderColor: "#8796a2", marginBottom: 9 },
  tableRow: { flexDirection: "row", borderBottomWidth: 0.4, borderBottomColor: "#c3ccd3" },
  tableHeader: { backgroundColor: "#e8f3f1" },
  tableCell: { flex: 1, padding: 5, borderRightWidth: 0.4, borderRightColor: "#c3ccd3", fontSize: 8 },
  question: { marginBottom: 14 },
  questionPrompt: { fontFamily: "Helvetica-Bold", marginBottom: 5 },
  alternative: { flexDirection: "row", marginLeft: 13, marginBottom: 3 },
  alternativeMark: { width: 18 },
  alternativeContent: { flex: 1 },
  answerLine: { height: 17, borderBottomWidth: 0.45, borderBottomColor: "#9ba7b1" },
  image: { maxHeight: 320, objectFit: "contain", marginVertical: 7 },
  separator: { borderTopWidth: 0.7, borderTopColor: "#7f8c97", marginVertical: 10 },
})

function decode(value: string) {
  return plainTextFromHtml(value)
}

function fontFromFamily(value?: string) {
  if (!value) return "Helvetica"
  if (value === "Times New Roman" || value === "Georgia") return "Times-Roman"
  if (value === "Courier New") return "Courier"
  return "Helvetica"
}

function fontWithMarks(family: string, bold?: boolean, italic?: boolean) {
  if (family === "Times-Roman") {
    if (bold && italic) return "Times-BoldItalic"
    if (bold) return "Times-Bold"
    if (italic) return "Times-Italic"
    return family
  }
  if (family === "Courier") {
    if (bold && italic) return "Courier-BoldOblique"
    if (bold) return "Courier-Bold"
    if (italic) return "Courier-Oblique"
    return family
  }
  if (bold && italic) return "Helvetica-BoldOblique"
  if (bold) return "Helvetica-Bold"
  if (italic) return "Helvetica-Oblique"
  return "Helvetica"
}

function parseAttributes(raw = "") {
  const attributes: Record<string, string> = {}
  raw.replace(/([a-z-]+)\s*=\s*["']([^"']*)["']/gi, (_match, name: string, value: string) => {
    attributes[name.toLowerCase()] = value
    return ""
  })
  return attributes
}

function htmlRuns(html: string): RichRun[] {
  const tokens = html.replace(/<br\s*\/?\s*>/gi, "\n").split(/(<[^>]+>)/g).filter(Boolean)
  const stack: Omit<RichRun, "text">[] = [{}]
  const runs: RichRun[] = []

  for (const token of tokens) {
    if (!token.startsWith("<")) {
      const text = decode(token)
      if (text) runs.push({ ...stack[stack.length - 1], text })
      continue
    }
    if (/^<\//.test(token)) {
      if (stack.length > 1) stack.pop()
      continue
    }
    const match = token.match(/^<([a-z0-9]+)([^>]*)>/i)
    if (!match) continue
    const tag = match[1].toLowerCase()
    if (tag === "br") continue
    const next = { ...stack[stack.length - 1] }
    if (tag === "b" || tag === "strong") next.bold = true
    if (tag === "i" || tag === "em") next.italic = true
    if (tag === "u") next.underline = true
    const attributes = parseAttributes(match[2])
    if (tag === "font") {
      if (attributes.face) next.fontFamily = attributes.face
      if (attributes.color) next.color = attributes.color
      if (attributes.size) next.fontSize = ({ "1": 8, "2": 10, "3": 12, "4": 14, "5": 18, "6": 24, "7": 32 } as Record<string, number>)[attributes.size]
    }
    if (tag === "span" && attributes.style) {
      for (const declaration of attributes.style.split(";")) {
        const [property, rawValue] = declaration.split(":")
        const value = rawValue?.trim()
        if (property?.trim() === "font-family") next.fontFamily = value
        if (property?.trim() === "font-size") next.fontSize = Number.parseFloat(value)
        if (property?.trim() === "color") next.color = value
        if (property?.trim() === "font-weight") next.bold = true
        if (property?.trim() === "font-style") next.italic = true
        if (property?.trim() === "text-decoration") next.underline = true
      }
    }
    stack.push(next)
  }
  return runs.length > 0 ? runs : [{ text: decode(html) }]
}

function RichText({ html, baseStyle }: { html: string; baseStyle?: EditorTextStyle }) {
  const baseFamily = fontFromFamily(baseStyle?.fontFamily)
  return (
    <Text>
      {htmlRuns(html).map((run, index) => {
        const family = fontFromFamily(run.fontFamily) || baseFamily
        return (
          <Text
            key={`${index}-${run.text.slice(0, 10)}`}
            style={{
              fontFamily: fontWithMarks(family || baseFamily, run.bold || baseStyle?.bold, run.italic || baseStyle?.italic),
              ...(run.underline || baseStyle?.underline ? { textDecoration: "underline" } : {}),
              ...(run.color || baseStyle?.color ? { color: run.color || baseStyle?.color } : {}),
              ...(run.fontSize || baseStyle?.fontSize ? { fontSize: run.fontSize || baseStyle?.fontSize } : {}),
            }}
          >
            {run.text}
          </Text>
        )
      })}
    </Text>
  )
}

function blockStyle(style: EditorTextStyle | undefined, document: EditorDocument) {
  return StyleSheet.create({
    dynamicBlock: {
      fontFamily: fontWithMarks(fontFromFamily(style?.fontFamily || document.page.defaultFontFamily), style?.bold, style?.italic),
      fontSize: style?.fontSize || document.page.defaultFontSize,
      lineHeight: style?.lineHeight || document.page.lineHeight,
      textAlign: style?.alignment || "left",
      marginLeft: style?.indent || 0,
      marginBottom: style?.spacingAfter ?? 6,
      ...(style?.color ? { color: style.color } : {}),
      ...(style?.underline ? { textDecoration: "underline" as const } : {}),
    },
  }).dynamicBlock
}

function ImageView({ reference, assets }: { reference: EditorImageReference; assets: Map<string, ResolvedEditorAsset> }) {
  const asset = assets.get(reference.assetId)
  if (!asset) return null
  const alignSelf = reference.alignment === "left" ? "flex-start" : reference.alignment === "right" ? "flex-end" : "center"
  return (
    <PdfImage
      src={{ data: asset.data, format: asset.format }}
      style={[styles.image, { width: `${reference.widthPercent}%`, alignSelf }]}
    />
  )
}

function TableElement({ element }: { element: Extract<EditorElement, { type: "table" }> }) {
  return (
    <View style={styles.table} wrap>
      {element.headers.length > 0 && (
        <View style={[styles.tableRow, styles.tableHeader]} wrap={false}>
          {element.headers.map((header, index) => (
            <View key={index} style={styles.tableCell}><RichText html={header} baseStyle={{ bold: true }} /></View>
          ))}
        </View>
      )}
      {element.rows.map((row, rowIndex) => (
        <View key={rowIndex} style={styles.tableRow} wrap={false}>
          {Array.from({ length: Math.max(element.headers.length, row.length, 1) }, (_, cellIndex) => (
            <View key={cellIndex} style={styles.tableCell}><RichText html={row[cellIndex] || ""} /></View>
          ))}
        </View>
      ))}
    </View>
  )
}

function ElementView({ element, document, assets }: {
  element: EditorElement
  document: EditorDocument
  assets: Map<string, ResolvedEditorAsset>
}) {
  const textStyle = blockStyle(element.style, document)
  if (element.type === "pageBreak") return <View break />
  if (element.type === "separator") return <View style={styles.separator} />
  if (element.type === "responseSpace") {
    return <View style={{ marginBottom: 7 }}>{Array.from({ length: element.lines }, (_, index) => <View key={index} style={styles.answerLine} />)}</View>
  }
  if (element.type === "heading") {
    const sizes = { 1: 17, 2: 14, 3: 12 }
    return (
      <View style={{ ...textStyle, fontSize: element.style?.fontSize || sizes[element.level], marginTop: element.level === 1 ? 5 : 2 }}>
        <RichText html={element.content} baseStyle={{ ...element.style, bold: true }} />
      </View>
    )
  }
  if (element.type === "paragraph") {
    return <View style={[styles.paragraph, textStyle]}><RichText html={element.content} baseStyle={element.style} /></View>
  }
  if (element.type === "instruction" || element.type === "textBox") {
    return <View style={[element.type === "instruction" ? styles.instruction : styles.textBox, textStyle]} wrap={false}><RichText html={element.content} baseStyle={element.style} /></View>
  }
  if (element.type === "list") {
    return (
      <View style={textStyle}>
        {element.items.map((item, index) => (
          <View key={index} style={styles.listRow} wrap={false}>
            <Text style={styles.listMarker}>{element.ordered ? `${index + 1}.` : "•"}</Text>
            <View style={styles.listContent}><RichText html={item} baseStyle={element.style} /></View>
          </View>
        ))}
      </View>
    )
  }
  if (element.type === "table") return <TableElement element={element} />
  if (element.type === "image") {
    return <ImageView reference={{ assetId: element.assetId, widthPercent: element.widthPercent, alignment: element.alignment }} assets={assets} />
  }
  return (
    <View style={[styles.question, textStyle]} wrap={false}>
      <View style={styles.questionPrompt}>
        <Text>{element.number}. </Text><RichText html={element.content} baseStyle={{ ...element.style, bold: true }} />
      </View>
      {element.images.map((image) => <ImageView key={image.assetId} reference={image} assets={assets} />)}
      {element.alternatives.map((alternative, index) => (
        <View key={alternative.id} style={styles.alternative}>
          <Text style={styles.alternativeMark}>{String.fromCharCode(65 + index)})</Text>
          <View style={styles.alternativeContent}><RichText html={alternative.content} baseStyle={element.style} /></View>
        </View>
      ))}
      {Array.from({ length: element.responseLines }, (_, index) => <View key={index} style={styles.answerLine} />)}
    </View>
  )
}

export function EditorPdfDocument({
  document,
  assets,
  school,
  teacher,
  orientation,
}: {
  document: EditorDocument
  assets: ResolvedEditorAsset[]
  school?: string
  teacher?: string
  orientation?: "portrait" | "landscape"
}) {
  const assetMap = new Map(assets.map((asset) => [asset.id, asset]))
  const fields = document.header.fields
    .filter((field) => field.visible)
    .map((field) => ({
      ...field,
      value: field.id === "school" && school ? school : field.id === "teacher" && teacher ? teacher : field.value,
    }))
  const schoolName = fields.find((field) => field.id === "school")?.value
  const footerLeft = [
    document.footer.showSchoolName ? schoolName : "",
    document.footer.showMaterialName ? plainTextFromHtml(document.title) : "",
    document.footer.customText,
  ].filter(Boolean).join(" · ")
  const mm = 2.834645669

  return (
    <Document
      title={plainTextFromHtml(document.title)}
      subject={document.topic}
      author={teacher || "+ Educação"}
      creator="+ Educação · BNCC Planner"
    >
      <Page
        size={document.page.size === "LETTER" ? "LETTER" : "A4"}
        orientation={orientation || document.page.orientation}
        wrap
        style={[
          styles.page,
          {
            fontFamily: fontFromFamily(document.page.defaultFontFamily),
            fontSize: document.page.defaultFontSize,
            lineHeight: document.page.lineHeight,
            paddingTop: document.page.marginTop * mm,
            paddingRight: document.page.marginRight * mm,
            paddingBottom: Math.max(document.page.marginBottom * mm, document.footer.visible ? 42 : 20),
            paddingLeft: document.page.marginLeft * mm,
          },
        ]}
      >
        {document.footer.visible && (
          <View style={styles.fixedFooter} fixed>
            <Text>{footerLeft || "+ Educação · BNCC Planner"}</Text>
            {document.footer.showPageNumber && (
              <Text render={({ pageNumber, totalPages }) => `Página ${pageNumber} de ${totalPages}`} />
            )}
          </View>
        )}

        <View>
          <View style={styles.title}><RichText html={document.title} baseStyle={{ bold: true }} /></View>
          {document.subtitle && <Text style={styles.subtitle}>{document.subtitle}</Text>}
          {document.header.visible && fields.length > 0 && (
            <View style={styles.headerGrid}>
              {fields.map((field) => (
                <View key={field.id} style={styles.headerField} wrap={false}>
                  <Text style={styles.headerLabel}>{field.label}</Text>
                  <Text style={styles.headerValue}>{field.value || " "}</Text>
                </View>
              ))}
            </View>
          )}
        </View>

        {document.sections.map((section) => (
          <View key={section.id} style={styles.section} break={section.pageBreakBefore}>
            {plainTextFromHtml(section.title).trim() && (
              <View style={styles.sectionTitle}><RichText html={section.title} baseStyle={{ bold: true }} /></View>
            )}
            {section.elements.map((element) => (
              <ElementView key={element.id} element={element} document={document} assets={assetMap} />
            ))}
          </View>
        ))}
      </Page>
    </Document>
  )
}
