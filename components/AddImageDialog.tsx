"use client"

import { useState } from "react"
import { ImagePlus, Loader2 } from "lucide-react"
import { IMAGE_STYLES, type ImageStyleId } from "@/lib/image-options"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"

export function AddImageDialog({ planId, onAdded }: { planId: string; onAdded: (imageId?: string) => void }) {
  const [open, setOpen] = useState(false)
  const [prompt, setPrompt] = useState("")
  const [placementKey, setPlacementKey] = useState("cover")
  const [style, setStyle] = useState<ImageStyleId>("EDUCATIONAL")
  const [altText, setAltText] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  const generate = async () => {
    setLoading(true)
    setError("")
    const response = await fetch(`/api/plans/${planId}/images`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        prompt,
        placementKey,
        style,
        altText,
        coloringPage: style === "COLORING_PAGE",
        accessible: style === "ACCESSIBLE_INCLUSIVE",
      }),
    })
    const data: { error?: string; id?: string } = await response.json().catch(() => ({}))
    setLoading(false)
    if (!response.ok) {
      setError(data.error || "Não foi possível gerar a imagem.")
      return
    }
    setOpen(false)
    setPrompt("")
    onAdded(data.id)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <ImagePlus className="mr-2 h-4 w-4" /> 🖼️ Gerar nova imagem com IA
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Inserir recurso visual</DialogTitle>
          <DialogDescription>
            A imagem será gerada pelo modelo configurado e vinculada somente a este material.
          </DialogDescription>
        </DialogHeader>
        <div className="mt-5 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="new-image-prompt">Descreva a imagem</Label>
            <Textarea
              id="new-image-prompt"
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              maxLength={1_000}
              placeholder="Ex.: diagrama educacional do Sistema Solar mostrando órbitas e planetas"
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="new-image-placement">Posição</Label>
              <Input
                id="new-image-placement"
                value={placementKey}
                onChange={(event) => setPlacementKey(event.target.value)}
                placeholder="cover, question:1, lesson:2..."
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-image-style">Estilo</Label>
              <select
                id="new-image-style"
                value={style}
                onChange={(event) => setStyle(event.target.value as ImageStyleId)}
                className="h-11 w-full border bg-background px-3 text-sm"
              >
                {IMAGE_STYLES.map((item) => (
                  <option key={item.id} value={item.id}>{item.label}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="new-image-alt">Descrição alternativa (opcional)</Label>
            <Textarea
              id="new-image-alt"
              value={altText}
              onChange={(event) => setAltText(event.target.value)}
              maxLength={500}
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="flex justify-end gap-2">
            <DialogClose asChild><Button variant="outline">Cancelar</Button></DialogClose>
            <Button onClick={generate} disabled={loading || prompt.trim().length < 5}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              🖼️ Gerar imagem com IA
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
