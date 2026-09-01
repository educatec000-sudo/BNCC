"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  Check,
  Clipboard,
  CopyPlus,
  Download,
  Edit3,
  FileText,
  Loader2,
  MoreHorizontal,
  Sparkles,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { InclusionAdaptDialog } from "@/components/InclusionAdaptDialog"
import { exportWordDocument } from "@/lib/word-export"
import { planningContentToText } from "@/lib/planning-text"

interface PlanActionsProps {
  planId: string
  title: string
  content: unknown
}

type LoadingAction = "duplicate" | "regenerate" | "improve" | null

export function PlanActions({ planId, title, content }: PlanActionsProps) {
  const router = useRouter()
  const [loading, setLoading] = useState<LoadingAction>(null)
  const [message, setMessage] = useState("")
  const [error, setError] = useState("")

  const busy = loading !== null

  const copyContent = async () => {
    try {
      await navigator.clipboard.writeText(planningContentToText(content))
      setMessage("Planejamento copiado.")
      setError("")
    } catch {
      setError("Não foi possível copiar o conteúdo.")
    }
  }

  const duplicate = async () => {
    setLoading("duplicate")
    setError("")
    const response = await fetch(`/api/plans/${planId}/duplicate`, { method: "POST" })
    const data: { plan?: { id?: string }; error?: string } = await response.json().catch(() => ({}))
    setLoading(null)

    if (!response.ok || !data.plan?.id) {
      setError(data.error || "Não foi possível duplicar.")
      return
    }
    router.push(`/dashboard?edit=${data.plan.id}`)
  }

  const generateAgain = async (mode: "regenerate" | "improve") => {
    setLoading(mode)
    setError("")
    setMessage("")

    const response = await fetch(`/api/plans/${planId}/regenerate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode }),
    })
    const data: { error?: string; message?: string; plan?: { id?: string } } = await response
      .json()
      .catch(() => ({}))
    setLoading(null)

    if (!response.ok) {
      setError(data.message || data.error || "Não foi possível gerar outra versão.")
      return
    }

    setMessage(data.message || "Conteúdo atualizado.")
    router.refresh()
  }

  return (
    <div className="print:hidden">
      <div className="flex flex-wrap items-center justify-end gap-2">
        <span id="adaptar" className="scroll-mt-24">
          <InclusionAdaptDialog
            planId={planId}
            disabled={busy}
            onAdapted={() => {
              setMessage("Versão inclusiva criada. Abra a aba Adaptada para visualizar.")
              router.refresh()
            }}
          />
        </span>

        <Button variant="outline" size="sm" asChild>
          <Link href={`/planos/${planId}/editar-conteudo`}>
            <Edit3 className="mr-2 h-4 w-4" /> Editar conteúdo
          </Link>
        </Button>

        <Button
          size="sm"
          onClick={() => generateAgain("regenerate")}
          disabled={busy}
        >
          {loading === "regenerate" ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Sparkles className="mr-2 h-4 w-4" />
          )}
          Gerar nova versão
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" aria-label="Mais ações">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-60">
            <DropdownMenuLabel>Ações do planejamento</DropdownMenuLabel>
            <DropdownMenuItem
              disabled={busy}
              onSelect={() => generateAgain("improve")}
            >
              {loading === "improve" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4" />
              )}
              Melhorar com IA
            </DropdownMenuItem>
            <DropdownMenuItem disabled={busy} onSelect={duplicate}>
              {loading === "duplicate" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <CopyPlus className="h-4 w-4" />
              )}
              Duplicar
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={copyContent}>
              <Clipboard className="h-4 w-4" />
              Copiar conteúdo
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href={`/dashboard?edit=${planId}`}>
                <Edit3 className="h-4 w-4" />
                Editar pedido
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href={`/planos/${planId}/impressao`}>
                <FileText className="h-4 w-4" />
                Visualizar impressão
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <a href={`/api/plans/${planId}/pdf?download=1`}>
                <Download className="h-4 w-4" />
                Baixar PDF
              </a>
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => void exportWordDocument(content, title)}>
              <Download className="h-4 w-4" />
              Exportar Word (.docx)
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="mt-2 flex flex-wrap items-center justify-end gap-2 text-sm">
        <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Check className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" /> Salvo automaticamente
        </span>
      </div>

      <div aria-live="polite">
        {message && <p className="mt-1 text-right text-sm text-emerald-600 dark:text-emerald-400">{message}</p>}
        {error && (
          <p role="alert" className="mt-1 text-right text-sm text-destructive">
            {error}
          </p>
        )}
      </div>
    </div>
  )
}
