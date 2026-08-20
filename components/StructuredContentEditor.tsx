"use client"

/* eslint-disable @next/next/no-img-element */
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Bold,
  Check,
  Copy,
  FileDown,
  Heading1,
  ImagePlus,
  Italic,
  List,
  ListOrdered,
  Loader2,
  Minus,
  Plus,
  Printer,
  Redo2,
  Save,
  Table2,
  Trash2,
  Underline,
  Undo2,
  Upload,
} from "lucide-react"
import { AddImageDialog } from "@/components/AddImageDialog"
import { DocumentRenderer } from "@/components/DocumentRenderer"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  sanitizeEditorHtml,
  type EditorAssetView,
  type EditorDocument,
  type EditorElement,
  type EditorImageReference,
  type EditorSection,
  type EditorTextStyle,
} from "@/lib/editor-document"
import { IMAGE_STYLES } from "@/lib/image-options"
import { cn } from "@/lib/utils"

const FONTS = ["Arial", "Helvetica", "Times New Roman", "Georgia", "Verdana", "Trebuchet MS", "Courier New"]
const FONT_SIZES = [8, 9, 10, 11, 12, 14, 16, 18, 20, 24, 28, 32]

function uid(prefix: string) {
  return `${prefix}-${crypto.randomUUID()}`
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

function defaultQuestion(number: number): Extract<EditorElement, { type: "question" }> {
  return {
    id: uid("question"),
    type: "question",
    number,
    content: "Digite o enunciado da nova questão.",
    alternatives: ["__________", "__________", "__________", "__________"].map((content) => ({ id: uid("alternative"), content })),
    responseLines: 0,
    images: [],
  }
}

function newElement(type: string, nextQuestionNumber: number): EditorElement {
  if (type === "heading") return { id: uid("heading"), type: "heading", level: 2, content: "Novo título" }
  if (type === "question") return defaultQuestion(nextQuestionNumber)
  if (type === "instruction") return { id: uid("instruction"), type: "instruction", content: "Digite a instrução." }
  if (type === "textBox") return { id: uid("textbox"), type: "textBox", content: "Digite o conteúdo da caixa de texto." }
  if (type === "table") return { id: uid("table"), type: "table", headers: ["Coluna 1", "Coluna 2"], rows: [["", ""], ["", ""]] }
  if (type === "responseSpace") return { id: uid("response"), type: "responseSpace", lines: 3 }
  if (type === "separator") return { id: uid("separator"), type: "separator" }
  if (type === "pageBreak") return { id: uid("pagebreak"), type: "pageBreak" }
  if (type === "numberedList") return { id: uid("list"), type: "list", ordered: true, items: ["Novo item"] }
  if (type === "list") return { id: uid("list"), type: "list", ordered: false, items: ["Novo item"] }
  return { id: uid("paragraph"), type: "paragraph", content: "Novo parágrafo" }
}

function EditableRichText({
  value,
  onChange,
  onFocus,
  onBlur,
  className,
  ariaLabel,
}: {
  value: string
  onChange: (value: string) => void
  onFocus?: (element: HTMLElement) => void
  onBlur?: () => void
  className?: string
  ariaLabel: string
}) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const element = ref.current
    if (element && document.activeElement !== element && element.innerHTML !== value) element.innerHTML = value
  }, [value])
  return (
    <div
      ref={ref}
      contentEditable
      suppressContentEditableWarning
      role="textbox"
      aria-label={ariaLabel}
      className={cn("min-h-7 rounded-sm px-1 outline-none ring-primary/30 focus:bg-white focus:ring-2", className)}
      dangerouslySetInnerHTML={{ __html: value }}
      onInput={(event) => onChange(sanitizeEditorHtml(event.currentTarget.innerHTML))}
      onFocus={(event) => onFocus?.(event.currentTarget)}
      onBlur={onBlur}
    />
  )
}

function ElementControls({
  label,
  onDuplicate,
  onDelete,
  onUp,
  onDown,
}: {
  label: string
  onDuplicate: () => void
  onDelete: () => void
  onUp: () => void
  onDown: () => void
}) {
  return (
    <div className="editor-element-controls flex flex-wrap items-center gap-1 border-b bg-slate-50 px-2 py-1.5 text-xs print:hidden">
      <span className="mr-auto font-semibold text-slate-600">{label}</span>
      <Button type="button" size="sm" variant="ghost" onClick={onDuplicate} title="Duplicar"><Copy className="h-3.5 w-3.5" /></Button>
      <Button type="button" size="sm" variant="ghost" onClick={onUp} title="Mover para cima"><ArrowUp className="h-3.5 w-3.5" /></Button>
      <Button type="button" size="sm" variant="ghost" onClick={onDown} title="Mover para baixo"><ArrowDown className="h-3.5 w-3.5" /></Button>
      <Button type="button" size="sm" variant="ghost" onClick={onDelete} title="Excluir" className="text-destructive hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></Button>
    </div>
  )
}

