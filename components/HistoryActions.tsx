"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Accessibility, CopyPlus, Edit3, Eye, Loader2, RefreshCw, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"

export function HistoryActions({ planId }: { planId: string }) {
  const router = useRouter()
  const [loading, setLoading] = useState<"duplicate" | "regenerate" | "delete" | null>(null)

  const duplicate = async () => {
    setLoading("duplicate")
    const response = await fetch(`/api/plans/${planId}/duplicate`, { method: "POST" })
    const data: { plan?: { id?: string } } = await response.json().catch(() => ({}))
    setLoading(null)
    if (response.ok && data.plan?.id) router.push(`/dashboard?edit=${data.plan.id}`)
  }

  const regenerate = async () => {
    setLoading("regenerate")
    const response = await fetch(`/api/plans/${planId}/regenerate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode: "regenerate" }),
    })
    setLoading(null)
    if (response.ok) router.push(`/planos/${planId}`)
  }

  const remove = async () => {
    if (!window.confirm("Excluir este planejamento? Esta ação não pode ser desfeita.")) return
    setLoading("delete")
    const response = await fetch(`/api/plans/${planId}`, { method: "DELETE" })
    setLoading(null)
    if (response.ok) router.refresh()
  }

  return (
    <div className="flex flex-wrap items-center justify-end gap-1.5">
      <Button size="sm" variant="ghost" asChild>
        <Link href={`/planos/${planId}`} title="Visualizar">
          <Eye className="h-4 w-4" /> <span className="sr-only">Visualizar</span>
        </Link>
      </Button>
      <Button size="sm" variant="ghost" asChild>
        <Link href={`/dashboard?edit=${planId}`} title="Editar">
          <Edit3 className="h-4 w-4" /> <span className="sr-only">Editar</span>
        </Link>
      </Button>
      <Button size="sm" variant="ghost" onClick={duplicate} disabled={loading !== null} title="Duplicar">
        {loading === "duplicate" ? <Loader2 className="h-4 w-4 animate-spin" /> : <CopyPlus className="h-4 w-4" />}
        <span className="sr-only">Duplicar</span>
      </Button>
      <Button size="sm" variant="ghost" asChild>
        <Link href={`/planos/${planId}#adaptar`} title="Adaptar para inclusão">
          <Accessibility className="h-4 w-4" /> <span className="sr-only">Adaptar</span>
        </Link>
      </Button>
      <Button
        size="sm"
        variant="ghost"
        onClick={regenerate}
        disabled={loading !== null}
        title="Regenerar"
      >
        {loading === "regenerate" ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <RefreshCw className="h-4 w-4" />
        )}
        <span className="sr-only">Regenerar</span>
      </Button>
      <Button
        size="sm"
        variant="ghost"
        onClick={remove}
        disabled={loading !== null}
        title="Excluir"
        className="text-destructive hover:text-destructive"
      >
        {loading === "delete" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
        <span className="sr-only">Excluir</span>
      </Button>
    </div>
  )
}
