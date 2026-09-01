import { AlignmentType, Document, Packer, Paragraph, TextRun } from "docx"
import { saveAs } from "file-saver"
import { planningContentToText } from "@/lib/planning-text"

/**
 * Exporta o conteúdo de um planejamento para um arquivo .docx.
 * Extraído de `components/ExportButtons.tsx` para reuso em menus de ação.
 */
export async function exportWordDocument(content: unknown, title: string) {
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
