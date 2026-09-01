"use client"

/* eslint-disable @next/next/no-img-element */
import { Fragment, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react"
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
  Eraser,
  Eye,
  EyeOff,
  FileDown,
  GraduationCap,
  GripVertical,
  Heading1,
  Highlighter,
  ImagePlus,
  Italic,
  List,
  ListOrdered,
  Loader2,
  Maximize,
  Minus,
  MoveHorizontal,
  Plus,
  Printer,
  Redo2,
  RemoveFormatting,
  Save,
  Table2,
  Trash2,
  Underline,
  Undo2,
  Upload,
  ZoomIn,
  ZoomOut,
} from "lucide-react"
import { AddImageDialog } from "@/components/AddImageDialog"
import { DocumentRenderer } from "@/components/DocumentRenderer"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  headerFieldMetrics,
  headerFieldRows,
  headerFieldWidth,
  moveHeaderField as applyMoveHeaderField,
  rebalanceHeaderRow,
  relocateHeaderField as applyRelocateHeaderField,
  sanitizeEditorHtml,
  setHeaderFieldRow as applySetHeaderFieldRow,
  sortHeaderFieldsByRow,
  type EditorAssetView,
  type EditorDocument,
  type EditorElement,
  type EditorHeaderField,
  type EditorImageReference,
  type EditorSection,
  type EditorTextStyle,
} from "@/lib/editor-document"
import { alternativeLetter, normalizeAlternativeText } from "@/lib/alternatives"
import { groupSectionElements, isTwoColumns, layoutFlow, mmToPx, pageDimensionsMm, type FlowPage } from "@/lib/document-layout"
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
    alternatives: ["__________", "__________", "__________", "__________"].map((content, index) => ({
      id: uid("alternative"),
      letter: alternativeLetter(index),
      content,
    })),
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
      className={cn("min-h-7 rounded-sm px-1 outline-none ring-primary/30 focus:bg-background focus:ring-2", className)}
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
    <div className="editor-element-controls flex flex-wrap items-center gap-1 border-b bg-muted/60 px-2 py-1.5 text-xs print:hidden">
      <span className="mr-auto font-semibold text-muted-foreground">{label}</span>
      <Button type="button" size="sm" variant="ghost" onClick={onDuplicate} aria-label="Duplicar elemento"><Copy className="h-3.5 w-3.5" /></Button>
      <Button type="button" size="sm" variant="ghost" onClick={onUp} aria-label="Mover para cima"><ArrowUp className="h-3.5 w-3.5" /></Button>
      <Button type="button" size="sm" variant="ghost" onClick={onDown} aria-label="Mover para baixo"><ArrowDown className="h-3.5 w-3.5" /></Button>
      <Button type="button" size="sm" variant="ghost" onClick={onDelete} aria-label="Excluir elemento" className="text-destructive hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></Button>
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
      <div className="mt-2 flex flex-wrap items-center gap-2 rounded-md border bg-background p-2 print:hidden">
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
      <details className="mt-2 rounded-md border bg-muted/40 p-3 print:hidden">
        <summary className="cursor-pointer text-sm font-semibold text-primary">Configurações avançadas da imagem</summary>
        <div className="mt-3 grid gap-3 lg:grid-cols-2">
          <div><Label>Prompt da imagem</Label><textarea value={prompt} onChange={(event) => setPrompt(event.target.value)} className="mt-1 min-h-24 w-full rounded-md border bg-background p-2 text-sm" maxLength={1000} /></div>
          <div className="space-y-2">
            <div><Label>Descrição alternativa</Label><textarea value={altText} onChange={(event) => setAltText(event.target.value)} className="mt-1 min-h-16 w-full rounded-md border bg-background p-2 text-sm" maxLength={500} /></div>
            <div><Label>Estilo</Label><select value={style} onChange={(event) => setStyle(event.target.value)} className="mt-1 h-10 w-full rounded-md border bg-background px-2 text-sm">{IMAGE_STYLES.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></div>
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
  const savedRangeRef = useRef<Range | null>(null)
  const newImageFileRef = useRef<HTMLInputElement>(null)
  const [uploadingNewImage, setUploadingNewImage] = useState(false)
  const [globalFormat, setGlobalFormat] = useState(false)
  const [zoom, setZoom] = useState(1)
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

  const updateHeaderField = (fieldId: string, patch: Partial<EditorHeaderField>) => {
    mutate((draft) => {
      const field = draft.header.fields.find((item) => item.id === fieldId)
      if (field) Object.assign(field, patch)
    }, false)
  }

  const moveHeaderField = (fieldId: string, direction: "up" | "down") => {
    mutate((draft) => { draft.header.fields = applyMoveHeaderField(draft.header.fields, fieldId, direction) }, false)
  }

  const setHeaderFieldRow = (fieldId: string, row: number) => {
    mutate((draft) => { draft.header.fields = applySetHeaderFieldRow(draft.header.fields, fieldId, row) }, false)
  }

  const toggleHeaderField = (fieldId: string) => {
    mutate((draft) => {
      const field = draft.header.fields.find((item) => item.id === fieldId)
      if (!field) return
      field.visible = !field.visible
      if (field.row !== undefined) rebalanceHeaderRow(draft.header.fields, field.row)
    }, false)
  }

  const addHeaderField = (label: string, value: string, width: number, row: number) => {
    const cleanLabel = label.trim()
    if (!cleanLabel) return
    mutate((draft) => {
      const targetRow = Math.max(1, Math.min(30, Math.round(row)))
      const field: EditorHeaderField = {
        id: `custom-${uid("header")}`,
        label: cleanLabel.slice(0, 60),
        value: value.slice(0, 200),
        visible: true,
        row: targetRow,
        widthPercent: Math.max(5, Math.min(100, Math.round(width) || 100)),
        custom: true,
      }
      draft.header.fields.push(field)
      rebalanceHeaderRow(draft.header.fields, targetRow)
      draft.header.fields = sortHeaderFieldsByRow(draft.header.fields)
    }, false)
  }

  const removeHeaderField = (fieldId: string) => {
    mutate((draft) => {
      const field = draft.header.fields.find((item) => item.id === fieldId)
      if (!field) return
      const row = field.row
      if (field.custom) {
        draft.header.fields = draft.header.fields.filter((item) => item.id !== fieldId)
      } else {
        field.visible = false
      }
      if (row !== undefined) rebalanceHeaderRow(draft.header.fields, row)
    }, false)
  }

  const dragHeaderFieldRef = useRef<string | null>(null)
  const dropHeaderField = (targetId: string) => {
    const draggedId = dragHeaderFieldRef.current
    dragHeaderFieldRef.current = null
    if (!draggedId || draggedId === targetId) return
    mutate((draft) => { draft.header.fields = applyRelocateHeaderField(draft.header.fields, draggedId, targetId) }, false)
  }

  const [newHeaderField, setNewHeaderField] = useState({ label: "", value: "", width: 100, row: 1 })

  // Redimensionar o divisor entre campos de uma linha (arrastar) — funciona com N campos.
  const headerDragRef = useRef<{ leftId: string; rightId: string; startX: number; startLeft: number; startRight: number; rowWidth: number } | null>(null)
  const startHeaderDrag = (event: React.MouseEvent, leftId: string, rightId: string) => {
    const rowEl = (event.currentTarget as HTMLElement).closest("[data-header-row]")
    if (!rowEl) return
    const fields = documentRef.current.header.fields
    const left = fields.find((field) => field.id === leftId)
    const right = fields.find((field) => field.id === rightId)
    if (!left || !right) return
    headerDragRef.current = {
      leftId,
      rightId,
      startX: event.clientX,
      startLeft: left.widthPercent ?? 50,
      startRight: right.widthPercent ?? 50,
      rowWidth: Math.max(1, rowEl.getBoundingClientRect().width),
    }
    event.preventDefault()
  }

  useEffect(() => {
    const onMove = (event: MouseEvent) => {
      const drag = headerDragRef.current
      if (!drag) return
      const deltaPercent = ((event.clientX - drag.startX) / drag.rowWidth) * 100
      const total = drag.startLeft + drag.startRight
      const nextLeft = Math.round(Math.min(total - 5, Math.max(5, drag.startLeft + deltaPercent)))
      mutate((draft) => {
        const left = draft.header.fields.find((field) => field.id === drag.leftId)
        const right = draft.header.fields.find((field) => field.id === drag.rightId)
        if (left) left.widthPercent = nextLeft
        if (right) right.widthPercent = total - nextLeft
      }, false)
    }
    const onUp = () => { headerDragRef.current = null }
    window.addEventListener("mousemove", onMove)
    window.addEventListener("mouseup", onUp)
    return () => {
      window.removeEventListener("mousemove", onMove)
      window.removeEventListener("mouseup", onUp)
    }
  }, [mutate])

  const [inlineFormat, setInlineFormat] = useState({
    bold: false,
    italic: false,
    underline: false,
    ul: false,
    ol: false,
  })

  // Mantém a seleção salva enquanto o usuário digita/seleciona. Botões da barra
  // roubam o foco (e seletores de cor abrem um diálogo do sistema); restaurar o
  // Range aqui é o que faz os comandos agirem sobre o texto selecionado, como no Word.
  useEffect(() => {
    const update = () => {
      const editable = activeEditableRef.current
      const active = document.activeElement
      const withinEditor = Boolean(editable && active && (active === editable || editable.contains(active)))
      if (!withinEditor) return

      const selection = window.getSelection()
      if (selection && selection.rangeCount > 0) {
        savedRangeRef.current = selection.getRangeAt(0).cloneRange()
      }
      // O Safari não implementa queryCommandState; os botões apenas não refletem
      // o estado ativo nesse navegador, sem quebrar a edição.
      const queryState = typeof document.queryCommandState === "function"
        ? (name: string) => document.queryCommandState(name)
        : () => false
      setInlineFormat({
        bold: queryState("bold"),
        italic: queryState("italic"),
        underline: queryState("underline"),
        ul: queryState("insertUnorderedList"),
        ol: queryState("insertOrderedList"),
      })
    }
    document.addEventListener("selectionchange", update)
    return () => document.removeEventListener("selectionchange", update)
  }, [])

  const restoreSelection = () => {
    const editable = activeEditableRef.current
    const range = savedRangeRef.current
    if (!editable || !range) return
    editable.focus()
    const selection = window.getSelection()
    if (!selection) return
    selection.removeAllRanges()
    selection.addRange(range)
  }

  const command = (name: string, value?: string) => {
    const target = activeEditableRef.current
    if (target) {
      restoreSelection()
      window.document.execCommand(name, false, value)
      target.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "formatText" }))
      return
    }
    // Sem texto em edição: aplica o estilo no bloco selecionado (comportamento legado).
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
    if (element.type === "table") return <div key={element.id} className={cn("mb-3 rounded-md border", selectedClass)}>{controls}<div className="overflow-x-auto p-3"><table className="w-full border-collapse">{element.headers.length > 0 && <thead><tr>{element.headers.map((header, column) => <th key={column} className="border bg-muted p-1"><EditableRichText value={header} ariaLabel={`Cabeçalho ${column + 1}`} onChange={(value) => updateElement(section.id, element.id, (target) => { if (target.type === "table") target.headers[column] = value })} onFocus={focus} onBlur={richBlur} /></th>)}</tr></thead>}<tbody>{element.rows.map((row, rowIndex) => <tr key={rowIndex}>{row.map((cell, column) => <td key={column} className="border p-1"><EditableRichText value={cell} ariaLabel={`Célula ${rowIndex + 1}, ${column + 1}`} onChange={(value) => updateElement(section.id, element.id, (target) => { if (target.type === "table") target.rows[rowIndex][column] = value })} onFocus={focus} onBlur={richBlur} /></td>)}</tr>)}</tbody></table><div className="mt-2 flex gap-2 print:hidden"><Button type="button" size="sm" variant="outline" onClick={() => updateElement(section.id, element.id, (target) => { if (target.type === "table") target.rows.push(Array.from({ length: Math.max(1, target.headers.length) }, () => "")) }, true)}><Plus className="mr-1 h-4 w-4" />Linha</Button><Button type="button" size="sm" variant="outline" onClick={() => updateElement(section.id, element.id, (target) => { if (target.type === "table") { target.headers.push(`Coluna ${target.headers.length + 1}`); target.rows.forEach((row) => row.push("")) } }, true)}><Plus className="mr-1 h-4 w-4" />Coluna</Button></div></div></div>
    if (element.type === "list") return <div key={element.id} className={cn("mb-3 rounded-md border", selectedClass)}>{controls}<div className="p-3"><ol className={cn("space-y-1 pl-7", element.ordered ? "list-decimal" : "list-disc")}>{element.items.map((item, itemIndex) => <li key={itemIndex}><EditableRichText value={item} ariaLabel={`Item ${itemIndex + 1}`} onChange={(value) => updateElement(section.id, element.id, (target) => { if (target.type === "list") target.items[itemIndex] = value })} onFocus={focus} onBlur={richBlur} /></li>)}</ol><Button type="button" size="sm" variant="ghost" className="mt-2 print:hidden" onClick={() => updateElement(section.id, element.id, (target) => { if (target.type === "list") target.items.push("Novo item") }, true)}><Plus className="mr-1 h-4 w-4" />Adicionar item</Button></div></div>
    if (element.type === "question") {
      const hasAlternatives = element.alternatives.length > 0
      const answerIsLetter = Boolean(element.answer && /^[A-Z]$/i.test(element.answer))
      return (
        <div key={element.id} className={cn("mb-4 rounded-md border", selectedClass)} onClick={() => setSelected({ sectionId: section.id, elementId: element.id })}>
          {controls}
          <div className="space-y-4 p-4">
            <div>
              <div className="flex items-center gap-2">
                <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Questão</Label>
                <Input type="number" min={1} max={999} value={element.number} className="h-8 w-16" aria-label="Número da questão" onChange={(event) => updateElement(section.id, element.id, (target) => { if (target.type === "question") target.number = Number(event.target.value) }, true)} />
              </div>
              <Label className="mt-2 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">Enunciado</Label>
              <div style={{ textAlign: element.style?.alignment || documentValue.page.defaultAlignment || "left" }}>
                <EditableRichText value={element.content} ariaLabel={`Enunciado da questão ${element.number}`} className="font-semibold" onChange={(value) => updateElement(section.id, element.id, (target) => { if (target.type === "question") target.content = value })} onFocus={focus} onBlur={richBlur} />
              </div>
            </div>

            {element.images.map((image, imageIndex) => <AdvancedImageEditor key={`${image.assetId}-${assets.find((asset) => asset.id === image.assetId)?.version || 0}`} asset={assets.find((asset) => asset.id === image.assetId)} reference={image} onReference={(next) => updateElement(section.id, element.id, (target) => { if (target.type === "question") target.images[imageIndex] = next }, true)} onRemove={() => updateElement(section.id, element.id, (target) => { if (target.type === "question") target.images.splice(imageIndex, 1) }, true)} onAssetsChanged={refreshAssets} />)}

            <div>
              <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Alternativas</Label>
              <div className="mt-2 space-y-2">
                {element.alternatives.map((alternative, alternativeIndex) => (
                  <div key={alternative.id} className="flex items-start gap-2">
                    <span className="w-6 shrink-0 pt-1.5 text-right text-sm font-semibold">{alternative.letter})</span>
                    <EditableRichText
                      value={alternative.content}
                      ariaLabel={`Alternativa ${alternative.letter}`}
                      className="flex-1 border-b"
                      onChange={(value) => updateElement(section.id, element.id, (target) => { if (target.type === "question") target.alternatives[alternativeIndex].content = normalizeAlternativeText(value) }, true)}
                      onFocus={focus}
                      onBlur={richBlur}
                    />
                    <Button type="button" size="sm" variant="ghost" className="print:hidden" aria-label={`Remover alternativa ${alternative.letter}`} onClick={() => updateElement(section.id, element.id, (target) => { if (target.type === "question") target.alternatives.splice(alternativeIndex, 1) }, true)}><Trash2 className="h-3.5 w-3.5" /></Button>
                  </div>
                ))}
              </div>
              <Button type="button" size="sm" variant="outline" className="mt-2 print:hidden" onClick={() => updateElement(section.id, element.id, (target) => { if (target.type === "question") target.alternatives.push({ id: uid("alternative"), letter: alternativeLetter(target.alternatives.length), content: "Nova alternativa" }) }, true)}><Plus className="mr-1 h-4 w-4" />Alternativa</Button>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Resposta correta</Label>
                {hasAlternatives ? (
                  <>
                    <select
                      className="mt-1 h-9 w-full rounded-md border bg-background px-2 text-sm"
                      value={answerIsLetter ? (element.answer || "").toUpperCase() : ""}
                      onChange={(event) => updateElement(section.id, element.id, (target) => { if (target.type === "question") target.answer = event.target.value || undefined }, true)}
                      aria-label="Resposta correta"
                    >
                      <option value="">— aberta / sem alternativa correta —</option>
                      {element.alternatives.map((alternative) => <option key={alternative.id} value={alternative.letter}>{alternative.letter}</option>)}
                    </select>
                    {element.answer && !answerIsLetter && (
                      <p className="mt-1 text-xs text-muted-foreground">Resposta atual (texto): {element.answer}</p>
                    )}
                  </>
                ) : (
                  <EditableRichText value={element.answer || ""} ariaLabel="Resposta esperada" className="mt-1 border-b" onChange={(value) => updateElement(section.id, element.id, (target) => { if (target.type === "question") target.answer = value || undefined }, true)} onFocus={focus} onBlur={richBlur} />
                )}
              </div>
              <div>
                <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Habilidade BNCC</Label>
                <Input className="mt-1" value={element.bnccSkill || ""} placeholder="Ex.: EF05MA03" onChange={(event) => updateElement(section.id, element.id, (target) => { if (target.type === "question") target.bnccSkill = event.target.value || undefined }, true)} />
              </div>
            </div>

            <div>
              <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Justificativa</Label>
              <EditableRichText value={element.justification || ""} ariaLabel={`Justificativa da questão ${element.number}`} className="mt-1 border-b" onChange={(value) => updateElement(section.id, element.id, (target) => { if (target.type === "question") target.justification = value || undefined }, true)} onFocus={focus} onBlur={richBlur} />
            </div>

            {element.objective ? (
              <div>
                <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Objetivo</Label>
                <EditableRichText value={element.objective} ariaLabel={`Objetivo da questão ${element.number}`} className="mt-1 border-b" onChange={(value) => updateElement(section.id, element.id, (target) => { if (target.type === "question") target.objective = value || undefined }, true)} onFocus={focus} onBlur={richBlur} />
              </div>
            ) : null}

            <div className="flex flex-wrap items-center gap-2 border-t pt-3 print:hidden">
              <Label>Linhas de resposta</Label>
              <Input type="number" min={0} max={20} className="w-20" value={element.responseLines} onChange={(event) => updateElement(section.id, element.id, (target) => { if (target.type === "question") target.responseLines = Number(event.target.value) }, true)} />
              <select aria-label="Vincular imagem existente à questão" className="h-9 rounded-md border px-2 text-sm" value="" onChange={(event) => { const assetId = event.target.value; if (assetId) updateElement(section.id, element.id, (target) => { if (target.type === "question" && !target.images.some((item) => item.assetId === assetId)) target.images.push({ assetId, widthPercent: 75, alignment: "center" }) }, true) }}><option value="">Vincular imagem existente…</option>{assets.filter((asset) => asset.status === "READY").map((asset) => <option key={asset.id} value={asset.id}>{asset.altText || asset.prompt.slice(0, 60)}</option>)}</select>
            </div>
          </div>
        </div>
      )
    }

    const content = element.type === "heading" || element.type === "paragraph" || element.type === "instruction" || element.type === "textBox" ? element.content : ""
    return <div key={element.id} className={cn("mb-3 rounded-md border", selectedClass)} onClick={() => setSelected({ sectionId: section.id, elementId: element.id })}>{controls}<div className={cn("p-3", element.type === "instruction" && "border-l-4 border-primary bg-primary/5", element.type === "textBox" && "m-3 border p-3")} style={{ textAlign: element.style?.alignment || documentValue.page.defaultAlignment || "left" }}><EditableRichText value={content} ariaLabel={`Editar ${element.type}`} className={element.type === "heading" ? "text-lg font-bold" : ""} onChange={(value) => updateElement(section.id, element.id, (target) => { if (target.type === "heading" || target.type === "paragraph" || target.type === "instruction" || target.type === "textBox") target.content = value })} onFocus={focus} onBlur={richBlur} /></div></div>
  }

  // ===================== Canvas A4 paginado =====================
  const pageDim = pageDimensionsMm(documentValue)
  const pageWidthPx = mmToPx(pageDim.width)
  const pageHeightPx = mmToPx(pageDim.height)
  const padTop = mmToPx(documentValue.page.marginTop)
  const padRight = mmToPx(documentValue.page.marginRight)
  const padBottom = mmToPx(documentValue.page.marginBottom)
  const padLeft = mmToPx(documentValue.page.marginLeft)
  const contentWidth = Math.max(120, pageWidthPx - padLeft - padRight)
  const contentHeight = Math.max(120, pageHeightPx - padTop - padBottom)
  const twoColumns = isTwoColumns(documentValue)

  const pageFontStyle = {
    fontFamily: documentValue.page.defaultFontFamily,
    fontSize: `${documentValue.page.defaultFontSize}pt`,
    lineHeight: documentValue.page.lineHeight,
    color: documentValue.page.defaultColor || undefined,
  } as const

  const focusMeta = (element: HTMLElement) => {
    activeEditableRef.current = element
    focusSnapshotRef.current = clone(documentRef.current)
  }

  interface CanvasBlock { key: string; breakBefore: boolean; flow: "full" | "question"; node: ReactNode }

  const blocks: CanvasBlock[] = []
  blocks.push({
    key: "block-title",
    breakBefore: false,
    flow: "full",
    node: <EditableRichText value={documentValue.title} ariaLabel="Título do documento" className="mb-2 text-2xl font-bold text-teal-900" onChange={(value) => mutate((draft) => { draft.title = value }, false)} onFocus={focusMeta} onBlur={richBlur} />,
  })
  if (documentValue.header.visible && headerFieldRows(documentValue.header.fields).length > 0) {
    blocks.push({
      key: "block-header",
      breakBefore: false,
      flow: "full",
      node: (
        <div className="mb-4">
          {headerFieldRows(documentValue.header.fields).map((row, rowIndex) => {
            const metrics = headerFieldMetrics(row[0], documentValue.header.layout || "normal")
            return (
              <div key={rowIndex} data-header-row className="flex items-stretch">
                {row.map((field, fieldIndex) => (
                  <Fragment key={field.id}>
                    {fieldIndex > 0 && <div className="w-2 shrink-0 cursor-col-resize rounded transition-colors hover:bg-primary/30" title="Arrastar para redimensionar" onMouseDown={(event) => startHeaderDrag(event, row[fieldIndex - 1].id, field.id)} />}
                    <div className="min-w-0" style={{ width: `${headerFieldWidth(field, row.length)}%` }}>
                      <div className="flex items-end gap-1">
                        <span className="shrink-0 text-[9px] font-bold uppercase tracking-wide text-slate-500">{field.label}:</span>
                        <input
                          className="min-w-0 flex-1 border-b border-slate-400 bg-transparent px-1 outline-none focus:bg-primary/5"
                          style={{ fontSize: `${field.fontSize ?? metrics.fontSize}pt`, minHeight: `${field.minHeight ?? metrics.minHeight}pt`, lineHeight: field.lineHeight ?? metrics.lineHeight, textAlign: field.alignment || "left" }}
                          value={field.value}
                          onChange={(event) => updateHeaderField(field.id, { value: event.target.value })}
                        />
                      </div>
                      <div style={{ height: `${field.spacingAfter ?? metrics.spacingAfter}pt` }} />
                    </div>
                  </Fragment>
                ))}
              </div>
            )
          })}
        </div>
      ),
    })
  }
  let pendingBreak = false
  const columnGapPx = documentValue.page.columnGap ?? 24
  const columnSeparator = documentValue.page.columnSeparator === "line"
  const questionColumnWidth = twoColumns ? Math.max(120, Math.floor((contentWidth - columnGapPx) / 2)) : contentWidth
  const columnStyle: React.CSSProperties | undefined = twoColumns
    ? { columnCount: 2, columnGap: `${columnGapPx}px`, columnFill: "balance", ...(columnSeparator ? { columnRule: "1px solid #cbd5e1" } : {}) }
    : undefined

  let fimAtividadeMarked = false
  let pedagogicalStarted = false
  documentValue.sections.forEach((section, sectionIndex) => {
    const pedagogical = section.kind === "pedagogical"
    const isFirstPedagogical = pedagogical && !pedagogicalStarted
    if (pedagogical) pedagogicalStarted = true
    // ÚNICA quebra obrigatória: antes da primeira seção pedagógica.
    const pedagogicalBreak = isFirstPedagogical && documentValue.page.pedagogicalPageBreakBefore !== false
    // Marcador visual de fim da folha do aluno (apenas entre atividade e BNCC).
    if (pedagogical && !fimAtividadeMarked && sectionIndex > 0) {
      blocks.push({
        key: "marker-fim-atividade",
        breakBefore: false,
        flow: "full",
        node: (
          <div className="my-2 flex items-center gap-3 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
            <span className="h-px flex-1 border-t border-dashed border-slate-400" />
            <span>FIM DA ATIVIDADE</span>
            <span className="h-px flex-1 border-t border-dashed border-slate-400" />
          </div>
        ),
      })
      fimAtividadeMarked = true
    }
    blocks.push({
      key: `section-${section.id}`,
      breakBefore: section.pageBreakBefore === true || pendingBreak || pedagogicalBreak,
      flow: "full",
      node: (
        <div>
          {pedagogical && (
            <div className="flex items-center gap-3 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
              <span className="h-px flex-1 border-t border-dashed border-slate-400" />
              <span>INFORMAÇÕES PEDAGÓGICAS</span>
              <span className="h-px flex-1 border-t border-dashed border-slate-400" />
            </div>
          )}
          <div className="flex items-center gap-2 border-b border-teal-200 text-teal-800" onClick={() => setSelected((current) => ({ ...current, sectionId: section.id }))}>
            <EditableRichText value={section.title} ariaLabel={`Título da seção ${sectionIndex + 1}`} className="flex-1 py-2 text-lg font-bold" onChange={(value) => mutate((draft) => { draft.sections[sectionIndex].title = value }, false)} onFocus={focusMeta} onBlur={richBlur} />
            <div className="flex print:hidden">
              <Button type="button" size="sm" variant={pedagogical ? "secondary" : "ghost"} aria-label="Alternar seção pedagógica (BNCC)" title={pedagogical ? "Seção pedagógica (BNCC/inclusão). Clique para torná-la parte da atividade." : "Marcar como seção pedagógica (BNCC/inclusão): uma coluna e início em nova página."} onClick={() => mutate((draft) => { const target = draft.sections[sectionIndex]; target.kind = pedagogical ? undefined : "pedagogical" })}><GraduationCap className="h-4 w-4" /></Button>
              <Button type="button" size="sm" variant="ghost" aria-label="Mover seção para cima" onClick={() => mutate((draft) => { if (sectionIndex > 0) [draft.sections[sectionIndex - 1], draft.sections[sectionIndex]] = [draft.sections[sectionIndex], draft.sections[sectionIndex - 1]] })}><ArrowUp className="h-4 w-4" /></Button>
              <Button type="button" size="sm" variant="ghost" aria-label="Mover seção para baixo" onClick={() => mutate((draft) => { if (sectionIndex < draft.sections.length - 1) [draft.sections[sectionIndex + 1], draft.sections[sectionIndex]] = [draft.sections[sectionIndex], draft.sections[sectionIndex + 1]] })}><ArrowDown className="h-4 w-4" /></Button>
            </div>
          </div>
        </div>
      ),
    })
    pendingBreak = false
    for (const group of groupSectionElements(section.elements)) {
      if (group.kind === "full") {
        const breaks = group.element.type === "pageBreak"
        blocks.push({ key: `el-${group.element.id}`, breakBefore: false, flow: "full", node: renderElement(section, group.element) })
        if (breaks) pendingBreak = true
      } else if (twoColumns && !pedagogical) {
        // Fluxo de colunas independentes: cada questão é um bloco medido na largura
        // real de coluna e distribuído por altura — nunca emparelhado em linha fixa.
        for (const question of group.questions) {
          blocks.push({
            key: `el-${question.id}`,
            breakBefore: pendingBreak,
            flow: "question",
            node: <div className="min-w-0" style={{ width: questionColumnWidth }}>{renderElement(section, question)}</div>,
          })
          pendingBreak = false
        }
      } else {
        for (const question of group.questions) {
          blocks.push({ key: `el-${question.id}`, breakBefore: pendingBreak, flow: "full", node: renderElement(section, question) })
          pendingBreak = false
        }
      }
    }
  })

  // Medição das alturas dos blocos (a mesma ordem do fluxo real) para paginar.
  const measureRef = useRef<HTMLDivElement>(null)
  const measuredRef = useRef<{ key: string; height: number; breakBefore: boolean }[]>([])
  const [measured, setMeasured] = useState<{ key: string; height: number; breakBefore: boolean }[]>([])

  useLayoutEffect(() => {
    const container = measureRef.current
    if (!container) return
    const measure = () => {
      const items = Array.from(container.querySelectorAll<HTMLElement>("[data-block]"))
      if (items.length === 0) return
      const tops = items.map((element) => element.offsetTop)
      const total = container.scrollHeight
      const heights = items.map((element, index) => ({
        key: element.dataset.blockKey || "",
        breakBefore: element.dataset.breakBefore === "true",
        height: index + 1 < items.length ? Math.max(1, tops[index + 1] - tops[index]) : Math.max(1, total - tops[index]),
      }))
      const signature = JSON.stringify(heights)
      if (signature !== JSON.stringify(measuredRef.current)) {
        measuredRef.current = heights
        setMeasured(heights)
      }
    }
    measure()
    if (typeof ResizeObserver !== "undefined") {
      const observer = new ResizeObserver(() => measure())
      observer.observe(container)
      return () => observer.disconnect()
    }
  }, [])

  const nodeByKey = new Map(blocks.map((block) => [block.key, block.node]))

  // Fluxo real do documento: blocos de largura total são paginados normalmente e
  // as questões entram em duas colunas independentes (balanceadas por altura real).
  const pages: FlowPage[] | null = measured.length === blocks.length && blocks.length > 0
    ? layoutFlow(blocks.map((block, index) => {
        const measurement = measured[index]
        return { kind: block.flow, id: block.key, height: measurement.height, breakBefore: measurement.breakBefore }
      }), contentHeight)
    : null

  const canvasScrollRef = useRef<HTMLDivElement>(null)
  const fitWidth = () => {
    const element = canvasScrollRef.current
    if (!element) return
    setZoom(Math.max(0.3, (element.clientWidth - 64) / pageWidthPx))
  }
  const fitPage = () => {
    const element = canvasScrollRef.current
    if (!element) return
    setZoom(Math.max(0.3, Math.min((element.clientWidth - 64) / pageWidthPx, (element.clientHeight - 64) / pageHeightPx)))
  }

  const pageStyle = { width: pageWidthPx, background: "#fff", boxShadow: "0 1px 3px rgba(0,0,0,.2)", ...pageFontStyle } as const

  const renderPage = (page: FlowPage, pageIndex: number) => {
    const left = (page.columns[0] ?? []).map((item) => <div key={item.id}>{nodeByKey.get(item.id)}</div>)
    const right = (page.columns[1] ?? []).map((item) => <div key={item.id}>{nodeByKey.get(item.id)}</div>)
    const hasColumns = left.length > 0 || right.length > 0
    return (
      <div key={pageIndex}>
        <div className="mb-1.5 mt-4 text-center text-[11px] font-semibold uppercase tracking-wider text-muted-foreground print:hidden">Página {pageIndex + 1}</div>
        <div className="editor-page" style={{ ...pageStyle, height: pageHeightPx, padding: `${padTop}px ${padRight}px ${padBottom}px ${padLeft}px`, overflow: "hidden" }}>
          {page.full.map((item) => <div key={item.id}>{nodeByKey.get(item.id)}</div>)}
          {hasColumns && (
            <div className="mt-1" style={columnStyle}>
              {left}
              {right}
            </div>
          )}
        </div>
      </div>
    )
  }

  const fallbackPage = (
    <div>
      <div className="mb-1.5 mt-4 text-center text-[11px] font-semibold uppercase tracking-wider text-muted-foreground print:hidden">Página 1</div>
      <div className="editor-page" style={{ ...pageStyle, minHeight: pageHeightPx, padding: `${padTop}px ${padRight}px ${padBottom}px ${padLeft}px` }}>
        {blocks.map((block) => <div key={block.key}>{block.node}</div>)}
      </div>
    </div>
  )

  const scaledPageHeight = pageHeightPx * (pages?.length || 1)

  return (
    <div className="space-y-5">
      <div className="sticky top-0 z-30 rounded-lg border bg-background/95 p-2 shadow-sm backdrop-blur print:hidden">
        <div
          className="flex flex-wrap items-center gap-1"
          onMouseDown={(event) => {
            // Impede que os botões roubem o foco do texto: mantém a seleção ativa
            // para que o comando se aplique ao trecho marcado, como no Word.
            if ((event.target as HTMLElement).closest("button")) event.preventDefault()
          }}
        >
          <Button type="button" size="sm" variant="ghost" onClick={undo} aria-label="Desfazer (Ctrl+Z)"><Undo2 className="h-4 w-4" /></Button>
          <Button type="button" size="sm" variant="ghost" onClick={redo} aria-label="Refazer (Ctrl+Y)"><Redo2 className="h-4 w-4" /></Button>
          <span className="mx-1 h-7 border-l" />
          <Button
            type="button"
            size="sm"
            variant={globalFormat ? "default" : "outline"}
            className={cn("shrink-0", globalFormat && "bg-primary text-primary-foreground")}
            title="Quando ativo, fonte, tamanho, cor, alinhamento e espaçamento da barra são aplicados ao documento inteiro."
            onClick={() => setGlobalFormat((value) => !value)}
          >
            <Maximize className="mr-1.5 h-3.5 w-3.5" />Formatação global{globalFormat && <span className="ml-1.5 rounded bg-primary-foreground/20 px-1 text-[10px] font-bold">ON</span>}
          </Button>
          <span className="mx-1 h-7 border-l" />
          <select
            aria-label="Estilo do parágrafo"
            title="Estilo do parágrafo"
            defaultValue=""
            className="h-9 w-28 rounded-md border px-2 text-sm"
            onChange={(event) => {
              const style = event.target.value
              if (style) command("formatBlock", style)
              event.currentTarget.value = ""
            }}
          >
            <option value="" disabled>Estilo…</option>
            <option value="p">Normal</option>
            <option value="h2">Título</option>
            <option value="h3">Subtítulo</option>
          </select>
          <select aria-label="Fonte" className="h-9 rounded-md border px-2 text-sm" value={selectedElement?.style?.fontFamily || documentValue.page.defaultFontFamily} onChange={(event) => { if (globalFormat) { mutate((draft) => { draft.page.defaultFontFamily = event.target.value }) } else { command("fontName", event.target.value); updateSelectedStyle({ fontFamily: event.target.value }) } }}>{FONTS.map((font) => <option key={font}>{font}</option>)}</select>
          <select aria-label="Tamanho da fonte" className="h-9 w-20 rounded-md border px-2 text-sm" value={selectedElement?.style?.fontSize || documentValue.page.defaultFontSize} onChange={(event) => { if (globalFormat) { mutate((draft) => { draft.page.defaultFontSize = Number(event.target.value) }) } else { command("fontSize", String(Math.max(1, Math.min(7, Math.round(Number(event.target.value) / 4))))); updateSelectedStyle({ fontSize: Number(event.target.value) }) } }}>{FONT_SIZES.map((size) => <option key={size} value={size}>{size}</option>)}</select>
          <span className="mx-1 h-7 border-l" />
          <Button type="button" size="sm" variant={inlineFormat.bold || selectedElement?.style?.bold ? "secondary" : "ghost"} onClick={() => command("bold")} aria-label="Negrito" title="Negrito (Ctrl+B)"><Bold className="h-4 w-4" /></Button>
          <Button type="button" size="sm" variant={inlineFormat.italic || selectedElement?.style?.italic ? "secondary" : "ghost"} onClick={() => command("italic")} aria-label="Itálico" title="Itálico (Ctrl+I)"><Italic className="h-4 w-4" /></Button>
          <Button type="button" size="sm" variant={inlineFormat.underline || selectedElement?.style?.underline ? "secondary" : "ghost"} onClick={() => command("underline")} aria-label="Sublinhado" title="Sublinhado (Ctrl+U)"><Underline className="h-4 w-4" /></Button>
          <span className="mx-1 h-7 border-l" />
          <span className="flex items-center gap-0.5" title="Cor do texto">
            <input type="color" aria-label="Cor do texto" value={selectedElement?.style?.color || documentValue.page.defaultColor || "#172133"} onChange={(event) => { if (globalFormat) { mutate((draft) => { draft.page.defaultColor = event.target.value }) } else { command("foreColor", event.target.value); updateSelectedStyle({ color: event.target.value }) } }} className="h-8 w-8 cursor-pointer border-0 bg-transparent" />
          </span>
          <span className="flex items-center gap-0.5" title="Marcador de texto">
            <Highlighter className="ml-1 h-4 w-4 text-muted-foreground" aria-hidden="true" />
            <input type="color" aria-label="Cor do marcador de texto" defaultValue="#ffff00" onChange={(event) => command("hiliteColor", event.target.value)} className="h-8 w-8 cursor-pointer border-0 bg-transparent" />
            <Button type="button" size="sm" variant="ghost" onClick={() => command("hiliteColor", "transparent")} aria-label="Remover marcação" title="Remover marcação"><Eraser className="h-4 w-4" /></Button>
          </span>
          <span className="mx-1 h-7 border-l" />
          <Button type="button" size="sm" variant={inlineFormat.ul ? "secondary" : "ghost"} onClick={() => command("insertUnorderedList")} aria-label="Lista com marcadores" title="Lista com marcadores"><List className="h-4 w-4" /></Button>
          <Button type="button" size="sm" variant={inlineFormat.ol ? "secondary" : "ghost"} onClick={() => command("insertOrderedList")} aria-label="Lista numerada" title="Lista numerada"><ListOrdered className="h-4 w-4" /></Button>
          <Button type="button" size="sm" variant="ghost" onClick={() => command("removeFormat")} aria-label="Limpar formatação" title="Limpar formatação"><RemoveFormatting className="h-4 w-4" /></Button>
          <span className="mx-1 h-7 border-l" />
          {(["left", "center", "right", "justify"] as const).map((alignment) => <Button key={alignment} type="button" size="sm" variant={(globalFormat ? documentValue.page.defaultAlignment === alignment : selectedElement?.style?.alignment === alignment) ? "secondary" : "ghost"} aria-label={{ left: "Alinhar à esquerda", center: "Centralizar", right: "Alinhar à direita", justify: "Justificar" }[alignment]} onClick={() => { if (globalFormat) mutate((draft) => { draft.page.defaultAlignment = alignment }) ; else updateSelectedStyle({ alignment }) }}>{alignment === "left" ? <AlignLeft className="h-4 w-4" /> : alignment === "center" ? <AlignCenter className="h-4 w-4" /> : alignment === "right" ? <AlignRight className="h-4 w-4" /> : <AlignJustify className="h-4 w-4" />}</Button>)}
          <Button type="button" size="sm" variant="ghost" onClick={() => updateSelectedStyle({ indent: Math.max(0, (selectedElement?.style?.indent || 0) - 12) })} aria-label="Diminuir recuo"><ArrowLeft className="h-4 w-4" /></Button>
          <Button type="button" size="sm" variant="ghost" onClick={() => updateSelectedStyle({ indent: Math.min(80, (selectedElement?.style?.indent || 0) + 12) })} aria-label="Aumentar recuo"><ArrowRight className="h-4 w-4" /></Button>
          <select aria-label="Espaçamento" className="h-9 w-24 rounded-md border px-2 text-sm" value={selectedElement?.style?.lineHeight || documentValue.page.lineHeight} onChange={(event) => { if (globalFormat) mutate((draft) => { draft.page.lineHeight = Number(event.target.value) }) ; else updateSelectedStyle({ lineHeight: Number(event.target.value) }) }}><option value="1">1,0</option><option value="1.15">1,15</option><option value="1.5">1,5</option><option value="2">2,0</option></select>
          <div className="ml-auto flex items-center gap-2 px-2 text-xs"><span className={cn("h-2 w-2 rounded-full", saveState === "saved" ? "bg-emerald-500" : saveState === "error" || saveState === "conflict" ? "bg-red-500" : "bg-amber-500")} />{saveMessage}</div>
          <Button type="button" size="sm" variant="outline" onClick={() => void saveNow()} disabled={saveState === "saving"}>{saveState === "saving" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}Salvar agora</Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-b print:hidden">
        <div className="flex"><button type="button" onClick={() => setTab("edit")} className={cn("border-b-2 px-4 py-3 text-sm font-semibold", tab === "edit" ? "border-primary text-primary" : "border-transparent text-muted-foreground")}>Editor</button><button type="button" onClick={() => setTab("preview")} className={cn("border-b-2 px-4 py-3 text-sm font-semibold", tab === "preview" ? "border-primary text-primary" : "border-transparent text-muted-foreground")}>Preview limpo</button></div>
        <div className="flex gap-2"><Button size="sm" variant="outline" asChild><Link href={`/planos/${planId}/impressao/documento`} target="_blank"><Printer className="mr-2 h-4 w-4" />Imprimir</Link></Button><Button size="sm" asChild><a href={`/api/plans/${planId}/pdf?download=1`}><FileDown className="mr-2 h-4 w-4" />Exportar PDF</a></Button></div>
      </div>

      {tab === "preview" ? <div className="overflow-auto bg-muted p-4"><DocumentRenderer document={documentValue} assets={assets} /></div> : (
        <div className="grid gap-5 xl:grid-cols-[270px_minmax(0,1fr)]">
          <aside className="space-y-4 print:hidden">
            <div className="rounded-lg border bg-card p-4"><h3 className="font-semibold">+ Adicionar conteúdo</h3><div className="mt-3 grid grid-cols-2 gap-2">{[["heading", "Título", Heading1], ["paragraph", "Parágrafo", Plus], ["question", "Questão", Plus], ["instruction", "Instrução", Plus], ["list", "Lista", List], ["numberedList", "Numeração", ListOrdered], ["table", "Tabela", Table2], ["textBox", "Caixa de texto", Plus], ["responseSpace", "Espaço resposta", Plus], ["separator", "Separador", Minus], ["pageBreak", "Quebra página", Plus]].map(([type, label, Icon]) => <Button key={String(type)} type="button" size="sm" variant="outline" className="justify-start" onClick={() => addContent(String(type))}><Icon className="mr-1 h-3.5 w-3.5" />{String(label)}</Button>)}</div><Button type="button" className="mt-2 w-full" onClick={() => addContent("question")}><Plus className="mr-2 h-4 w-4" />Adicionar questão</Button></div>
            <div className="rounded-lg border bg-card p-4"><h3 className="font-semibold">Imagens</h3><p className="mt-1 text-xs text-muted-foreground">Inserir e organizar não consome IA.</p><select className="mt-3 h-10 w-full rounded-md border px-2 text-sm" value="" onChange={(event) => { if (event.target.value) addAsset(event.target.value) }}><option value="">Inserir imagem existente…</option>{assets.filter((asset) => asset.status === "READY").map((asset) => <option key={asset.id} value={asset.id}>{asset.altText || asset.prompt.slice(0, 45)}</option>)}</select><div className="mt-2"><AddImageDialog planId={planId} onAdded={(id) => void afterGeneratedImage(id)} /></div><Button type="button" size="sm" variant="outline" className="mt-2 w-full" onClick={() => newImageFileRef.current?.click()} disabled={uploadingNewImage}>{uploadingNewImage ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}Adicionar arquivo sem IA</Button><input ref={newImageFileRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(event) => { const file = event.target.files?.[0]; if (file) void uploadNewImage(file) }} /></div>
            <details className="rounded-lg border bg-card p-4" open><summary className="cursor-pointer font-semibold">Configurar página</summary><div className="mt-3 space-y-3"><div><Label>Tamanho</Label><select value={documentValue.page.size} onChange={(event) => mutate((draft) => { draft.page.size = event.target.value as "A4" | "LETTER" })} className="mt-1 h-10 w-full rounded-md border px-2"><option value="A4">A4</option><option value="LETTER">Carta</option></select></div><div><Label>Orientação</Label><select value={documentValue.page.orientation} onChange={(event) => mutate((draft) => { draft.page.orientation = event.target.value as "portrait" | "landscape" })} className="mt-1 h-10 w-full rounded-md border px-2"><option value="portrait">Retrato</option><option value="landscape">Paisagem</option></select></div><div><Label>Layout das questões</Label><select value={documentValue.page.columns === "two" ? "two" : "one"} onChange={(event) => mutate((draft) => { draft.page.columns = event.target.value === "two" ? "two" : "one" })} className="mt-1 h-10 w-full rounded-md border px-2"><option value="one">Uma coluna</option><option value="two">Duas colunas — Simulado</option></select></div>{documentValue.page.columns === "two" && <><div><Label>Espaçamento entre colunas (px)</Label><Input type="number" min={8} max={80} value={documentValue.page.columnGap ?? 24} onChange={(event) => mutate((draft) => { draft.page.columnGap = Number(event.target.value) })} /></div><div><Label>Separador entre colunas</Label><select className="mt-1 h-10 w-full rounded-md border px-2" value={documentValue.page.columnSeparator === "line" ? "line" : "none"} onChange={(event) => mutate((draft) => { draft.page.columnSeparator = event.target.value === "line" ? "line" : "none" })}><option value="none">Nenhum</option><option value="line">Linha discreta</option></select></div></>}<div><Label>Separar informações pedagógicas</Label><label className="mt-1 flex items-center gap-2 text-sm"><input type="checkbox" checked={documentValue.page.pedagogicalPageBreakBefore !== false} onChange={(event) => mutate((draft) => { draft.page.pedagogicalPageBreakBefore = event.target.checked })} />Iniciar em nova página</label></div><div className="grid grid-cols-2 gap-2">{(["marginTop", "marginRight", "marginBottom", "marginLeft"] as const).map((key) => <div key={key}><Label>{({ marginTop: "Margem sup.", marginRight: "Margem dir.", marginBottom: "Margem inf.", marginLeft: "Margem esq." })[key]}</Label><Input type="number" min={8} max={50} value={documentValue.page[key]} onChange={(event) => mutate((draft) => { draft.page[key] = Number(event.target.value) })} /></div>)}</div></div></details>
            <details className="rounded-lg border bg-card p-4" open><summary className="cursor-pointer font-semibold">Cabeçalho</summary><div className="mt-3 space-y-3">
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={documentValue.header.visible} onChange={(event) => mutate((draft) => { draft.header.visible = event.target.checked })} />Exibir cabeçalho</label>
              <div><Label>Espaçamento vertical</Label><select className="mt-1 h-10 w-full rounded-md border px-2" value={documentValue.header.layout || "normal"} onChange={(event) => mutate((draft) => { draft.header.layout = event.target.value as "compact" | "normal" | "spacious" })}><option value="compact">Compacto</option><option value="normal">Normal</option><option value="spacious">Espaçado</option></select></div>
              <p className="text-xs text-muted-foreground">Arraste o ícone ⠿ para reordenar. Campos com a mesma <strong>linha</strong> ficam lado a lado; a largura (%) divide a linha. Arraste o divisor na página para redimensionar.</p>
              <div className="space-y-2">
                {documentValue.header.fields.map((field, index) => (
                  <div key={field.id} className={cn("rounded border p-2", !field.visible && "opacity-60")}>
                    <div className="flex items-center gap-1">
                      <button type="button" className="cursor-grab text-muted-foreground hover:text-foreground" title="Arraste para reordenar" draggable onDragStart={(event) => { dragHeaderFieldRef.current = field.id; event.dataTransfer.effectAllowed = "move" }} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); dropHeaderField(field.id) }}><GripVertical className="h-4 w-4" /></button>
                      <button type="button" className={cn("text-muted-foreground hover:text-foreground", field.visible && "text-foreground")} title={field.visible ? "Ocultar campo" : "Exibir campo"} onClick={() => toggleHeaderField(field.id)}>{field.visible ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}</button>
                      {field.custom
                        ? <Input className="h-7 flex-1 text-xs font-semibold" value={field.label} aria-label="Rótulo do campo personalizado" onChange={(event) => updateHeaderField(field.id, { label: event.target.value })} />
                        : <span className="flex-1 truncate text-xs font-semibold" title={field.label}>{field.label}</span>}
                      <button type="button" className="text-muted-foreground hover:text-destructive" title={field.custom ? "Remover campo" : "Ocultar (campos padrão não são excluídos)"} onClick={() => removeHeaderField(field.id)}><Trash2 className="h-4 w-4" /></button>
                    </div>
                    <Input className="mt-1 h-8" value={field.value} placeholder={field.label} onChange={(event) => updateHeaderField(field.id, { value: event.target.value })} />
                    <div className="mt-2 grid grid-cols-3 items-end gap-2">
                      <div><Label className="text-[10px]">Linha</Label><Input type="number" min={1} max={30} className="h-8" value={field.row ?? index + 1} onChange={(event) => setHeaderFieldRow(field.id, Number(event.target.value))} /></div>
                      <div><Label className="text-[10px]">Largura %</Label><Input type="number" min={5} max={100} step={5} className="h-8" value={field.widthPercent ?? 100} onChange={(event) => updateHeaderField(field.id, { widthPercent: Number(event.target.value) })} /></div>
                      <div className="flex gap-1"><button type="button" className="flex h-8 flex-1 items-center justify-center rounded border text-muted-foreground hover:text-foreground" aria-label="Mover para cima" onClick={() => moveHeaderField(field.id, "up")}><ArrowUp className="h-3.5 w-3.5" /></button><button type="button" className="flex h-8 flex-1 items-center justify-center rounded border text-muted-foreground hover:text-foreground" aria-label="Mover para baixo" onClick={() => moveHeaderField(field.id, "down")}><ArrowDown className="h-3.5 w-3.5" /></button></div>
                    </div>
                    <details className="mt-2"><summary className="cursor-pointer text-xs text-primary">Ajustes do campo</summary><div className="mt-2 grid grid-cols-2 gap-2"><div><Label className="text-[10px]">Altura (px)</Label><Input type="number" min={8} max={80} value={field.minHeight ?? 15} onChange={(event) => updateHeaderField(field.id, { minHeight: Number(event.target.value) })} /></div><div><Label className="text-[10px]">Fonte (pt)</Label><Input type="number" min={6} max={24} step={0.5} value={field.fontSize ?? 9.5} onChange={(event) => updateHeaderField(field.id, { fontSize: Number(event.target.value) })} /></div><div><Label className="text-[10px]">Espaçamento (px)</Label><Input type="number" min={0} max={40} value={field.spacingAfter ?? 7} onChange={(event) => updateHeaderField(field.id, { spacingAfter: Number(event.target.value) })} /></div><div><Label className="text-[10px]">Alinhamento</Label><select className="h-9 w-full rounded-md border px-1 text-xs" value={field.alignment || "left"} onChange={(event) => updateHeaderField(field.id, { alignment: event.target.value as "left" | "center" | "right" })}><option value="left">Esquerda</option><option value="center">Centro</option><option value="right">Direita</option></select></div></div></details>
                  </div>
                ))}
              </div>
              <div className="rounded border border-dashed p-2">
                <p className="text-xs font-semibold">Adicionar campo personalizado</p>
                <Input className="mt-1 h-8" placeholder="Rótulo (ex.: Nota)" value={newHeaderField.label} onChange={(event) => setNewHeaderField((current) => ({ ...current, label: event.target.value }))} />
                <div className="mt-2 grid grid-cols-3 gap-2">
                  <Input className="h-8" placeholder="Valor" value={newHeaderField.value} onChange={(event) => setNewHeaderField((current) => ({ ...current, value: event.target.value }))} />
                  <Input type="number" className="h-8" min={5} max={100} step={5} value={newHeaderField.width} onChange={(event) => setNewHeaderField((current) => ({ ...current, width: Number(event.target.value) }))} />
                  <Input type="number" className="h-8" min={1} max={30} value={newHeaderField.row} onChange={(event) => setNewHeaderField((current) => ({ ...current, row: Number(event.target.value) }))} />
                </div>
                <Button type="button" size="sm" variant="outline" className="mt-2 w-full" onClick={() => { addHeaderField(newHeaderField.label, newHeaderField.value, newHeaderField.width, newHeaderField.row); setNewHeaderField({ label: "", value: "", width: 100, row: 1 }) }}><Plus className="mr-1 h-4 w-4" />Adicionar campo</Button>
              </div>
            </div></details>
            <details className="rounded-lg border bg-card p-4"><summary className="cursor-pointer font-semibold">Rodapé</summary><div className="mt-3 space-y-2 text-sm"><label className="flex gap-2"><input type="checkbox" checked={documentValue.footer.visible} onChange={(event) => mutate((draft) => { draft.footer.visible = event.target.checked })} />Exibir rodapé</label><label className="flex gap-2"><input type="checkbox" checked={documentValue.footer.showPageNumber} onChange={(event) => mutate((draft) => { draft.footer.showPageNumber = event.target.checked })} />Número da página</label><label className="flex gap-2"><input type="checkbox" checked={documentValue.footer.showSchoolName} onChange={(event) => mutate((draft) => { draft.footer.showSchoolName = event.target.checked })} />Nome da escola</label><label className="flex gap-2"><input type="checkbox" checked={documentValue.footer.showMaterialName} onChange={(event) => mutate((draft) => { draft.footer.showMaterialName = event.target.checked })} />Nome do material</label><Input placeholder="Campo personalizado" value={documentValue.footer.customText} onChange={(event) => mutate((draft) => { draft.footer.customText = event.target.value }, false)} /></div></details>
          </aside>

          <main className="min-w-0 rounded-lg bg-muted/60 p-3 sm:p-5">
            <div className="mb-3 flex flex-wrap items-center gap-1 print:hidden">
              <Button type="button" size="sm" variant="outline" onClick={() => setZoom((value) => Math.max(0.4, +(value - 0.1).toFixed(2)))} aria-label="Diminuir zoom"><ZoomOut className="h-4 w-4" /></Button>
              <Button type="button" size="sm" variant="outline" className="w-16" onClick={() => setZoom(1)}>{Math.round(zoom * 100)}%</Button>
              <Button type="button" size="sm" variant="outline" onClick={() => setZoom((value) => Math.min(2, +(value + 0.1).toFixed(2)))} aria-label="Aumentar zoom"><ZoomIn className="h-4 w-4" /></Button>
              <span className="mx-1 h-6 border-l" />
              <Button type="button" size="sm" variant="ghost" onClick={fitWidth}><MoveHorizontal className="mr-1.5 h-4 w-4" />Ajustar à largura</Button>
              <Button type="button" size="sm" variant="ghost" onClick={fitPage}><Maximize className="mr-1.5 h-4 w-4" />Página inteira</Button>
            </div>
            <div ref={canvasScrollRef} className="overflow-auto">
              <div style={{ width: pageWidthPx * zoom }}>
                <div style={{ transform: `scale(${zoom})`, transformOrigin: "top left", width: pageWidthPx, ...(pages ? { height: scaledPageHeight } : {}) }}>
                  {pages ? pages.map((page, pageIndex) => renderPage(page, pageIndex)) : fallbackPage}
                </div>
              </div>
              <Button type="button" variant="outline" className="my-3 w-full border-dashed print:hidden" onClick={() => mutate((draft) => { const section = { id: uid("section"), title: "Nova seção", elements: [] }; draft.sections.push(section); setSelected({ sectionId: section.id }) })}><Plus className="mr-2 h-4 w-4" />Adicionar seção</Button>
            </div>
            <div ref={measureRef} aria-hidden="true" className="pointer-events-none" style={{ position: "absolute", left: -100000, top: 0, width: contentWidth, visibility: "hidden", ...pageFontStyle }}>
              {blocks.map((block) => <div key={block.key} data-block data-block-key={block.key} data-break-before={block.breakBefore}>{block.node}</div>)}
            </div>
          </main>
        </div>
      )}

      {(saveState === "error" || saveState === "conflict") && <div className="fixed bottom-4 right-4 z-50 max-w-md rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-900 shadow-lg print:hidden dark:border-red-900 dark:bg-red-950/80 dark:text-red-200"><strong>Alterações não salvas.</strong><p className="mt-1">{saveMessage}</p>{saveState === "conflict" && <Button size="sm" variant="outline" className="mt-2" onClick={() => window.location.reload()}>Recarregar documento</Button>}</div>}
      {saveState === "saved" && <span className="sr-only"><Check />Documento salvo.</span>}
    </div>
  )
}
