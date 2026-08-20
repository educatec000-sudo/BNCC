"use client"

import { Button } from "@/components/ui/button"
import { Download } from "lucide-react"
import { Document, Packer, Paragraph, TextRun, AlignmentType } from "docx"
import { saveAs } from "file-saver"
import { planningContentToText } from "@/lib/planning-text"

interface ExportButtonsProps {
  content: unknown
  title: string
}

export function ExportButtons({ content, title }: ExportButtonsProps) {
  const handleWordExport = async () => {
    const paragraphs: Paragraph[] = [
      new Paragraph({
        children: [new TextRun({ text: title, bold: true, size: 32 })],
        alignment: AlignmentType.CENTER,
        spacing: { after: 400 },
      }),
    ]

    for (const line of planningContentToText(content).split("\n")) {
      const trimmed = line.trim()
      if (!trimmed) continue
      const heading = trimmed.endsWith(":") && !trimmed.startsWith("•")
      paragraphs.push(
        new Paragraph({
          children: [new TextRun({ text: line, bold: heading, size: heading ? 25 : 22 })],
          spacing: { before: heading ? 180 : 0, after: 90 },
        }),
      )
    }

    const doc = new Document({ sections: [{ children: paragraphs }] })
    const blob = await Packer.toBlob(doc)
    saveAs(blob, `${title.replace(/[^a-zA-Z0-9]/g, "_")}.docx`)
  }

  return (
    <Button size="sm" variant="outline" onClick={handleWordExport} className="gap-2 print:hidden">
      <Download className="h-4 w-4" /> Exportar Word
    </Button>
  )
}
