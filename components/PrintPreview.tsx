"use client"

import { useMemo, useState } from "react"
import { Download, Eye, Printer, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

interface PrintPreviewProps {
  planId: string
  initialTeacher: string
  hasAdaptedVersion: boolean
  recommendedOrientation: "portrait" | "landscape"
}

export function PrintPreview({
  planId,
  initialTeacher,
  hasAdaptedVersion,
  recommendedOrientation,
}: PrintPreviewProps) {
  const [school, setSchool] = useState("")
  const [teacher, setTeacher] = useState(initialTeacher)
  const [orientation, setOrientation] = useState(recommendedOrientation)
  const [version, setVersion] = useState<"original" | "adapted">("original")
  const [refreshKey, setRefreshKey] = useState(0)

  const pdfUrl = useMemo(() => {
    const params = new URLSearchParams({ orientation, version })
    if (school.trim()) params.set("school", school.trim())
    if (teacher.trim()) params.set("teacher", teacher.trim())
    params.set("preview", String(refreshKey))
    return `/api/plans/${planId}/pdf?${params.toString()}`
  }, [orientation, planId, refreshKey, school, teacher, version])

  const downloadUrl = `${pdfUrl}&download=1`

  return (
    <div className="grid gap-6 xl:grid-cols-[320px_1fr]">
      <aside className="h-fit space-y-5 border bg-card p-5 print:hidden">
        <div>
          <h2 className="font-semibold">Configurar documento</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Cabeçalho, versão e orientação são aplicados ao PDF sem alterar o conteúdo salvo.
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="print-school">Nome da escola (opcional)</Label>
          <Input
            id="print-school"
            value={school}
            onChange={(event) => setSchool(event.target.value)}
            maxLength={120}
            placeholder="Ex.: Escola Municipal + Educação"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="print-teacher">Professor(a) (opcional)</Label>
          <Input
            id="print-teacher"
            value={teacher}
            onChange={(event) => setTeacher(event.target.value)}
            maxLength={120}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="print-orientation">Orientação</Label>
          <select
            id="print-orientation"
            value={orientation}
            onChange={(event) => setOrientation(event.target.value as "portrait" | "landscape")}
            className="h-11 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <option value="portrait">Retrato</option>
            <option value="landscape">Paisagem</option>
          </select>
        </div>
        <fieldset className="space-y-2">
          <legend className="text-sm font-medium">Versão</legend>
          <label className="flex min-h-11 cursor-pointer items-center gap-3 border px-3 text-sm">
            <input
              type="radio"
              name="version"
              value="original"
              checked={version === "original"}
              onChange={() => setVersion("original")}
            />
            Original
          </label>
          <label className="flex min-h-11 cursor-pointer items-center gap-3 border px-3 text-sm has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-50">
            <input
              type="radio"
              name="version"
              value="adapted"
              disabled={!hasAdaptedVersion}
              checked={version === "adapted"}
              onChange={() => setVersion("adapted")}
            />
            Adaptada
          </label>
        </fieldset>

        <div className="grid gap-2">
          <Button variant="outline" onClick={() => setRefreshKey((key) => key + 1)}>
            <RefreshCw className="mr-2 h-4 w-4" /> Atualizar visualização
          </Button>
          <Button variant="outline" onClick={() => window.open(`/planos/${planId}/impressao/documento?version=${version}`, "_blank", "noopener,noreferrer")}>
            <Printer className="mr-2 h-4 w-4" /> Imprimir versão limpa
          </Button>
          <Button asChild>
            <a href={downloadUrl}>
              <Download className="mr-2 h-4 w-4" /> Baixar PDF
            </a>
          </Button>
        </div>
      </aside>

      <section aria-labelledby="preview-title" className="min-w-0">
        <div className="mb-3 flex items-center gap-2">
          <Eye className="h-5 w-5 text-primary" />
          <h2 id="preview-title" className="font-semibold">Visualização A4</h2>
        </div>
        <div className="overflow-hidden border bg-muted p-2 sm:p-4">
          <iframe
            key={pdfUrl}
            src={pdfUrl}
            title="Visualização do documento em PDF"
            className="h-[75vh] min-h-[620px] w-full bg-white shadow-lg"
          />
        </div>
      </section>
    </div>
  )
}
