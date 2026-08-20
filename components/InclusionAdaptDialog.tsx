"use client"

import { useState } from "react"
import { Accessibility, Check, Loader2, Sparkles } from "lucide-react"
import {
  ACCESSIBILITY_RESOURCE_GROUPS,
  INCLUSION_NEEDS,
} from "@/lib/inclusion-options"
import { cn } from "@/lib/utils"
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
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"

interface InclusionAdaptDialogProps {
  planId: string
  disabled?: boolean
  onAdapted: () => void
}

export function InclusionAdaptDialog({ planId, disabled, onAdapted }: InclusionAdaptDialogProps) {
  const [open, setOpen] = useState(false)
  const [needs, setNeeds] = useState<string[]>([])
  const [resources, setResources] = useState<string[]>([])
  const [observations, setObservations] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  const toggle = (id: string, values: string[], setter: (next: string[]) => void) => {
    setter(values.includes(id) ? values.filter((item) => item !== id) : [...values, id])
  }

  const adapt = async () => {
    if (needs.length === 0) {
      setError("Selecione ao menos uma necessidade educacional.")
      return
    }

    setLoading(true)
    setError("")
    const response = await fetch(`/api/plans/${planId}/adapt`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        needs,
        resources,
        pedagogicalProfile: { observations },
      }),
    })
    const data: { error?: string; message?: string } = await response.json().catch(() => ({}))
    setLoading(false)

    if (!response.ok) {
      setError(data.message || data.error || "Não foi possível criar a adaptação.")
      return
    }

    setOpen(false)
    onAdapted()
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" disabled={disabled}>
          <Accessibility className="mr-2 h-4 w-4" /> Adaptar para Inclusão
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Adaptar este planejamento para inclusão</DialogTitle>
          <DialogDescription>
            A proposta original será preservada. A IA criará uma versão acessível com DUA,
            participação e avaliação adaptada. Não informe dados pessoais ou diagnósticos.
          </DialogDescription>
        </DialogHeader>

        <div className="mt-6 space-y-6">
          <section>
            <h3 className="mb-3 text-sm font-semibold">Adaptar para:</h3>
            <div className="grid gap-2 sm:grid-cols-2">
              {INCLUSION_NEEDS.map((need) => {
                const selected = needs.includes(need.id)
                return (
                  <button
                    key={need.id}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => toggle(need.id, needs, setNeeds)}
                    className={cn(
                      "flex min-h-11 items-center gap-3 border px-3 py-2 text-left text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                      selected ? "border-primary bg-primary/5" : "hover:bg-muted/50",
                    )}
                  >
                    <span
                      className={cn(
                        "flex h-5 w-5 shrink-0 items-center justify-center border",
                        selected && "border-primary bg-primary text-primary-foreground",
                      )}
                    >
                      {selected && <Check className="h-3.5 w-3.5" />}
                    </span>
                    {need.label}
                  </button>
                )
              })}
            </div>
          </section>

          <section>
            <h3 className="mb-3 text-sm font-semibold">Recursos desejados (opcional)</h3>
            <div className="space-y-3">
              {ACCESSIBILITY_RESOURCE_GROUPS.map((group) => (
                <div key={group.id}>
                  <p className="mb-2 text-xs font-medium text-muted-foreground">{group.label}</p>
                  <div className="flex flex-wrap gap-2">
                    {group.resources.map(([id, label]) => {
                      const selected = resources.includes(id)
                      return (
                        <button
                          key={id}
                          type="button"
                          aria-pressed={selected}
                          onClick={() => toggle(id, resources, setResources)}
                          className={cn(
                            "min-h-9 border px-3 py-1.5 text-xs font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                            selected
                              ? "border-primary bg-primary text-primary-foreground"
                              : "hover:border-primary/50",
                          )}
                        >
                          {label}
                        </button>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          </section>

          <div className="space-y-2">
            <Label htmlFor="adapt-observations">Observações pedagógicas (opcional)</Label>
            <Textarea
              id="adapt-observations"
              value={observations}
              onChange={(event) => setObservations(event.target.value)}
              maxLength={500}
              placeholder="Ex: valoriza atividades práticas e responde melhor a instruções visuais."
            />
          </div>

          {error && (
            <div className="border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </div>
          )}

          <div className="flex flex-col-reverse justify-end gap-2 sm:flex-row">
            <DialogClose asChild>
              <Button variant="outline" disabled={loading}>Cancelar</Button>
            </DialogClose>
            <Button onClick={adapt} disabled={loading || needs.length === 0}>
              {loading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="mr-2 h-4 w-4" />
              )}
              {loading ? "Criando versão acessível..." : "Gerar adaptação"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
