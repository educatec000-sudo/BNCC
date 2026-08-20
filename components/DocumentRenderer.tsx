/* eslint-disable @next/next/no-img-element */
import type {
  EditorAssetView,
  EditorDocument,
  EditorElement,
  EditorImageReference,
  EditorTextStyle,
} from "@/lib/editor-document"
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
    color: style?.color,
    textAlign: style?.alignment,
    lineHeight: style?.lineHeight || document.page.lineHeight,
    marginLeft: style?.indent ? `${style.indent}px` : undefined,
    marginBottom: `${style?.spacingAfter ?? 6}px`,
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
        <ol className="mt-2 space-y-1 pl-6">
          {element.alternatives.map((alternative, index) => (
            <li key={alternative.id} className="flex gap-2">
              <span>{String.fromCharCode(65 + index)})</span>
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
  const visibleHeaderFields = document.header.fields.filter((field) => field.visible)
  const school = document.header.fields.find((field) => field.id === "school")?.value
  const footerParts = [
    document.footer.showSchoolName ? school : "",
    document.footer.showMaterialName ? document.title.replace(/<[^>]+>/g, "") : "",
    document.footer.customText,
  ].filter(Boolean)
  const landscape = document.page.orientation === "landscape"

  return (
    <article
      className={cn("print-document relative mx-auto bg-white text-slate-900 shadow-sm", className)}
      data-page-size={document.page.size}
      data-orientation={document.page.orientation}
      style={{
        width: landscape ? "297mm" : document.page.size === "LETTER" ? "216mm" : "210mm",
        minHeight: landscape ? "210mm" : document.page.size === "LETTER" ? "279mm" : "297mm",
        paddingTop: `${document.page.marginTop}mm`,
        paddingRight: `${document.page.marginRight}mm`,
        paddingBottom: `${document.page.marginBottom}mm`,
        paddingLeft: `${document.page.marginLeft}mm`,
        fontFamily: document.page.defaultFontFamily,
        fontSize: `${document.page.defaultFontSize}pt`,
        lineHeight: document.page.lineHeight,
      }}
    >
      <header className="document-header mb-5 block border-b border-slate-400 pb-4">
        <h1 className="text-2xl font-bold text-teal-900" dangerouslySetInnerHTML={rich(document.title)} />
        {document.subtitle && <p className="mt-1 text-xs text-slate-500">{document.subtitle}</p>}
        {document.header.visible && visibleHeaderFields.length > 0 && (
          <div className="mt-4 grid grid-cols-2 gap-x-6 gap-y-3">
            {visibleHeaderFields.map((field) => (
              <div key={field.id} className="min-h-9 border-b border-slate-400">
                <span className="text-[10px] font-bold tracking-wide text-slate-600">{field.label}</span>
                <span className="ml-2">{field.value}</span>
              </div>
            ))}
          </div>
        )}
      </header>

      <main className="document-content block p-0">
        {document.sections.map((section) => (
          <section key={section.id} className={cn("mb-5", section.pageBreakBefore && "break-before-page")}>
            {section.title.replace(/<[^>]+>/g, "").trim() && (
              <h2 className="mb-3 border-b border-teal-200 pb-1 text-lg font-bold text-teal-800" dangerouslySetInnerHTML={rich(section.title)} />
            )}
            {section.elements.map((element) => <Element key={element.id} element={element} document={document} assets={assetMap} />)}
          </section>
        ))}
      </main>

      {document.footer.visible && (
        <footer className="document-footer mt-8 flex border-t border-slate-300 pt-2 text-[10px] text-slate-500">
          <span>{footerParts.join(" · ") || "+ Educação · BNCC Planner"}</span>
          {document.footer.showPageNumber && <span className="document-page-number ml-auto">Página</span>}
        </footer>
      )}
    </article>
  )
}
