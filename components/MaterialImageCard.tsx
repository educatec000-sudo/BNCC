"use client"

import { useRef, useState } from "react"
import Image from "next/image"
import {
  ArrowDown,
  ArrowUp,
  ImagePlus,
  Loader2,
  RefreshCw,
  Save,
  Trash2,
  Upload,
} from "lucide-react"
import { IMAGE_STYLES, isImageStyle, type ImageStyleId } from "@/lib/image-options"
import type { MaterialImageView } from "@/lib/images/types"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"

export function MaterialImageCard({
  image,
  onChanged,
}: {
  image: MaterialImageView
  onChanged: () => void
}) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [prompt, setPrompt] = useState(image.prompt)
  const [altText, setAltText] = useState(image.altText || "")
  const [style, setStyle] = useState<ImageStyleId>(
    isImageStyle(image.style) ? image.style : "EDUCATIONAL",
  )
  const [loading, setLoading] = useState("")
  const [error, setError] = useState("")

  const patch = async (data: Record<string, unknown>) => {
    const response = await fetch(`/api/images/${image.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    })
    if (!response.ok) throw new Error("Não foi possível salvar a imagem.")
    onChanged()
  }

  const regenerate = async () => {
    setLoading("regenerate")
    setError("")
    const response = await fetch(`/api/images/${image.id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        prompt,
        style,
        coloringPage: style === "COLORING_PAGE",
        accessible: style === "ACCESSIBLE_INCLUSIVE",
      }),
    })
    const data: { error?: string } = await response.json().catch(() => ({}))
    setLoading("")
    if (!response.ok) {
      setError(data.error || "Não foi possível gerar esta imagem. Você pode tentar novamente.")
      return
    }
    onChanged()
  }

  const upload = async (file: File) => {
    setLoading("upload")
    setError("")
    const formData = new FormData()
    formData.set("file", file)
    const response = await fetch(`/api/images/${image.id}/upload`, {
      method: "POST",
      body: formData,
    })
    const data: { error?: string } = await response.json().catch(() => ({}))
    setLoading("")
    if (!response.ok) {
      setError(data.error || "Não foi possível substituir a imagem.")
      return
    }
    onChanged()
  }

  const remove = async () => {
    if (!window.confirm("Excluir esta imagem do material?")) return
    setLoading("delete")
    await fetch(`/api/images/${image.id}`, { method: "DELETE" })
    setLoading("")
    onChanged()
  }

  const saveMetadata = async () => {
    setLoading("save")
    setError("")
    try {
      await patch({ prompt, altText, style })
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Não foi possível salvar.")
    } finally {
      setLoading("")
    }
  }

  return (
    <figure
      className="my-5 break-inside-avoid border bg-card p-3"
      style={{ width: `${image.widthPercent}%`, maxWidth: "100%" }}
      data-placement={image.placementKey}
    >
      {image.status === "READY" ? (
        <Image
          src={`${image.url}?v=${image.version}`}
          alt={image.altText || "Imagem educacional gerada por IA"}
          width={1200}
          height={900}
          unoptimized
          className="h-auto w-full object-contain"
        />
      ) : (
        <div className="flex min-h-48 items-center justify-center bg-muted text-center text-sm text-muted-foreground">
          {image.error || "Não foi possível gerar esta imagem. Você pode tentar novamente."}
        </div>
      )}

      <details className="mt-4 border-t pt-3 print:hidden">
        <summary className="cursor-pointer text-sm font-medium text-primary">
          Configurações avançadas da imagem
        </summary>
        <div className="mt-3 space-y-3">
        <div className="grid gap-3 md:grid-cols-[1fr_190px]">
          <div className="space-y-1.5">
            <Label htmlFor={`prompt-${image.id}`}>Prompt da imagem</Label>
            <Textarea
              id={`prompt-${image.id}`}
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              maxLength={1_000}
              className="min-h-20"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`style-${image.id}`}>Estilo</Label>
            <select
              id={`style-${image.id}`}
              value={style}
              onChange={(event) => setStyle(event.target.value as ImageStyleId)}
              className="h-11 w-full border bg-background px-3 text-sm"
            >
              {IMAGE_STYLES.map((option) => (
                <option key={option.id} value={option.id}>{option.label}</option>
              ))}
            </select>
            <Label htmlFor={`alt-${image.id}`}>Descrição alternativa</Label>
            <Textarea
              id={`alt-${image.id}`}
              value={altText}
              onChange={(event) => setAltText(event.target.value)}
              maxLength={500}
              className="min-h-16"
            />
          </div>
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={saveMetadata} disabled={Boolean(loading)}>
            {loading === "save" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Salvar ajustes
          </Button>
          <Button size="sm" onClick={regenerate} disabled={Boolean(loading)}>
            {loading === "regenerate" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
            {image.status === "FAILED" ? "Tentar novamente com IA" : "🖼️ Gerar nova versão com IA"}
          </Button>
          <Button size="sm" variant="outline" onClick={() => fileRef.current?.click()} disabled={Boolean(loading)}>
            {loading === "upload" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
            Substituir imagem
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0]
              if (file) void upload(file)
            }}
          />
          {[50, 75, 100].map((width) => (
            <Button
              key={width}
              size="sm"
              variant={image.widthPercent === width ? "secondary" : "ghost"}
              onClick={() => patch({ widthPercent: width })}
            >
              {width}%
            </Button>
          ))}
          <Button size="sm" variant="ghost" onClick={() => patch({ position: Math.max(0, image.position - 1) })} aria-label="Mover imagem para cima">
            <ArrowUp className="h-4 w-4" />
          </Button>
          <Button size="sm" variant="ghost" onClick={() => patch({ position: image.position + 1 })} aria-label="Mover imagem para baixo">
            <ArrowDown className="h-4 w-4" />
          </Button>
          <Button size="sm" variant="ghost" onClick={remove} disabled={Boolean(loading)} className="text-destructive hover:text-destructive">
            {loading === "delete" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
            Excluir
          </Button>
        </div>
        <p className="flex items-center gap-2 text-xs text-muted-foreground">
          <ImagePlus className="h-3.5 w-3.5" /> Posição: {image.placementKey} · versão {image.version}
        </p>
        </div>
      </details>
    </figure>
  )
}
