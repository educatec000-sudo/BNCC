"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { ArrowLeft, Check, Loader2, Printer } from "lucide-react"
import { Button } from "@/components/ui/button"

export function PrintDocumentActions({ planId }: { planId: string }) {
  const [ready, setReady] = useState(false)
  useEffect(() => {
    const images = Array.from(document.images)
    Promise.all(images.map((image) => image.complete ? Promise.resolve() : new Promise<void>((resolve) => {
      image.addEventListener("load", () => resolve(), { once: true })
      image.addEventListener("error", () => resolve(), { once: true })
    }))).then(() => setReady(true))
  }, [])

  return (
    <div className="print-hidden sticky top-0 z-50 flex flex-wrap items-center justify-center gap-3 border-b bg-white/95 p-3 shadow-sm backdrop-blur" data-print-hidden="true">
      <Button variant="outline" asChild><Link href={`/planos/${planId}/impressao`}><ArrowLeft className="mr-2 h-4 w-4" />Voltar</Link></Button>
      <span className="flex items-center gap-2 text-sm text-muted-foreground">
        {ready ? <Check className="h-4 w-4 text-emerald-600" /> : <Loader2 className="h-4 w-4 animate-spin" />}
        {ready ? "Imagens carregadas" : "Carregando imagens…"}
      </span>
      <Button onClick={() => window.print()} disabled={!ready}><Printer className="mr-2 h-4 w-4" />Imprimir documento</Button>
    </div>
  )
}