function AdvancedImageEditor({
  asset,
  reference,
  onReference,
  onRemove,
  onAssetsChanged,
}: {
  asset: EditorAssetView | undefined
  reference: EditorImageReference
  onReference: (reference: EditorImageReference) => void
  onRemove: () => void
  onAssetsChanged: () => Promise<void>
}) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [prompt, setPrompt] = useState(asset?.prompt || "")
  const [altText, setAltText] = useState(asset?.altText || "")
  const [style, setStyle] = useState(asset?.style || "EDUCATIONAL")
  const [loading, setLoading] = useState("")
  const [error, setError] = useState("")

  if (!asset) return <div className="border border-dashed p-4 text-sm text-destructive">Imagem indisponível.</div>

  const saveMetadata = async () => {
    setLoading("metadata")
    setError("")
    const response = await fetch(`/api/images/${asset.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt, altText, style }),
    })
    setLoading("")
    if (!response.ok) return setError("Não foi possível salvar os metadados.")
    await onAssetsChanged()
  }

  const regenerate = async () => {
    if (!window.confirm("Gerar uma nova versão desta imagem consumirá 1 crédito de imagem. Continuar?")) return
    setLoading("ai")
    setError("")
    const response = await fetch(`/api/images/${asset.id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt, style, coloringPage: style === "COLORING_PAGE", accessible: style === "ACCESSIBLE_INCLUSIVE" }),
    })
    const data: { error?: string } = await response.json().catch(() => ({}))
    setLoading("")
    if (!response.ok) return setError(data.error || "Não foi possível regenerar a imagem.")
    await onAssetsChanged()
  }

  const upload = async (file: File) => {
    setLoading("upload")
    setError("")
    const form = new FormData()
    form.set("file", file)
    const response = await fetch(`/api/images/${asset.id}/upload`, { method: "POST", body: form })
    setLoading("")
    if (!response.ok) return setError("Não foi possível substituir a imagem.")
    await onAssetsChanged()
  }

  return (
    <div className="my-3">
      <div className={cn("flex", reference.alignment === "center" && "justify-center", reference.alignment === "right" && "justify-end")}>
        <img src={asset.url} alt={asset.altText || ""} className="h-auto max-h-[520px] object-contain" style={{ width: `${reference.widthPercent}%` }} />
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2 rounded-md border bg-white p-2 print:hidden">
        <Label className="text-xs">Tamanho</Label>
        <input
          type="range"
          min={20}
          max={100}
          step={5}
          value={reference.widthPercent}
          onChange={(event) => onReference({ ...reference, widthPercent: Number(event.target.value) })}
          aria-label="Largura da imagem"
          className="w-32"
        />
        <span className="w-10 text-xs">{reference.widthPercent}%</span>
        {(["left", "center", "right"] as const).map((alignment) => (
          <Button key={alignment} type="button" size="sm" variant={reference.alignment === alignment ? "secondary" : "ghost"} onClick={() => onReference({ ...reference, alignment })} title={`Alinhar ${alignment}`}>
            {alignment === "left" ? <AlignLeft className="h-4 w-4" /> : alignment === "center" ? <AlignCenter className="h-4 w-4" /> : <AlignRight className="h-4 w-4" />}
          </Button>
        ))}
        <Button type="button" size="sm" variant="ghost" onClick={onRemove} className="ml-auto text-destructive hover:text-destructive"><Trash2 className="mr-1 h-4 w-4" /> Remover</Button>
      </div>
      <details className="mt-2 rounded-md border bg-slate-50 p-3 print:hidden">
        <summary className="cursor-pointer text-sm font-semibold text-primary">Configurações avançadas da imagem</summary>
        <div className="mt-3 grid gap-3 lg:grid-cols-2">
          <div><Label>Prompt da imagem</Label><textarea value={prompt} onChange={(event) => setPrompt(event.target.value)} className="mt-1 min-h-24 w-full rounded-md border bg-white p-2 text-sm" maxLength={1000} /></div>
          <div className="space-y-2">
            <div><Label>Descrição alternativa</Label><textarea value={altText} onChange={(event) => setAltText(event.target.value)} className="mt-1 min-h-16 w-full rounded-md border bg-white p-2 text-sm" maxLength={500} /></div>
            <div><Label>Estilo</Label><select value={style} onChange={(event) => setStyle(event.target.value)} className="mt-1 h-10 w-full rounded-md border bg-white px-2 text-sm">{IMAGE_STYLES.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></div>
          </div>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">Provedor: {asset.provider} · Modelo: {asset.model} · Versão: {asset.version} · Criada em {new Date(asset.createdAt).toLocaleDateString("pt-BR")}</p>
        <p className="mt-1 text-xs text-muted-foreground">A descrição alternativa é usada por tecnologias assistivas e não é impressa como legenda.</p>
        {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
        <div className="mt-3 flex flex-wrap gap-2">
          <Button type="button" size="sm" variant="outline" onClick={saveMetadata} disabled={Boolean(loading)}>{loading === "metadata" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}Salvar configurações</Button>
          <Button type="button" size="sm" onClick={regenerate} disabled={Boolean(loading)}>{loading === "ai" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ImagePlus className="mr-2 h-4 w-4" />}🖼️ Regenerar com IA</Button>
          <Button type="button" size="sm" variant="outline" onClick={() => fileRef.current?.click()} disabled={Boolean(loading)}>{loading === "upload" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}Substituir por arquivo</Button>
          <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(event) => { const file = event.target.files?.[0]; if (file) void upload(file) }} />
          {asset.version > 1 && <Button type="button" size="sm" variant="ghost" asChild><a href={asset.originalUrl} target="_blank" rel="noreferrer">Ver imagem original</a></Button>}
        </div>
      </details>
    </div>
  )
}

