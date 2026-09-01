/* eslint-disable @next/next/no-img-element */
import { Fragment } from "react"
import {
  headerFieldMetrics,
  headerFieldRows,
  headerFieldWidth,
  plainTextFromHtml,
  type EditorAssetView,
  type EditorDocument,
  type EditorElement,
  type EditorImageReference,
  type EditorTextStyle,
} from "@/lib/editor-document"
import { buildFlowSpec, layoutFlow, pageGeometry } from "@/lib/document-layout"
import { cn } from "@/lib/utils"

function rich(html: string) {
  return { __html: html }
}

function textStyle(style: EditorTextStyle | undefined, document: EditorDocument): React.CSSProperties {
  return {
    fontFamily: style?.fontFamily || document.page.defaultFontFamily,
    fontSize: `${style?.fontSize || document.page.defaultFontSize}pt`,
    fontWeight: style?.bold ? 700 : undefined,
    fontStyle: style?.italic ? "italic" : undefined,
    textDecoration: style?.underline ? "underline" : undefined,
    color: style?.color || document.page.defaultColor,
    textAlign: style?.alignment || document.page.defaultAlignment || "left",
    lineHeight: style?.lineHeight || document.page.lineHeight,
    marginLeft: style?.indent ? `${style.indent}px` : undefined,
    marginBottom: `${style?.spacingAfter ?? document.page.defaultSpacingAfter ?? 6}px`,
  }
}

function ImageContent({
  reference,
  assets,
}: {
  reference: EditorImageReference
  assets: Map<string, EditorAssetView>
}) {
  const asset = assets.get(reference.assetId)
  if (!asset || asset.status !== "READY") return null
  return (
    <figure
      className={cn(
        "document-asset my-3 break-inside-avoid",
        reference.alignment === "center" && "mx-auto",
        reference.alignment === "right" && "ml-auto",
      )}
      style={{ width: `${reference.widthPercent}%` }}
      data-asset-id={asset.id}
    >
      <img
        src={asset.url}
        alt={asset.altText || ""}
        className="block h-auto max-h-[680px] w-full object-contain"
      />
    </figure>
  )
}

function Element({
  element,
  document,
  assets,
}: {
  element: EditorElement
  document: EditorDocument
  assets: Map<string, EditorAssetView>
}) {
  const style = textStyle(element.style, document)
  if (element.type === "pageBreak") return <div className="document-page-break" aria-hidden="true" />
  if (element.type === "separator") return <hr className="my-5 border-slate-400" />
  if (element.type === "responseSpace") {
    return <div className="mb-3" aria-hidden="true">{Array.from({ length: element.lines }, (_, index) => <div key={index} className="h-7 border-b border-slate-400" />)}</div>
  }
  if (element.type === "heading") {
    const Tag = element.level === 1 ? "h2" : element.level === 2 ? "h3" : "h4"
    return <Tag className={cn("mb-2 mt-4 font-bold", element.level === 1 ? "text-xl" : element.level === 2 ? "text-lg" : "text-base")} style={style} dangerouslySetInnerHTML={rich(element.content)} />
  }
  if (element.type === "paragraph") {
    return <p className="whitespace-pre-wrap" style={style} dangerouslySetInnerHTML={rich(element.content)} />
  }
  if (element.type === "instruction") {
    return <div className="mb-3 break-inside-avoid border-l-4 border-teal-700 bg-teal-50 p-3" style={style} dangerouslySetInnerHTML={rich(element.content)} />
  }
  if (element.type === "textBox") {
    return <div className="mb-3 break-inside-avoid border border-slate-400 p-3" style={style} dangerouslySetInnerHTML={rich(element.content)} />
  }
  if (element.type === "list") {
    const Tag = element.ordered ? "ol" : "ul"
    return (
      <Tag className={cn("mb-3 space-y-1 pl-7", element.ordered ? "list-decimal" : "list-disc")} style={style}>
        {element.items.map((item, index) => <li key={index} dangerouslySetInnerHTML={rich(item)} />)}
      </Tag>
    )
  }
  if (element.type === "table") {
    return (
      <div className="mb-4 overflow-hidden break-inside-avoid border border-slate-400">
        <table className="w-full border-collapse text-sm">
          {element.headers.length > 0 && (
            <thead><tr className="bg-teal-50">{element.headers.map((header, index) => <th key={index} className="border-b border-r border-slate-300 p-2 text-left" dangerouslySetInnerHTML={rich(header)} />)}</tr></thead>
          )}
          <tbody>{element.rows.map((row, rowIndex) => <tr key={rowIndex}>{row.map((cell, cellIndex) => <td key={cellIndex} className="border-b border-r border-slate-300 p-2 align-top" dangerouslySetInnerHTML={rich(cell)} />)}</tr>)}</tbody>
        </table>
      </div>
    )
  }
  if (element.type === "image") {
    return <ImageContent reference={{ assetId: element.assetId, widthPercent: element.widthPercent, alignment: element.alignment }} assets={assets} />
  }

  return (
    <article className="document-question mb-6 break-inside-avoid" style={style} data-question={element.number}>
      <div className="font-semibold leading-relaxed">
        <span>{element.number}. </span>
        <span dangerouslySetInnerHTML={rich(element.content)} />
      </div>
      {element.images.map((image) => <ImageContent key={image.assetId} reference={image} assets={assets} />)}
      {element.alternatives.length > 0 && (
        <ol className="mt-2 space-y-1 pl-6" style={{ textAlign: "left" }}>
          {element.alternatives.map((alternative) => (
            <li key={alternative.id} className="flex gap-2">
              <span>{alternative.letter})</span>
              <span dangerouslySetInnerHTML={rich(alternative.content)} />
            </li>
          ))}
        </ol>
      )}
      {element.responseLines > 0 && (
        <div className="mt-2" aria-hidden="true">{Array.from({ length: element.responseLines }, (_, index) => <div key={index} className="h-7 border-b border-slate-400" />)}</div>
      )}
    </article>
  )
}

