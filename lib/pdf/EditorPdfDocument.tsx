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
  headerFieldMetrics,
  headerFieldRows,
  headerFieldWidth,
  plainTextFromHtml,
  type EditorDocument,
  type EditorElement,
  type EditorImageReference,
  type EditorTextStyle,
} from "@/lib/editor-document"
import { buildFlowSpec, groupSectionElements, isTwoColumns, layoutFlow, pageGeometry } from "@/lib/document-layout"

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
    borderTopWidth: 0.6,
    borderTopColor: "#7e8b96",
    marginBottom: 14,
    paddingTop: 4,
  },
  headerRow: { flexDirection: "row", alignItems: "stretch" },
  headerLine: { borderBottomWidth: 0.6, borderBottomColor: "#9ca8b2", flexDirection: "row", alignItems: "flex-end" },
  headerLabel: { fontFamily: "Helvetica-Bold", fontSize: 7.5, color: "#41505f" },
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
  questionColumns: { flexDirection: "column" },
  questionRow: { flexDirection: "row", alignItems: "flex-start" },
  questionCell: { flex: 1 },
  questionPrompt: { fontFamily: "Helvetica-Bold", marginBottom: 5 },
  alternative: { flexDirection: "row", marginLeft: 13, marginBottom: 3, textAlign: "left" },
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
      textAlign: style?.alignment || document.page.defaultAlignment || "left",
      marginLeft: style?.indent || 0,
      marginBottom: style?.spacingAfter ?? document.page.defaultSpacingAfter ?? 6,
      ...(style?.color || document.page.defaultColor ? { color: style?.color || document.page.defaultColor } : {}),
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
      {element.alternatives.map((alternative) => (
        <View key={alternative.id} style={styles.alternative}>
          <Text style={styles.alternativeMark}>{alternative.letter})</Text>
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
  const gabaritoQuestions = document.sections.flatMap((section) =>
    section.elements.filter(
      (element): element is Extract<EditorElement, { type: "question" }> =>
        element.type === "question" && Boolean(element.answer || element.justification),
    ),
  )
  const footerLeft = [
    document.footer.showSchoolName ? schoolName : "",
    document.footer.showMaterialName ? plainTextFromHtml(document.title) : "",
    document.footer.customText,
  ].filter(Boolean).join(" · ")
  const mm = 2.834645669
  const pxToPt = 0.75
  const geometry = pageGeometry(document)
  const columnGapPt = geometry.columnGapPx * pxToPt
  const columnWidthPt = geometry.columnWidthPx * pxToPt
  const columnSeparator = document.page.columnSeparator === "line"
  const twoColumns = isTwoColumns(document)
  const resolvedOrientation = orientation || document.page.orientation
  const pageSize = document.page.size === "LETTER" ? "LETTER" : "A4"
  const pageHeightPt = resolvedOrientation === "landscape"
    ? (document.page.size === "LETTER" ? 612 : 595)
    : (document.page.size === "LETTER" ? 792 : 842)
  const padBottomPt = Math.max(geometry.marginBottomMm * mm, document.footer.visible ? 42 : 20)
  const contentHeightPt = Math.max(60, pageHeightPt - geometry.marginTopMm * mm - padBottomPt)

  const pageStyle = [
    styles.page,
    {
      fontFamily: fontFromFamily(document.page.defaultFontFamily),
      fontSize: document.page.defaultFontSize,
      lineHeight: document.page.lineHeight,
      paddingTop: geometry.marginTopMm * mm,
      paddingRight: geometry.marginRightMm * mm,
      paddingBottom: padBottomPt,
      paddingLeft: geometry.marginLeftMm * mm,
    },
  ]

  const footerView = document.footer.visible ? (
    <View style={styles.fixedFooter} fixed>
      <Text>{footerLeft || "+ Educação · BNCC Planner"}</Text>
      {document.footer.showPageNumber && (
        <Text render={({ pageNumber, totalPages }) => `Página ${pageNumber} de ${totalPages}`} />
      )}
    </View>
  ) : null

  const headerView = document.header.visible && fields.length > 0 ? (
    <View style={styles.headerGrid}>
      {headerFieldRows(fields).map((row, rowIndex) => (
        <View key={rowIndex} style={styles.headerRow}>
          {row.map((field) => {
            const metrics = headerFieldMetrics(field, document.header.layout || "normal")
            const width = `${headerFieldWidth(field, row.length)}%`
            return (
              <View
                key={field.id}
                wrap={false}
                style={[styles.headerLine, { width, textAlign: field.alignment || "left", minHeight: metrics.minHeight, marginBottom: metrics.spacingAfter }]}
              >
                <Text style={[styles.headerLabel, { fontSize: Math.max(6.5, metrics.fontSize - 1) }]}>{field.label}: </Text>
                <Text style={{ fontSize: metrics.fontSize, lineHeight: metrics.lineHeight }}>{field.value || " "}</Text>
              </View>
            )
          })}
        </View>
      ))}
    </View>
  ) : null

  const renderGabarito = (breakBefore = false) =>
    gabaritoQuestions.length > 0 ? (
      <View style={styles.section} break={breakBefore}>
        <View style={styles.sectionTitle}><Text>Gabarito</Text></View>
        <View style={styles.table} wrap>
          <View style={[styles.tableRow, styles.tableHeader]} wrap={false}>
            {["Questão", "Resposta", "Justificativa"].map((header) => (
              <View key={header} style={styles.tableCell}><Text style={{ fontFamily: "Helvetica-Bold" }}>{header}</Text></View>
            ))}
          </View>
          {gabaritoQuestions.map((question) => (
            <View key={question.id} style={styles.tableRow} wrap={false}>
              <View style={[styles.tableCell, { flex: 0.4 }]}><Text>{String(question.number)}</Text></View>
              <View style={[styles.tableCell, { flex: 0.9 }]}><Text>{question.answer || ""}</Text></View>
              <View style={styles.tableCell}><Text>{plainTextFromHtml(question.justification || "")}</Text></View>
            </View>
          ))}
        </View>
      </View>
    ) : null

  // ÚNICA quebra obrigatória: antes da PRIMEIRA seção pedagógica. Depois dela
  // tudo flui naturalmente (Habilidades → Inclusão → Gabarito → Justificativas).
  const pedagogicalBreakEnabled = document.page.pedagogicalPageBreakBefore !== false
  const firstPedagogicalIndex = document.sections.findIndex((section) => section.kind === "pedagogical")

  if (!twoColumns) {
    return (
      <Document
        title={plainTextFromHtml(document.title)}
        subject={document.topic}
        author={teacher || "+ Educação"}
        creator="+ Educação · BNCC Planner"
      >
        <Page size={pageSize} orientation={resolvedOrientation} wrap style={pageStyle}>
          {footerView}

          <View>
            <View style={styles.title}><RichText html={document.title} baseStyle={{ bold: true }} /></View>
            {document.subtitle && <Text style={styles.subtitle}>{document.subtitle}</Text>}
            {headerView}
          </View>

          {document.sections.map((section, sectionIndex) => {
            const breakBefore =
              section.pageBreakBefore === true ||
              (section.kind === "pedagogical" && sectionIndex === firstPedagogicalIndex && pedagogicalBreakEnabled)
            return (
              <View key={section.id} style={styles.section} break={breakBefore}>
                {plainTextFromHtml(section.title).trim() && (
                  <View style={styles.sectionTitle}><RichText html={section.title} baseStyle={{ bold: true }} /></View>
                )}
                {groupSectionElements(section.elements).map((group) =>
                  group.kind === "full" ? (
                    <ElementView key={group.element.id} element={group.element} document={document} assets={assetMap} />
                  ) : (
                    group.questions.map((question) => (
                      <ElementView key={question.id} element={question} document={document} assets={assetMap} />
                    ))
                  ),
                )}
              </View>
            )
          })}

          {/* Gabarito: quebra só quando é o primeiro conteúdo pedagógico (sem BNCC/inclusão). */}
          {renderGabarito(firstPedagogicalIndex === -1 && pedagogicalBreakEnabled)}
        </Page>
      </Document>
    )
  }

  // ===== Duas colunas — Simulado: fluxo vertical independente por coluna =====
  // O MESMO algoritmo do editor (layoutFlow) é aplicado aqui, com alturas
  // estimadas e a geometria de página compartilhada (pageGeometry/buildFlowSpec),
  // sem emparelhar questões em linhas fixas.
  const spec = buildFlowSpec(document, geometry)
  const pages = layoutFlow(
    spec.map((block) => ({ kind: block.kind, id: block.id, height: block.height * pxToPt, breakBefore: block.breakBefore })),
    contentHeightPt,
  )

  const nodeById = new Map<string, React.ReactNode>()
  nodeById.set("__title__", <View style={styles.title}><RichText html={document.title} baseStyle={{ bold: true }} /></View>)
  if (document.subtitle) nodeById.set("__subtitle__", <Text style={styles.subtitle}>{document.subtitle}</Text>)
  if (headerView) nodeById.set("__header__", headerView)
  for (const section of document.sections) {
    if (plainTextFromHtml(section.title).trim()) {
      nodeById.set(
        `section-title-${section.id}`,
        <View style={styles.sectionTitle}><RichText html={section.title} baseStyle={{ bold: true }} /></View>,
      )
    }
    for (const element of section.elements) {
      if (element.type === "pageBreak") continue
      nodeById.set(element.id, <ElementView element={element} document={document} assets={assetMap} />)
    }
  }
  if (gabaritoQuestions.length > 0) nodeById.set("__gabarito__", renderGabarito(false))

  return (
    <Document
      title={plainTextFromHtml(document.title)}
      subject={document.topic}
      author={teacher || "+ Educação"}
      creator="+ Educação · BNCC Planner"
    >
      {pages.map((page, pageIndex) => {
        const left = page.columns[0] ?? []
        const right = page.columns[1] ?? []
        const columnHeightPt = Math.min(
          contentHeightPt,
          Math.max(
            left.reduce((sum, item) => sum + item.height, 0),
            right.reduce((sum, item) => sum + item.height, 0),
          ),
        )
        return (
          <Page key={pageIndex} size={pageSize} orientation={resolvedOrientation} wrap style={pageStyle}>
            {footerView}
            {page.full.map((item) => <React.Fragment key={item.id}>{nodeById.get(item.id)}</React.Fragment>)}
            {left.length > 0 || right.length > 0 ? (
              <View style={{ flexDirection: "row" }}>
                <View style={{ width: columnWidthPt }}>
                  {left.map((item) => <React.Fragment key={item.id}>{nodeById.get(item.id)}</React.Fragment>)}
                </View>
                <View style={{ width: columnGapPt, flexDirection: "row", justifyContent: "center" }}>
                  {columnSeparator ? <View style={{ width: 0.75, height: columnHeightPt, backgroundColor: "#cbd5e1" }} /> : null}
                </View>
                <View style={{ width: columnWidthPt }}>
                  {right.map((item) => <React.Fragment key={item.id}>{nodeById.get(item.id)}</React.Fragment>)}
                </View>
              </View>
            ) : null}
            {page.after.map((item) => <React.Fragment key={item.id}>{nodeById.get(item.id)}</React.Fragment>)}
          </Page>
        )
      })}
    </Document>
  )
}
