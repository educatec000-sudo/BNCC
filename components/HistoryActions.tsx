"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  Accessibility,
  CopyPlus,
  Edit3,
  Eye,
  Loader2,
  MoreHorizontal,
  RefreshCw,
  Trash2,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

export function HistoryActions({ planId }: { planId: string }) {
  const router = useRouter()
  const [loading, setLoading] = useState<"duplicate" | "regenerate" | "delete" | null>(null)

  const busy = loading !== null

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
    <div className="flex items-center justify-end gap-1.5">
      <Button size="sm" variant="outline" asChild>
        <Link href={`/planos/${planId}`}>
          <Eye className="mr-1.5 h-4 w-4" /> Abrir
        </Link>
      </Button>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size="sm" variant="ghost" aria-label="Mais ações">
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          <DropdownMenuItem asChild>
            <Link href={`/dashboard?edit=${planId}`}>
              <Edit3 className="h-4 w-4" /> Editar
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem disabled={busy} onSelect={duplicate}>
            {loading === "duplicate" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <CopyPlus className="h-4 w-4" />
            )}
            Duplicar
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link href={`/planos/${planId}#adaptar`}>
              <Accessibility className="h-4 w-4" /> Adaptar para inclusão
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem disabled={busy} onSelect={regenerate}>
            {loading === "regenerate" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            Regenerar
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            disabled={busy}
            onSelect={remove}
            className="text-destructive focus:bg-destructive/10 focus:text-destructive"
          >
            {loading === "delete" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Trash2 className="h-4 w-4" />
            )}
            Excluir
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