export function DocumentRenderer({
  document,
  assets,
  className,
}: {
  document: EditorDocument
  assets: EditorAssetView[]
  className?: string
}) {
  const assetMap = new Map(assets.map((asset) => [asset.id, asset]))
  const school = document.header.fields.find((field) => field.id === "school")?.value
  const footerParts = [
    document.footer.showSchoolName ? school : "",
    document.footer.showMaterialName ? document.title.replace(/<[^>]+>/g, "") : "",
    document.footer.customText,
  ].filter(Boolean)
  const headerLayout = document.header.layout || "normal"
  const geometry = pageGeometry(document)

  // Paginação EXPLÍCITA por página (mesmo algoritmo do PDF: buildFlowSpec +
  // layoutFlow). Cada página tem largura/altura/margens fixas, de modo que as
  // margens valem em TODAS as páginas (inclusive topo/rodapé das páginas 2+).
  const footerReserve = document.footer.visible ? 26 : 0
  const flowHeight = Math.max(1, geometry.usableHeightPx - footerReserve)
  const spec = buildFlowSpec(document, geometry)
  const pages = layoutFlow(
    spec.map((block) => ({ kind: block.kind, id: block.id, height: block.height, breakBefore: block.breakBefore })),
    flowHeight,
  )

  // Nós por id (fonte única de renderização de conteúdo).
  const nodeById = new Map<string, React.ReactNode>()
  nodeById.set("__title__", <h1 className="text-2xl font-bold text-teal-900" dangerouslySetInnerHTML={rich(document.title)} />)
  if (document.subtitle) nodeById.set("__subtitle__", <p className="mt-1 text-xs text-slate-500">{document.subtitle}</p>)
  if (document.header.visible && headerFieldRows(document.header.fields).length > 0) {
    nodeById.set(
      "__header__",
      <div className="mt-3 border-t border-slate-400 pt-3">
        {headerFieldRows(document.header.fields).map((row, rowIndex) => (
          <div key={rowIndex} className="flex items-stretch gap-x-5">
            {row.map((field) => {
              const metrics = headerFieldMetrics(field, headerLayout)
              const width = headerFieldWidth(field, row.length)
              return (
                <div key={field.id} className="min-w-0" style={{ width: `${width}%`, textAlign: field.alignment || "left" }}>
                  <div
                    className="border-b border-slate-400"
                    style={{ minHeight: `${metrics.minHeight}pt`, marginBottom: `${metrics.spacingAfter}pt`, lineHeight: metrics.lineHeight }}
                  >
                    <span className="font-bold uppercase tracking-wide text-slate-500" style={{ fontSize: `${Math.max(6.5, metrics.fontSize - 1)}pt` }}>
                      {field.label}:
                    </span>{" "}
                    <span style={{ fontSize: `${metrics.fontSize}pt` }}>{field.value}</span>
                  </div>
                </div>
              )
            })}
          </div>
        ))}
      </div>,
    )
  }
  for (const section of document.sections) {
    if (section.title.replace(/<[^>]+>/g, "").trim()) {
      nodeById.set(
        `section-title-${section.id}`,
        <h2 className="mb-3 border-b border-teal-200 pb-1 text-lg font-bold text-teal-800" dangerouslySetInnerHTML={rich(section.title)} />,
      )
    }
    for (const element of section.elements) {
      if (element.type === "pageBreak") continue
      nodeById.set(element.id, <Element element={element} document={document} assets={assetMap} />)
    }
  }
  // Gabarito derivado das questões (fonte única de verdade).
  const gabaritoQuestions = document.sections.flatMap((section) =>
    section.elements.filter(
      (element): element is Extract<EditorElement, { type: "question" }> =>
        element.type === "question" && Boolean(element.answer || element.justification),
    ),
  )
  if (gabaritoQuestions.length > 0) {
    nodeById.set(
      "__gabarito__",
      <Fragment>
        <h2 className="mb-3 border-b border-teal-200 pb-1 text-lg font-bold text-teal-800">Gabarito</h2>
        <div className="mb-4 overflow-hidden break-inside-avoid border border-slate-400">
          <table className="w-full border-collapse text-sm">
            <thead><tr className="bg-teal-50"><th className="border-b border-r border-slate-300 p-2 text-left">Questão</th><th className="border-b border-r border-slate-300 p-2 text-left">Resposta</th><th className="border-b border-slate-300 p-2 text-left">Justificativa</th></tr></thead>
            <tbody>
              {gabaritoQuestions.map((question) => (
                <tr key={question.id}>
                  <td className="border-b border-r border-slate-300 p-2 align-top">{question.number}</td>
                  <td className="border-b border-r border-slate-300 p-2 align-top">{question.answer || ""}</td>
                  <td className="border-b border-slate-300 p-2 align-top">{plainTextFromHtml(question.justification || "")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Fragment>,
    )
  }

  const columnSeparator = document.page.columnSeparator === "line"
  const pageStyle: React.CSSProperties = {
    boxSizing: "border-box",
    width: `${geometry.pageWidthMm}mm`,
    height: `${geometry.pageHeightMm}mm`,
    overflow: "hidden",
    padding: `${geometry.marginTopMm}mm ${geometry.marginRightMm}mm ${geometry.marginBottomMm}mm ${geometry.marginLeftMm}mm`,
    fontFamily: document.page.defaultFontFamily,
    fontSize: `${document.page.defaultFontSize}pt`,
    lineHeight: document.page.lineHeight,
  }

  return (
    <div className={cn("print-document-pages", className)}>
      {pages.map((page, pageIndex) => {
        const left = page.columns[0] ?? []
        const right = page.columns[1] ?? []
        return (
          <article
            key={pageIndex}
            className="print-document relative mx-auto mb-6 bg-white text-slate-900 shadow-sm"
            data-page-size={document.page.size}
            data-orientation={document.page.orientation}
            style={{ ...pageStyle, pageBreakAfter: pageIndex < pages.length - 1 ? "always" : undefined }}
          >
            <main className="document-content block">
              {page.full.map((item) => <Fragment key={item.id}>{nodeById.get(item.id)}</Fragment>)}
              {left.length > 0 || right.length > 0 ? (
                <div className="document-question-columns mt-1" style={{ display: "flex", alignItems: "stretch" }}>
                  <div className="document-question-column min-w-0" style={{ width: geometry.columnWidthPx }}>
                    {left.map((item) => <div key={item.id} className="document-question-cell">{nodeById.get(item.id)}</div>)}
                  </div>
                  <div className="document-question-gap shrink-0" style={{ width: geometry.columnGapPx, position: "relative" }}>
                    {columnSeparator && <div className="document-column-separator" style={{ position: "absolute", left: "50%", top: 0, bottom: 0, width: 1, background: "#cbd5e1" }} />}
                  </div>
                  <div className="document-question-column min-w-0" style={{ width: geometry.columnWidthPx }}>
                    {right.map((item) => <div key={item.id} className="document-question-cell">{nodeById.get(item.id)}</div>)}
                  </div>
                </div>
              ) : null}
              {page.after.map((item) => <Fragment key={item.id}>{nodeById.get(item.id)}</Fragment>)}
            </main>

            {document.footer.visible && (
              <footer className="document-footer mt-6 flex border-t border-slate-300 pt-2 text-[10px] text-slate-500">
                <span>{footerParts.join(" · ") || "+ Educação · BNCC Planner"}</span>
                {document.footer.showPageNumber && <span className="ml-auto">Página {pageIndex + 1}</span>}
              </footer>
            )}
          </article>
        )
      })}
    </div>
  )
}
