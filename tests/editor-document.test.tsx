import assert from "node:assert/strict"
import test from "node:test"
import React from "react"
import { readFile } from "node:fs/promises"
import { renderToStaticMarkup } from "react-dom/server"
import { renderToBuffer } from "@react-pdf/renderer"
import sharp from "sharp"
import { DocumentRenderer } from "../components/DocumentRenderer"
import { EditorPdfDocument } from "../lib/pdf/EditorPdfDocument"
import { sanitizeEditorDocument, type EditorAssetView, type EditorDocument } from "../lib/editor-document"

const technicalPrompt = "Prompt da imagem: quatro figuras geométricas com fundo branco"
const technicalAlt = "Círculo, quadrado, triângulo e retângulo alinhados."

function geometryDocument(): EditorDocument {
  return {
    schemaVersion: 1,
    title: "Atividade de Matemática",
    topic: "Figuras geométricas",
    subtitle: "2º Ano · Matemática",
    page: {
      size: "A4",
      orientation: "portrait",
      marginTop: 20,
      marginRight: 18,
      marginBottom: 20,
      marginLeft: 18,
      defaultFontFamily: "Arial",
      defaultFontSize: 11,
      lineHeight: 1.5,
    },
    header: {
      visible: true,
      fields: [
        { id: "school", label: "NOME DA ESCOLA", value: "Escola Teste", visible: true },
        { id: "student", label: "ALUNO(A)", value: "", visible: true },
        { id: "class", label: "TURMA", value: "", visible: true },
        { id: "teacher", label: "PROFESSOR(A)", value: "", visible: true },
        { id: "subject", label: "DISCIPLINA", value: "Matemática", visible: true },
        { id: "date", label: "DATA", value: "", visible: true },
        { id: "topic", label: "ASSUNTO", value: "Figuras geométricas", visible: true },
      ],
    },
    footer: {
      visible: true,
      showPageNumber: true,
      showSchoolName: false,
      showMaterialName: true,
      customText: "",
    },
    sections: [
      {
        id: "questions",
        title: "QUESTÕES",
        elements: [
          {
            id: "question-1",
            type: "question",
            number: 1,
            content: "Qual das figuras geométricas abaixo possui exatamente 3 lados?",
            alternatives: ["Círculo", "Quadrado", "Triângulo", "Retângulo"].map((content, index) => ({ id: `alternative-${index}`, letter: String.fromCharCode(65 + index), content })),
            responseLines: 0,
            images: [{ assetId: "geometry-asset", widthPercent: 75, alignment: "center" }],
          },
        ],
      },
    ],
  }
}

async function geometryPng() {
  const svg = `
    <svg width="1000" height="420" xmlns="http://www.w3.org/2000/svg">
      <rect width="1000" height="420" fill="white"/>
      <circle cx="125" cy="185" r="90" fill="none" stroke="#111827" stroke-width="10"/>
      <rect x="310" y="95" width="180" height="180" fill="none" stroke="#111827" stroke-width="10"/>
      <path d="M625 80 L525 285 L725 285 Z" fill="none" stroke="#111827" stroke-width="10" stroke-linejoin="round"/>
      <rect x="790" y="115" width="180" height="140" fill="none" stroke="#111827" stroke-width="10"/>
    </svg>`
  return sharp(Buffer.from(svg)).png().toBuffer()
}

test("documento canônico referencia o mesmo asset persistente no preview limpo", () => {
  const document = geometryDocument()
  const assets: EditorAssetView[] = [{
    id: "geometry-asset",
    url: "/api/images/geometry-asset?v=1",
    originalUrl: "/api/images/geometry-asset?version=1",
    status: "READY",
    prompt: technicalPrompt,
    provider: "huggingface",
    model: "black-forest-labs/FLUX.1-schnell",
    style: "EDUCATIONAL",
    altText: technicalAlt,
    placementKey: "question:1",
    version: 1,
    createdAt: "2026-08-20T12:00:00.000Z",
    updatedAt: "2026-08-20T12:00:00.000Z",
  }]
  const html = renderToStaticMarkup(<DocumentRenderer document={document} assets={assets} />)
  assert.match(html, /Qual das figuras geométricas abaixo possui exatamente 3 lados\?/)
  assert.match(html, /src="\/api\/images\/geometry-asset\?v=1"/)
  assert.match(html, /alt="Círculo, quadrado, triângulo e retângulo alinhados\."/)
  assert.doesNotMatch(html, /Prompt da imagem:/)
  assert.doesNotMatch(html, />EDUCATIONAL</)
  assert.doesNotMatch(html, />Círculo, quadrado, triângulo e retângulo alinhados\.</)
})

test("PDF incorpora os bytes da imagem persistida sem prompt, estilo ou legenda técnica", async () => {
  const data = await geometryPng()
  const buffer = await renderToBuffer(
    <EditorPdfDocument
      document={geometryDocument()}
      assets={[{ id: "geometry-asset", data, format: "png", altText: technicalAlt }]}
    />,
  )
  const pdf = buffer.toString("latin1")
  assert.equal(buffer.subarray(0, 4).toString(), "%PDF")
  assert.ok(buffer.length > data.length / 4)
  assert.match(pdf, /\/Subtype\s*\/Image/)
  assert.doesNotMatch(pdf, /Prompt da imagem/)
  assert.doesNotMatch(pdf, /EDUCATIONAL/)
  assert.doesNotMatch(pdf, /Círculo, quadrado, triângulo e retângulo alinhados/)
})

test("edição manual preserva referência do asset e sanitiza conteúdo rico", () => {
  const document = geometryDocument()
  const edited = structuredClone(document)
  const question = edited.sections[0].elements[0]
  assert.equal(question.type, "question")
  if (question.type !== "question") return
  question.content = '<strong>Qual figura possui 3 lados?</strong><script>alert("x")</script>'
  question.alternatives.push({ id: "alternative-5", letter: "E", content: "Pentágono" })
  question.images[0].widthPercent = 55
  const sanitized = sanitizeEditorDocument(edited)
  assert.ok(sanitized)
  const savedQuestion = sanitized.sections[0].elements[0]
  assert.equal(savedQuestion.type, "question")
  if (savedQuestion.type !== "question") return
  assert.equal(savedQuestion.images[0].assetId, "geometry-asset")
  assert.equal(savedQuestion.images[0].widthPercent, 55)
  assert.equal(savedQuestion.alternatives.length, 5)
  assert.doesNotMatch(savedQuestion.content, /script|alert/)
  assert.match(savedQuestion.content, /<strong>/)
})

test("CSS de impressão mantém assets visíveis e remove controles", async () => {
  const css = await readFile(new URL("../app/globals.css", import.meta.url), "utf8")
  assert.match(css, /@media print/)
  assert.match(css, /\.document-asset img[\s\S]*display:\s*block\s*!important/)
  assert.match(css, /\.print-hidden[\s\S]*display:\s*none\s*!important/)
  assert.match(css, /break-inside:\s*avoid/)
})