export function StructuredContentEditor({
  planId,
  initialDocument,
  initialAssets,
  initialVersion,
}: {
  planId: string
  initialDocument: EditorDocument
  initialAssets: EditorAssetView[]
  initialVersion: number
}) {
  const [documentValue, setDocumentValue] = useState(() => clone(initialDocument))
  const documentRef = useRef(documentValue)
  const [assets, setAssets] = useState(initialAssets)
  const [selected, setSelected] = useState<{ sectionId: string; elementId?: string }>({ sectionId: initialDocument.sections[0]?.id || "" })
  const [tab, setTab] = useState<"edit" | "preview">("edit")
  const [saveState, setSaveState] = useState<"saved" | "dirty" | "saving" | "error" | "conflict">("saved")
  const [saveMessage, setSaveMessage] = useState(`Versão ${initialVersion}`)
  const [saveTick, setSaveTick] = useState(0)
  const versionRef = useRef(initialVersion)
  const lastSavedRef = useRef(JSON.stringify(initialDocument))
  const savingRef = useRef(false)
  const saveAgainRef = useRef(false)
  const activeEditableRef = useRef<HTMLElement | null>(null)
  const newImageFileRef = useRef<HTMLInputElement>(null)
  const [uploadingNewImage, setUploadingNewImage] = useState(false)
  const focusSnapshotRef = useRef<EditorDocument | null>(null)
  const pastRef = useRef<EditorDocument[]>([])
  const futureRef = useRef<EditorDocument[]>([])

  useEffect(() => { documentRef.current = documentValue }, [documentValue])

  const setDocument = useCallback((next: EditorDocument, recordHistory = true) => {
    if (recordHistory) {
      pastRef.current = [...pastRef.current.slice(-49), clone(documentRef.current)]
      futureRef.current = []
    }
    documentRef.current = next
    setDocumentValue(next)
    setSaveState("dirty")
    setSaveMessage("Alterações locais…")
  }, [])

  const mutate = useCallback((recipe: (draft: EditorDocument) => void, recordHistory = true) => {
    const next = clone(documentRef.current)
    recipe(next)
    setDocument(next, recordHistory)
  }, [setDocument])

  const saveNow = useCallback(async () => {
    const serialized = JSON.stringify(documentRef.current)
    if (serialized === lastSavedRef.current) return
    if (savingRef.current) {
      saveAgainRef.current = true
      return
    }
    savingRef.current = true
    saveAgainRef.current = false
    const submittedDocument = clone(documentRef.current)
    setSaveState("saving")
    setSaveMessage("Salvando automaticamente…")
    const response = await fetch(`/api/plans/${planId}/document`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ document: submittedDocument, expectedVersion: versionRef.current }),
    })
    const data: { error?: string; code?: string; version?: number; document?: EditorDocument } = await response.json().catch(() => ({}))
    savingRef.current = false
    if (!response.ok) {
      setSaveState(data.code === "VERSION_CONFLICT" ? "conflict" : "error")
      setSaveMessage(data.error || "Não foi possível salvar.")
      return
    }
    if (data.version) versionRef.current = data.version
    const savedDocument = data.document || submittedDocument
    lastSavedRef.current = JSON.stringify(savedDocument)
    const changedWhileSaving = JSON.stringify(documentRef.current) !== serialized
    if (!changedWhileSaving) {
      documentRef.current = savedDocument
      setDocumentValue(savedDocument)
      setSaveState("saved")
      setSaveMessage(`Salvo automaticamente · Versão ${versionRef.current}`)
    } else {
      setSaveState("dirty")
      setSaveMessage("Novas alterações locais…")
      saveAgainRef.current = true
    }
    if (saveAgainRef.current) setSaveTick((value) => value + 1)
  }, [planId])

  useEffect(() => {
    const serialized = JSON.stringify(documentValue)
    if (serialized === lastSavedRef.current) return
    const timer = window.setTimeout(() => void saveNow(), 1800)
    return () => window.clearTimeout(timer)
  }, [documentValue, saveNow, saveTick])

  const undo = useCallback(() => {
    const previous = pastRef.current.pop()
    if (!previous) return
    futureRef.current.push(clone(documentRef.current))
    setDocument(previous, false)
  }, [setDocument])
  const redo = useCallback(() => {
    const next = futureRef.current.pop()
    if (!next) return
    pastRef.current.push(clone(documentRef.current))
    setDocument(next, false)
  }, [setDocument])

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey)) return
      if (event.key.toLowerCase() === "s") { event.preventDefault(); void saveNow() }
      if (event.key.toLowerCase() === "z" && !event.shiftKey) { event.preventDefault(); undo() }
      if (event.key.toLowerCase() === "y" || (event.key.toLowerCase() === "z" && event.shiftKey)) { event.preventDefault(); redo() }
    }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [redo, saveNow, undo])

  const selectedElement = useMemo(() => {
    const section = documentValue.sections.find((item) => item.id === selected.sectionId)
    return section?.elements.find((item) => item.id === selected.elementId)
  }, [documentValue, selected])

  const updateSelectedStyle = (patch: Partial<EditorTextStyle>) => {
    if (!selected.elementId) return
    mutate((draft) => {
      const element = draft.sections.find((section) => section.id === selected.sectionId)?.elements.find((item) => item.id === selected.elementId)
      if (element) element.style = { ...element.style, ...patch }
    })
  }

  const command = (name: string, value?: string) => {
    const target = activeEditableRef.current
    if (target) {
      target.focus()
      window.document.execCommand(name, false, value)
      target.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "formatBold" }))
      return
    }
    if (name === "bold") updateSelectedStyle({ bold: !selectedElement?.style?.bold })
    if (name === "italic") updateSelectedStyle({ italic: !selectedElement?.style?.italic })
    if (name === "underline") updateSelectedStyle({ underline: !selectedElement?.style?.underline })
  }

  const richFocus = (sectionId: string, elementId: string, element: HTMLElement) => {
    setSelected({ sectionId, elementId })
    activeEditableRef.current = element
    focusSnapshotRef.current = clone(documentRef.current)
  }
  const richBlur = () => {
    activeEditableRef.current = null
    const snapshot = focusSnapshotRef.current
    if (snapshot && JSON.stringify(snapshot) !== JSON.stringify(documentRef.current)) {
      pastRef.current = [...pastRef.current.slice(-49), snapshot]
      futureRef.current = []
    }
    focusSnapshotRef.current = null
  }

  const updateElement = (sectionId: string, elementId: string, updater: (element: EditorElement) => void, record = false) => {
    mutate((draft) => {
      const element = draft.sections.find((section) => section.id === sectionId)?.elements.find((item) => item.id === elementId)
      if (element) updater(element)
    }, record)
  }

  const elementOperation = (sectionId: string, elementId: string, operation: "duplicate" | "delete" | "up" | "down") => {
    mutate((draft) => {
      const section = draft.sections.find((item) => item.id === sectionId)
      if (!section) return
      const index = section.elements.findIndex((item) => item.id === elementId)
      if (index < 0) return
      if (operation === "delete") section.elements.splice(index, 1)
      if (operation === "up" && index > 0) [section.elements[index - 1], section.elements[index]] = [section.elements[index], section.elements[index - 1]]
      if (operation === "down" && index < section.elements.length - 1) [section.elements[index + 1], section.elements[index]] = [section.elements[index], section.elements[index + 1]]
      if (operation === "duplicate") {
        const copy = clone(section.elements[index])
        copy.id = uid(copy.type)
        if (copy.type === "question") {
          copy.number = Math.max(...draft.sections.flatMap((item) => item.elements.filter((element): element is Extract<EditorElement, { type: "question" }> => element.type === "question").map((question) => question.number)), 0) + 1
          copy.alternatives = copy.alternatives.map((alternative) => ({ ...alternative, id: uid("alternative") }))
        }
        section.elements.splice(index + 1, 0, copy)
      }
    })
  }

  const nextQuestionNumber = Math.max(...documentValue.sections.flatMap((section) => section.elements.filter((element): element is Extract<EditorElement, { type: "question" }> => element.type === "question").map((question) => question.number)), 0) + 1

  const addContent = (type: string) => {
    const sectionId = selected.sectionId || documentRef.current.sections[0]?.id
    mutate((draft) => {
      let section = draft.sections.find((item) => item.id === sectionId)
      if (!section) {
        section = { id: uid("section"), title: "Novo conteúdo", elements: [] }
        draft.sections.push(section)
      }
      const element = newElement(type, nextQuestionNumber)
      section.elements.push(element)
      setSelected({ sectionId: section.id, elementId: element.id })
    })
  }

  const refreshAssets = useCallback(async () => {
    const response = await fetch(`/api/plans/${planId}/document`)
    const data: { assets?: EditorAssetView[] } = await response.json().catch(() => ({}))
    if (response.ok && data.assets) setAssets(data.assets)
  }, [planId])

  const addAsset = (assetId: string) => {
    const sectionId = selected.sectionId || documentRef.current.sections[0]?.id
    mutate((draft) => {
      const section = draft.sections.find((item) => item.id === sectionId) || draft.sections[0]
      if (section) section.elements.push({ id: uid("image"), type: "image", assetId, widthPercent: 75, alignment: "center" })
    })
  }

  const afterGeneratedImage = async (assetId?: string) => {
    await refreshAssets()
    if (assetId) addAsset(assetId)
  }

  const uploadNewImage = async (file: File) => {
    setUploadingNewImage(true)
    const form = new FormData()
    form.set("file", file)
    const response = await fetch(`/api/plans/${planId}/images/upload`, { method: "POST", body: form })
    const data: { id?: string; error?: string } = await response.json().catch(() => ({}))
    setUploadingNewImage(false)
    if (!response.ok || !data.id) {
      window.alert(data.error || "Não foi possível adicionar a imagem.")
      return
    }
    await refreshAssets()
    addAsset(data.id)
  }

  const renderElement = (section: EditorSection, element: EditorElement) => {
    const selectedClass = selected.elementId === element.id ? "ring-2 ring-primary/40" : "hover:ring-1 hover:ring-slate-300"
    const controls = (
      <ElementControls
        label={element.type === "question" ? `Questão ${element.number}` : element.type === "image" ? "Imagem" : element.type}
        onDuplicate={() => elementOperation(section.id, element.id, "duplicate")}
        onDelete={() => elementOperation(section.id, element.id, "delete")}
        onUp={() => elementOperation(section.id, element.id, "up")}
        onDown={() => elementOperation(section.id, element.id, "down")}
      />
    )
    const focus = (editable: HTMLElement) => richFocus(section.id, element.id, editable)

    if (element.type === "image") {
      const reference = { assetId: element.assetId, widthPercent: element.widthPercent, alignment: element.alignment }
      return <div key={element.id} className={cn("mb-3 rounded-md border", selectedClass)} onClick={() => setSelected({ sectionId: section.id, elementId: element.id })}>{controls}<div className="p-3"><AdvancedImageEditor key={`${element.assetId}-${assets.find((asset) => asset.id === element.assetId)?.version || 0}`} asset={assets.find((asset) => asset.id === element.assetId)} reference={reference} onReference={(next) => updateElement(section.id, element.id, (target) => { if (target.type === "image") { target.widthPercent = next.widthPercent; target.alignment = next.alignment } }, true)} onRemove={() => elementOperation(section.id, element.id, "delete")} onAssetsChanged={refreshAssets} /></div></div>
    }
    if (element.type === "separator") return <div key={element.id} className={cn("mb-3 rounded-md border", selectedClass)}>{controls}<div className="p-4"><hr /></div></div>
    if (element.type === "pageBreak") return <div key={element.id} className={cn("mb-3 rounded-md border border-dashed border-primary/50 bg-primary/5", selectedClass)}>{controls}<div className="p-3 text-center text-xs font-semibold uppercase tracking-wider text-primary">Quebra de página</div></div>
    if (element.type === "responseSpace") return <div key={element.id} className={cn("mb-3 rounded-md border", selectedClass)}>{controls}<div className="space-y-2 p-3">{Array.from({ length: element.lines }, (_, index) => <div key={index} className="h-7 border-b" />)}<div className="flex items-center gap-2 print:hidden"><Label>Linhas</Label><Input type="number" min={1} max={20} className="w-20" value={element.lines} onChange={(event) => updateElement(section.id, element.id, (target) => { if (target.type === "responseSpace") target.lines = Number(event.target.value) }, true)} /></div></div></div>
    if (element.type === "table") return <div key={element.id} className={cn("mb-3 rounded-md border", selectedClass)}>{controls}<div className="overflow-x-auto p-3"><table className="w-full border-collapse">{element.headers.length > 0 && <thead><tr>{element.headers.map((header, column) => <th key={column} className="border bg-slate-50 p-1"><EditableRichText value={header} ariaLabel={`Cabeçalho ${column + 1}`} onChange={(value) => updateElement(section.id, element.id, (target) => { if (target.type === "table") target.headers[column] = value })} onFocus={focus} onBlur={richBlur} /></th>)}</tr></thead>}<tbody>{element.rows.map((row, rowIndex) => <tr key={rowIndex}>{row.map((cell, column) => <td key={column} className="border p-1"><EditableRichText value={cell} ariaLabel={`Célula ${rowIndex + 1}, ${column + 1}`} onChange={(value) => updateElement(section.id, element.id, (target) => { if (target.type === "table") target.rows[rowIndex][column] = value })} onFocus={focus} onBlur={richBlur} /></td>)}</tr>)}</tbody></table><div className="mt-2 flex gap-2 print:hidden"><Button type="button" size="sm" variant="outline" onClick={() => updateElement(section.id, element.id, (target) => { if (target.type === "table") target.rows.push(Array.from({ length: Math.max(1, target.headers.length) }, () => "")) }, true)}><Plus className="mr-1 h-4 w-4" />Linha</Button><Button type="button" size="sm" variant="outline" onClick={() => updateElement(section.id, element.id, (target) => { if (target.type === "table") { target.headers.push(`Coluna ${target.headers.length + 1}`); target.rows.forEach((row) => row.push("")) } }, true)}><Plus className="mr-1 h-4 w-4" />Coluna</Button></div></div></div>
    if (element.type === "list") return <div key={element.id} className={cn("mb-3 rounded-md border", selectedClass)}>{controls}<div className="p-3"><ol className={cn("space-y-1 pl-7", element.ordered ? "list-decimal" : "list-disc")}>{element.items.map((item, itemIndex) => <li key={itemIndex}><EditableRichText value={item} ariaLabel={`Item ${itemIndex + 1}`} onChange={(value) => updateElement(section.id, element.id, (target) => { if (target.type === "list") target.items[itemIndex] = value })} onFocus={focus} onBlur={richBlur} /></li>)}</ol><Button type="button" size="sm" variant="ghost" className="mt-2 print:hidden" onClick={() => updateElement(section.id, element.id, (target) => { if (target.type === "list") target.items.push("Novo item") }, true)}><Plus className="mr-1 h-4 w-4" />Adicionar item</Button></div></div>
    if (element.type === "question") return <div key={element.id} className={cn("mb-4 rounded-md border", selectedClass)} onClick={() => setSelected({ sectionId: section.id, elementId: element.id })}>{controls}<div className="p-4"><div className="flex gap-2 font-semibold"><Input type="number" min={1} max={999} value={element.number} className="h-9 w-16" aria-label="Número da questão" onChange={(event) => updateElement(section.id, element.id, (target) => { if (target.type === "question") target.number = Number(event.target.value) }, true)} /><EditableRichText value={element.content} ariaLabel={`Enunciado da questão ${element.number}`} className="flex-1" onChange={(value) => updateElement(section.id, element.id, (target) => { if (target.type === "question") target.content = value })} onFocus={focus} onBlur={richBlur} /></div>{element.images.map((image, imageIndex) => <AdvancedImageEditor key={`${image.assetId}-${assets.find((asset) => asset.id === image.assetId)?.version || 0}`} asset={assets.find((asset) => asset.id === image.assetId)} reference={image} onReference={(next) => updateElement(section.id, element.id, (target) => { if (target.type === "question") target.images[imageIndex] = next }, true)} onRemove={() => updateElement(section.id, element.id, (target) => { if (target.type === "question") target.images.splice(imageIndex, 1) }, true)} onAssetsChanged={refreshAssets} />)}<div className="mt-3 space-y-2">{element.alternatives.map((alternative, alternativeIndex) => <div key={alternative.id} className="flex items-start gap-2"><span className="pt-1.5 text-sm font-semibold">{String.fromCharCode(65 + alternativeIndex)})</span><EditableRichText value={alternative.content} ariaLabel={`Alternativa ${String.fromCharCode(65 + alternativeIndex)}`} className="flex-1 border-b" onChange={(value) => updateElement(section.id, element.id, (target) => { if (target.type === "question") target.alternatives[alternativeIndex].content = value })} onFocus={focus} onBlur={richBlur} /><Button type="button" size="sm" variant="ghost" className="print:hidden" onClick={() => updateElement(section.id, element.id, (target) => { if (target.type === "question") target.alternatives.splice(alternativeIndex, 1) }, true)}><Trash2 className="h-3.5 w-3.5" /></Button></div>)}</div><div className="mt-3 flex flex-wrap items-center gap-2 print:hidden"><Button type="button" size="sm" variant="outline" onClick={() => updateElement(section.id, element.id, (target) => { if (target.type === "question") target.alternatives.push({ id: uid("alternative"), content: "Nova alternativa" }) }, true)}><Plus className="mr-1 h-4 w-4" />Alternativa</Button><Label>Linhas de resposta</Label><Input type="number" min={0} max={20} className="w-20" value={element.responseLines} onChange={(event) => updateElement(section.id, element.id, (target) => { if (target.type === "question") target.responseLines = Number(event.target.value) }, true)} /><select className="h-9 rounded-md border px-2 text-sm" value="" onChange={(event) => { const assetId = event.target.value; if (assetId) updateElement(section.id, element.id, (target) => { if (target.type === "question" && !target.images.some((item) => item.assetId === assetId)) target.images.push({ assetId, widthPercent: 75, alignment: "center" }) }, true) }}><option value="">Vincular imagem existente…</option>{assets.filter((asset) => asset.status === "READY").map((asset) => <option key={asset.id} value={asset.id}>{asset.altText || asset.prompt.slice(0, 60)}</option>)}</select></div></div></div>

    const content = element.type === "heading" || element.type === "paragraph" || element.type === "instruction" || element.type === "textBox" ? element.content : ""
    return <div key={element.id} className={cn("mb-3 rounded-md border", selectedClass)} onClick={() => setSelected({ sectionId: section.id, elementId: element.id })}>{controls}<div className={cn("p-3", element.type === "instruction" && "border-l-4 border-primary bg-primary/5", element.type === "textBox" && "m-3 border p-3")}><EditableRichText value={content} ariaLabel={`Editar ${element.type}`} className={element.type === "heading" ? "text-lg font-bold" : ""} onChange={(value) => updateElement(section.id, element.id, (target) => { if (target.type === "heading" || target.type === "paragraph" || target.type === "instruction" || target.type === "textBox") target.content = value })} onFocus={focus} onBlur={richBlur} /></div></div>
  }

  return (
    <div className="space-y-5">
      <div className="sticky top-0 z-30 rounded-lg border bg-white/95 p-2 shadow-sm backdrop-blur print:hidden">
        <div className="flex flex-wrap items-center gap-1">
          <Button type="button" size="sm" variant="ghost" onClick={undo} title="Desfazer (Ctrl+Z)"><Undo2 className="h-4 w-4" /></Button>
          <Button type="button" size="sm" variant="ghost" onClick={redo} title="Refazer (Ctrl+Y)"><Redo2 className="h-4 w-4" /></Button>
          <span className="mx-1 h-7 border-l" />
          <select aria-label="Fonte" className="h-9 rounded-md border px-2 text-sm" value={selectedElement?.style?.fontFamily || documentValue.page.defaultFontFamily} onChange={(event) => { command("fontName", event.target.value); updateSelectedStyle({ fontFamily: event.target.value }) }}>{FONTS.map((font) => <option key={font}>{font}</option>)}</select>
          <select aria-label="Tamanho da fonte" className="h-9 w-20 rounded-md border px-2 text-sm" value={selectedElement?.style?.fontSize || documentValue.page.defaultFontSize} onChange={(event) => { command("fontSize", String(Math.max(1, Math.min(7, Math.round(Number(event.target.value) / 4))))); updateSelectedStyle({ fontSize: Number(event.target.value) }) }}>{FONT_SIZES.map((size) => <option key={size} value={size}>{size}</option>)}</select>
          <Button type="button" size="sm" variant={selectedElement?.style?.bold ? "secondary" : "ghost"} onClick={() => command("bold")} title="Negrito"><Bold className="h-4 w-4" /></Button>
          <Button type="button" size="sm" variant={selectedElement?.style?.italic ? "secondary" : "ghost"} onClick={() => command("italic")} title="Itálico"><Italic className="h-4 w-4" /></Button>
          <Button type="button" size="sm" variant={selectedElement?.style?.underline ? "secondary" : "ghost"} onClick={() => command("underline")} title="Sublinhado"><Underline className="h-4 w-4" /></Button>
          <input type="color" aria-label="Cor do texto" value={selectedElement?.style?.color || "#172133"} onChange={(event) => { command("foreColor", event.target.value); updateSelectedStyle({ color: event.target.value }) }} className="h-8 w-8 cursor-pointer border-0 bg-transparent" />
          <span className="mx-1 h-7 border-l" />
          {(["left", "center", "right", "justify"] as const).map((alignment) => <Button key={alignment} type="button" size="sm" variant={selectedElement?.style?.alignment === alignment ? "secondary" : "ghost"} onClick={() => updateSelectedStyle({ alignment })}>{alignment === "left" ? <AlignLeft className="h-4 w-4" /> : alignment === "center" ? <AlignCenter className="h-4 w-4" /> : alignment === "right" ? <AlignRight className="h-4 w-4" /> : <AlignJustify className="h-4 w-4" />}</Button>)}
          <Button type="button" size="sm" variant="ghost" onClick={() => updateSelectedStyle({ indent: Math.max(0, (selectedElement?.style?.indent || 0) - 12) })} title="Diminuir recuo"><ArrowLeft className="h-4 w-4" /></Button>
          <Button type="button" size="sm" variant="ghost" onClick={() => updateSelectedStyle({ indent: Math.min(80, (selectedElement?.style?.indent || 0) + 12) })} title="Aumentar recuo"><ArrowRight className="h-4 w-4" /></Button>
          <select aria-label="Espaçamento" className="h-9 w-24 rounded-md border px-2 text-sm" value={selectedElement?.style?.lineHeight || documentValue.page.lineHeight} onChange={(event) => updateSelectedStyle({ lineHeight: Number(event.target.value) })}><option value="1">1,0</option><option value="1.15">1,15</option><option value="1.5">1,5</option><option value="2">2,0</option></select>
          <div className="ml-auto flex items-center gap-2 px-2 text-xs"><span className={cn("h-2 w-2 rounded-full", saveState === "saved" ? "bg-emerald-500" : saveState === "error" || saveState === "conflict" ? "bg-red-500" : "bg-amber-500")} />{saveMessage}</div>
          <Button type="button" size="sm" variant="outline" onClick={() => void saveNow()} disabled={saveState === "saving"}>{saveState === "saving" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}Salvar agora</Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-b print:hidden">
        <div className="flex"><button type="button" onClick={() => setTab("edit")} className={cn("border-b-2 px-4 py-3 text-sm font-semibold", tab === "edit" ? "border-primary text-primary" : "border-transparent text-muted-foreground")}>Editor</button><button type="button" onClick={() => setTab("preview")} className={cn("border-b-2 px-4 py-3 text-sm font-semibold", tab === "preview" ? "border-primary text-primary" : "border-transparent text-muted-foreground")}>Preview limpo</button></div>
        <div className="flex gap-2"><Button size="sm" variant="outline" asChild><Link href={`/planos/${planId}/impressao/documento`} target="_blank"><Printer className="mr-2 h-4 w-4" />Imprimir</Link></Button><Button size="sm" asChild><a href={`/api/plans/${planId}/pdf?download=1`}><FileDown className="mr-2 h-4 w-4" />Exportar PDF</a></Button></div>
      </div>

      {tab === "preview" ? <div className="overflow-auto bg-slate-200 p-4"><DocumentRenderer document={documentValue} assets={assets} /></div> : (
        <div className="grid gap-5 xl:grid-cols-[270px_minmax(0,1fr)]">
          <aside className="space-y-4 print:hidden">
            <div className="rounded-lg border bg-card p-4"><h3 className="font-semibold">+ Adicionar conteúdo</h3><div className="mt-3 grid grid-cols-2 gap-2">{[["heading", "Título", Heading1], ["paragraph", "Parágrafo", Plus], ["question", "Questão", Plus], ["instruction", "Instrução", Plus], ["list", "Lista", List], ["numberedList", "Numeração", ListOrdered], ["table", "Tabela", Table2], ["textBox", "Caixa de texto", Plus], ["responseSpace", "Espaço resposta", Plus], ["separator", "Separador", Minus], ["pageBreak", "Quebra página", Plus]].map(([type, label, Icon]) => <Button key={String(type)} type="button" size="sm" variant="outline" className="justify-start" onClick={() => addContent(String(type))}><Icon className="mr-1 h-3.5 w-3.5" />{String(label)}</Button>)}</div><Button type="button" className="mt-2 w-full" onClick={() => addContent("question")}><Plus className="mr-2 h-4 w-4" />Adicionar questão</Button></div>
            <div className="rounded-lg border bg-card p-4"><h3 className="font-semibold">Imagens</h3><p className="mt-1 text-xs text-muted-foreground">Inserir e organizar não consome IA.</p><select className="mt-3 h-10 w-full rounded-md border px-2 text-sm" value="" onChange={(event) => { if (event.target.value) addAsset(event.target.value) }}><option value="">Inserir imagem existente…</option>{assets.filter((asset) => asset.status === "READY").map((asset) => <option key={asset.id} value={asset.id}>{asset.altText || asset.prompt.slice(0, 45)}</option>)}</select><div className="mt-2"><AddImageDialog planId={planId} onAdded={(id) => void afterGeneratedImage(id)} /></div><Button type="button" size="sm" variant="outline" className="mt-2 w-full" onClick={() => newImageFileRef.current?.click()} disabled={uploadingNewImage}>{uploadingNewImage ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}Adicionar arquivo sem IA</Button><input ref={newImageFileRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(event) => { const file = event.target.files?.[0]; if (file) void uploadNewImage(file) }} /></div>
            <details className="rounded-lg border bg-card p-4" open><summary className="cursor-pointer font-semibold">Configurar página</summary><div className="mt-3 space-y-3"><div><Label>Tamanho</Label><select value={documentValue.page.size} onChange={(event) => mutate((draft) => { draft.page.size = event.target.value as "A4" | "LETTER" })} className="mt-1 h-10 w-full rounded-md border px-2"><option value="A4">A4</option><option value="LETTER">Carta</option></select></div><div><Label>Orientação</Label><select value={documentValue.page.orientation} onChange={(event) => mutate((draft) => { draft.page.orientation = event.target.value as "portrait" | "landscape" })} className="mt-1 h-10 w-full rounded-md border px-2"><option value="portrait">Retrato</option><option value="landscape">Paisagem</option></select></div><div className="grid grid-cols-2 gap-2">{(["marginTop", "marginRight", "marginBottom", "marginLeft"] as const).map((key) => <div key={key}><Label>{({ marginTop: "Margem sup.", marginRight: "Margem dir.", marginBottom: "Margem inf.", marginLeft: "Margem esq." })[key]}</Label><Input type="number" min={8} max={50} value={documentValue.page[key]} onChange={(event) => mutate((draft) => { draft.page[key] = Number(event.target.value) })} /></div>)}</div></div></details>
            <details className="rounded-lg border bg-card p-4"><summary className="cursor-pointer font-semibold">Cabeçalho</summary><label className="mt-3 flex items-center gap-2 text-sm"><input type="checkbox" checked={documentValue.header.visible} onChange={(event) => mutate((draft) => { draft.header.visible = event.target.checked })} />Exibir cabeçalho</label><div className="mt-3 space-y-2">{documentValue.header.fields.map((field, fieldIndex) => <div key={field.id} className="rounded border p-2"><label className="flex items-center gap-2 text-xs font-semibold"><input type="checkbox" checked={field.visible} onChange={(event) => mutate((draft) => { draft.header.fields[fieldIndex].visible = event.target.checked })} />{field.label}</label><Input className="mt-1" value={field.value} onChange={(event) => mutate((draft) => { draft.header.fields[fieldIndex].value = event.target.value }, false)} /></div>)}</div></details>
            <details className="rounded-lg border bg-card p-4"><summary className="cursor-pointer font-semibold">Rodapé</summary><div className="mt-3 space-y-2 text-sm"><label className="flex gap-2"><input type="checkbox" checked={documentValue.footer.visible} onChange={(event) => mutate((draft) => { draft.footer.visible = event.target.checked })} />Exibir rodapé</label><label className="flex gap-2"><input type="checkbox" checked={documentValue.footer.showPageNumber} onChange={(event) => mutate((draft) => { draft.footer.showPageNumber = event.target.checked })} />Número da página</label><label className="flex gap-2"><input type="checkbox" checked={documentValue.footer.showSchoolName} onChange={(event) => mutate((draft) => { draft.footer.showSchoolName = event.target.checked })} />Nome da escola</label><label className="flex gap-2"><input type="checkbox" checked={documentValue.footer.showMaterialName} onChange={(event) => mutate((draft) => { draft.footer.showMaterialName = event.target.checked })} />Nome do material</label><Input placeholder="Campo personalizado" value={documentValue.footer.customText} onChange={(event) => mutate((draft) => { draft.footer.customText = event.target.value }, false)} /></div></details>
          </aside>

          <main className="min-w-0 rounded-lg bg-slate-100 p-3 sm:p-5">
            <div className="mx-auto min-h-[900px] max-w-[900px] bg-white p-6 shadow-sm sm:p-10" style={{ fontFamily: documentValue.page.defaultFontFamily, fontSize: `${documentValue.page.defaultFontSize}pt`, lineHeight: documentValue.page.lineHeight }}>
              <EditableRichText value={documentValue.title} ariaLabel="Título do documento" className="mb-2 text-2xl font-bold text-teal-900" onChange={(value) => mutate((draft) => { draft.title = value }, false)} onFocus={(element) => { activeEditableRef.current = element; focusSnapshotRef.current = clone(documentRef.current) }} onBlur={richBlur} />
              {documentValue.sections.map((section, sectionIndex) => <section key={section.id} className={cn("mb-6", selected.sectionId === section.id && "rounded outline outline-1 outline-primary/20")} onClick={() => setSelected((current) => ({ ...current, sectionId: section.id }))}><div className="flex items-center gap-2 border-b border-teal-200 text-teal-800"><EditableRichText value={section.title} ariaLabel={`Título da seção ${sectionIndex + 1}`} className="flex-1 py-2 text-lg font-bold" onChange={(value) => mutate((draft) => { draft.sections[sectionIndex].title = value }, false)} onFocus={(element) => { activeEditableRef.current = element; focusSnapshotRef.current = clone(documentRef.current) }} onBlur={richBlur} /><div className="flex print:hidden"><Button type="button" size="sm" variant="ghost" onClick={() => mutate((draft) => { if (sectionIndex > 0) [draft.sections[sectionIndex - 1], draft.sections[sectionIndex]] = [draft.sections[sectionIndex], draft.sections[sectionIndex - 1]] })}><ArrowUp className="h-4 w-4" /></Button><Button type="button" size="sm" variant="ghost" onClick={() => mutate((draft) => { if (sectionIndex < draft.sections.length - 1) [draft.sections[sectionIndex + 1], draft.sections[sectionIndex]] = [draft.sections[sectionIndex], draft.sections[sectionIndex + 1]] })}><ArrowDown className="h-4 w-4" /></Button></div></div><div className="pt-3">{section.elements.map((element) => renderElement(section, element))}</div></section>)}
              <Button type="button" variant="outline" className="w-full border-dashed print:hidden" onClick={() => mutate((draft) => { const section = { id: uid("section"), title: "Nova seção", elements: [] }; draft.sections.push(section); setSelected({ sectionId: section.id }) })}><Plus className="mr-2 h-4 w-4" />Adicionar seção</Button>
            </div>
          </main>
        </div>
      )}

      {(saveState === "error" || saveState === "conflict") && <div className="fixed bottom-4 right-4 z-50 max-w-md rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-900 shadow-lg print:hidden"><strong>Alterações não salvas.</strong><p className="mt-1">{saveMessage}</p>{saveState === "conflict" && <Button size="sm" variant="outline" className="mt-2" onClick={() => window.location.reload()}>Recarregar documento</Button>}</div>}
      {saveState === "saved" && <span className="sr-only"><Check />Documento salvo.</span>}
    </div>
  )
}
