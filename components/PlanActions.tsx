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
  RefreshCw,
  Sparkles,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { ExportButtons } from "@/components/ExportButtons"
import { InclusionAdaptDialog } from "@/components/InclusionAdaptDialog"
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
    <div className="print:hidden space-y-2">
      <div className="flex flex-wrap items-center justify-end gap-2">
        <span id="adaptar" className="scroll-mt-24">
          <InclusionAdaptDialog
            planId={planId}
            disabled={loading !== null}
            onAdapted={() => {
              setMessage("Versão inclusiva criada. Abra a aba Adaptada para visualizar.")
              router.refresh()
            }}
          />
        </span>
        <Button variant="outline" size="sm" asChild>
          <Link href={`/dashboard?edit=${planId}`}>
            <Edit3 className="mr-2 h-4 w-4" /> Editar pedido
          </Link>
        </Button>
        <Button variant="outline" size="sm" asChild>
          <Link href={`/planos/${planId}/editar-conteudo`}>
            <Edit3 className="mr-2 h-4 w-4" /> Editar conteúdo
          </Link>
        </Button>
        <Button variant="outline" size="sm" onClick={duplicate} disabled={loading !== null}>
          {loading === "duplicate" ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <CopyPlus className="mr-2 h-4 w-4" />
          )}
          Duplicar
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => generateAgain("regenerate")}
          disabled={loading !== null}
        >
          {loading === "regenerate" ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="mr-2 h-4 w-4" />
          )}
          ✨ Gerar nova versão com IA
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => generateAgain("improve")}
          disabled={loading !== null}
        >
          {loading === "improve" ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Sparkles className="mr-2 h-4 w-4" />
          )}
          ✨ Melhorar com IA
        </Button>
        <Button variant="outline" size="sm" onClick={copyContent}>
          <Clipboard className="mr-2 h-4 w-4" /> Copiar
        </Button>
        <Button variant="outline" size="sm" disabled>
          <Check className="mr-2 h-4 w-4" /> Salvo
        </Button>
        <Button variant="outline" size="sm" asChild>
          <Link href={`/planos/${planId}/impressao`}>
            <FileText className="mr-2 h-4 w-4" /> Visualizar impressão
          </Link>
        </Button>
        <Button variant="outline" size="sm" asChild>
          <a href={`/api/plans/${planId}/pdf?download=1`}>
            <Download className="mr-2 h-4 w-4" /> Baixar PDF
          </a>
        </Button>
        <ExportButtons content={content} title={title} />
      </div>
      {message && <p className="text-right text-sm text-green-700">{message}</p>}
      {error && <p className="text-right text-sm text-destructive">{error}</p>}
    </div>
  )
}
