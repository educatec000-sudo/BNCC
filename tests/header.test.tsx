import assert from "node:assert/strict"
import test from "node:test"
import React from "react"
import { readFile } from "node:fs/promises"
import { renderToStaticMarkup } from "react-dom/server"
import {
  headerFieldRows,
  headerFieldWidth,
  moveHeaderField,
  relocateHeaderField,
  sanitizeEditorDocument,
  setHeaderFieldRow,
  type EditorDocument,
  type EditorHeaderField,
} from "../lib/editor-document"
import { DocumentRenderer } from "../components/DocumentRenderer"

// 8 campos padrão na configuração inicial: escola 100% sozinha; pares; assunto sozinho.
const STANDARD: EditorHeaderField[] = [
  { id: "school", label: "NOME DA ESCOLA", value: "Escola Teste", visible: true, row: 1, widthPercent: 100 },
  { id: "student", label: "ALUNO(A)", value: "", visible: true, row: 2, widthPercent: 50 },
  { id: "date", label: "DATA", value: "", visible: true, row: 2, widthPercent: 50 },
  { id: "class", label: "TURMA", value: "", visible: true, row: 3, widthPercent: 50 },
  { id: "teacher", label: "PROFESSOR(A)", value: "", visible: true, row: 3, widthPercent: 50 },
  { id: "subject", label: "DISCIPLINA", value: "Matemática", visible: true, row: 4, widthPercent: 50 },
  { id: "grade", label: "SÉRIE/ANO", value: "5º Ano", visible: true, row: 4, widthPercent: 50 },
  { id: "topic", label: "ASSUNTO", value: "Frações", visible: true, row: 5, widthPercent: 100 },
]

const QUESTION_ALTERNATIVES = ["3/4", "1/2", "2/6", "1/8"].map((content, index) => ({
  id: `a${index}`,
  letter: String.fromCharCode(65 + index),
  content,
}))

function makeDocument(fields: EditorHeaderField[]): EditorDocument {
  return {
    schemaVersion: 1,
    title: "Atividade de Matemática",
    topic: "Frações",
    subtitle: "5º Ano",
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
    header: { visible: true, layout: "normal", fields },
    footer: { visible: true, showPageNumber: true, showSchoolName: false, showMaterialName: true, customText: "" },
    sections: [
      {
        id: "questions",
        title: "QUESTÕES",
        elements: [
          {
            id: "q1",
            type: "question",
            number: 1,
            content: "Quanto é 1/2 + 1/4?",
            alternatives: QUESTION_ALTERNATIVES,
            answer: "A",
            responseLines: 0,
            images: [],
          },
        ],
      },
    ],
  }
}

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

function render(fields: EditorHeaderField[]) {
  return renderToStaticMarkup(<DocumentRenderer document={makeDocument(fields)} assets={[]} />)
}

test("cenário 1 — só escola, aluno e data aparecem", () => {
  const fields = STANDARD.map((field) => ({
    ...field,
    visible: ["school", "student", "date"].includes(field.id),
  }))
  const rows = headerFieldRows(fields)
  assert.equal(rows.length, 2)
  assert.equal(rows[0].length, 1)
  assert.equal(rows[0][0].id, "school")
  assert.deepEqual(rows[1].map((field) => field.id), ["student", "date"])

  const html = render(fields)
  assert.match(html, /NOME DA ESCOLA/)
  assert.match(html, /ALUNO\(A\)/)
  assert.match(html, /DATA:/)
  assert.doesNotMatch(html, /TURMA/)
  assert.doesNotMatch(html, /PROFESSOR\(A\)/)
  assert.doesNotMatch(html, /DISCIPLINA/)
})

test("cenário 2 — todos os campos aparecem", () => {
  const rows = headerFieldRows(STANDARD)
  assert.equal(rows.length, 5)
  assert.equal(rows.flat().length, 8)

  const html = render(STANDARD)
  for (const field of STANDARD) assert.match(html, new RegExp(escapeRegex(field.label)))
})

test("cenário 3 — nome da escola ocupa linha inteira e pode ser alterado", () => {
  const rows = headerFieldRows(STANDARD)
  assert.equal(rows[0].length, 1)
  assert.equal(rows[0][0].id, "school")
  assert.equal(headerFieldWidth(rows[0][0], rows[0].length), 100)

  // "Nome da Escola" pode deixar de ser 100%: dividir a linha com o aluno.
  const fields = STANDARD.map((field) =>
    field.id === "student" ? { ...field, row: 1, widthPercent: 50 }
      : field.id === "school" ? { ...field, widthPercent: 50 }
        : field,
  )
  assert.deepEqual(headerFieldRows(fields)[0].map((field) => field.id), ["school", "student"])
})

test("cenário 4 — aluno e data na mesma linha", () => {
  const rows = headerFieldRows(STANDARD)
  const pair = rows.find((row) => row.some((field) => field.id === "student"))
  assert.ok(pair)
  assert.deepEqual(pair.map((field) => field.id), ["student", "date"])
})

test("cenário 5 — turma e professor na mesma linha", () => {
  const rows = headerFieldRows(STANDARD)
  const pair = rows.find((row) => row.some((field) => field.id === "class"))
  assert.ok(pair)
  assert.deepEqual(pair.map((field) => field.id), ["class", "teacher"])
})

test("cenário 6 — todos em linhas separadas", () => {
  const fields = STANDARD.map((field, index) => ({ ...field, row: index + 1, widthPercent: 100 }))
  const rows = headerFieldRows(fields)
  assert.equal(rows.length, 8)
  assert.ok(rows.every((row) => row.length === 1))
})

test("cenário 7 — três campos na mesma linha dividem a largura", () => {
  const fields = STANDARD.map((field) => {
    if (["student", "date", "class"].includes(field.id)) return { ...field, row: 2, widthPercent: undefined }
    return field
  })
  const rows = headerFieldRows(fields)
  const trio = rows.find((row) => row.length === 3)
  assert.ok(trio)
  assert.deepEqual(trio.map((field) => field.id), ["student", "date", "class"])
  assert.equal(headerFieldWidth(trio[0], 3), 33)
})

test("cenário 8 — reordenar coloca DATA antes de ALUNO(A)", () => {
  const student = STANDARD.find((field) => field.id === "student")!
  const date = STANDARD.find((field) => field.id === "date")!
  const rest = STANDARD.filter((field) => !["school", "student", "date"].includes(field.id))
  const reordered: EditorHeaderField[] = [
    { ...STANDARD.find((field) => field.id === "school")!, row: 1, widthPercent: 100 },
    { ...date, row: 2, widthPercent: 50 },
    { ...student, row: 2, widthPercent: 50 },
    ...rest,
  ]
  const rows = headerFieldRows(reordered)
  assert.deepEqual(rows[1].map((field) => field.id), ["date", "student"])

  const html = render(reordered)
  assert.ok(html.indexOf("DATA:") < html.indexOf("ALUNO(A):"))
})

test("cenário 9 — ocultar campo remove do cabeçalho", () => {
  const fields = STANDARD.map((field) => (field.id === "class" ? { ...field, visible: false } : field))
  const rows = headerFieldRows(fields)
  assert.ok(!rows.flat().some((field) => field.id === "class"))
  assert.doesNotMatch(render(fields), /TURMA/)
})

test("cenário 10 — campo personalizado aparece, persiste e é marcado como custom", () => {
  const custom: EditorHeaderField = { id: "custom-nota", label: "NOTA", value: "10,0", visible: true, row: 6, widthPercent: 100, custom: true }
  const fields = [...STANDARD, custom]
  const rows = headerFieldRows(fields)
  assert.ok(rows.flat().some((field) => field.id === "custom-nota"))
  assert.match(render(fields), /NOTA/)

  const sanitized = sanitizeEditorDocument(makeDocument(fields))
  assert.ok(sanitized)
  const saved = sanitized.header.fields.find((field) => field.id === "custom-nota")
  assert.equal(saved?.custom, true)
  assert.equal(saved?.label, "NOTA")
  assert.equal(saved?.value, "10,0")
})

test("cenário 11 — largura personalizada por campo", () => {
  const fields = STANDARD.map((field) => {
    if (field.id === "student") return { ...field, row: 2, widthPercent: 70 }
    if (field.id === "date") return { ...field, row: 2, widthPercent: 30 }
    return field
  })
  const rows = headerFieldRows(fields)
  const pair = rows.find((row) => row.some((field) => field.id === "student"))!
  const student = pair.find((field) => field.id === "student")!
  const date = pair.find((field) => field.id === "date")!
  assert.equal(headerFieldWidth(student, pair.length), 70)
  assert.equal(headerFieldWidth(date, pair.length), 30)

  const html = render(fields)
  assert.match(html, /width:70%/)
  assert.match(html, /width:30%/)
})

test("cenário 12 — arrastar campo para outra linha (entrar/sair de linhas)", () => {
  // DATA fica sozinha na linha 3; arrastar sobre ALUNO faz DATA entrar na linha 2.
  const fields = STANDARD.map((field) => (field.id === "date" ? { ...field, row: 3, widthPercent: 100 } : field))
  const relocated = relocateHeaderField(fields, "date", "student")
  const rows = headerFieldRows(relocated)
  const pair = rows.find((row) => row.some((field) => field.id === "student"))!
  assert.deepEqual(pair.map((field) => field.id), ["date", "student"])
  assert.equal(headerFieldWidth(pair[0], 2), 50)

  // Mover com as setas (para cima) também faz o campo adotar a linha do vizinho.
  const separated = STANDARD.map((field) => (field.id === "date" ? { ...field, row: 3, widthPercent: 100 } : field))
  const moved = moveHeaderField(separated, "date", "up")
  const movedRows = headerFieldRows(moved)
  const movedPair = movedRows.find((row) => row.some((field) => field.id === "student"))!
  // DATA sobe para a linha do ALUNO e passa a vir antes dele na mesma linha.
  assert.deepEqual(movedPair.map((field) => field.id), ["date", "student"])

  // Mudar a linha pelo número também reequilibra.
  const byNumber = setHeaderFieldRow(separated, "date", 2)
  const byNumberPair = headerFieldRows(byNumber).find((row) => row.some((field) => field.id === "date"))!
  assert.deepEqual(byNumberPair.map((field) => field.id).sort(), ["date", "student"])
})

test("cenário 13 — salvar e reabrir preserva ordem, linhas, larguras e visibilidade", () => {
  const fields: EditorHeaderField[] = [
    { id: "student", label: "ALUNO(A)", value: "", visible: true, row: 1, widthPercent: 70 },
    { id: "date", label: "DATA", value: "", visible: true, row: 1, widthPercent: 30 },
    { id: "school", label: "NOME DA ESCOLA", value: "Escola", visible: true, row: 2, widthPercent: 100 },
    { id: "teacher", label: "PROFESSOR(A)", value: "", visible: true, row: 3, widthPercent: 50 },
    { id: "class", label: "TURMA", value: "", visible: false, row: 3, widthPercent: 50 },
    { id: "topic", label: "ASSUNTO", value: "Frações", visible: true, row: 4, widthPercent: 100 },
    { id: "custom-x", label: "NOTA", value: "", visible: true, row: 4, widthPercent: 100, custom: true },
  ]
  const document = makeDocument(fields)
  const roundtrip = JSON.parse(JSON.stringify(document)) as unknown
  const sanitized = sanitizeEditorDocument(roundtrip)
  assert.ok(sanitized)
  const snapshot = (list: EditorHeaderField[]) =>
    list.map((field) => [field.id, field.row, field.visible, field.widthPercent, field.custom ?? false])
  assert.deepEqual(snapshot(sanitized.header.fields), snapshot(fields))
})

test("cenário 14 — nova geração IA (documento legado) migra para a estrutura flexível", () => {
  // Documento no formato antigo do gerador: fullWidth para escola/assunto, sem `row`.
  const legacy = [
    { id: "school", label: "NOME DA ESCOLA", value: "", visible: true, fullWidth: true, widthPercent: 100 },
    { id: "student", label: "ALUNO(A)", value: "", visible: true, widthPercent: 50 },
    { id: "date", label: "DATA", value: "", visible: true, widthPercent: 50 },
    { id: "class", label: "TURMA", value: "", visible: true, widthPercent: 50 },
    { id: "teacher", label: "PROFESSOR(A)", value: "", visible: true, widthPercent: 50 },
    { id: "subject", label: "DISCIPLINA", value: "Matemática", visible: true, widthPercent: 50 },
    { id: "grade", label: "SÉRIE/ANO", value: "5º Ano", visible: true, widthPercent: 50 },
    { id: "topic", label: "ASSUNTO", value: "Frações", visible: true, fullWidth: true, widthPercent: 100 },
  ] as unknown as EditorHeaderField[]
  const sanitized = sanitizeEditorDocument(makeDocument(legacy))
  assert.ok(sanitized)
  const rows = headerFieldRows(sanitized.header.fields)
  assert.deepEqual(rows.map((row) => row.map((field) => field.id)), [
    ["school"],
    ["student", "date"],
    ["class", "teacher"],
    ["subject", "grade"],
    ["topic"],
  ])
  // Todo campo passa a ter uma linha numérica explícita.
  assert.ok(sanitized.header.fields.every((field) => typeof field.row === "number"))
})

test("cenário 15 — o PDF usa a mesma estrutura de linhas e larguras", async () => {
  const pdf = await readFile(new URL("../lib/pdf/EditorPdfDocument.tsx", import.meta.url), "utf8")
  assert.match(pdf, /headerFieldRows\(/)
  assert.match(pdf, /\$\{headerFieldWidth\(field, row\.length\)\}%/)
  assert.match(pdf, /flexDirection:\s*"row"/)
})

test("cenário 16 — preview limpo reflete a mesma ordem e larguras do editor", () => {
  const html = render(STANDARD)
  assert.ok(html.indexOf("NOME DA ESCOLA:") < html.indexOf("ALUNO(A):"))
  assert.ok(html.indexOf("ALUNO(A):") < html.indexOf("DATA:"))
  assert.ok(html.indexOf("DATA:") < html.indexOf("TURMA:"))
  // Escola sozinha = 100% e assunto sozinho = 100%.
  assert.match(html, /width:100%/)
})

test("cenário 17 — conteúdo não gera um segundo cabeçalho de identificação", () => {
  const document = makeDocument(STANDARD)
  document.sections[0].elements = [
    { id: "p1", type: "paragraph", content: "Nome do Estudante: ______<br>Turma: ____<br>Data: ____" },
    {
      id: "q1",
      type: "question",
      number: 1,
      content: "Em 15 de agosto de 2026, ocorreu um eclipse lunar. O que isso representa?",
      alternatives: QUESTION_ALTERNATIVES,
      answer: "A",
      responseLines: 0,
      images: [],
    },
  ]
  const sanitized = sanitizeEditorDocument(document)
  assert.ok(sanitized)
  const paragraph = sanitized.sections[0].elements[0]
  assert.equal(paragraph.type, "paragraph")
  if (paragraph.type === "paragraph") {
    assert.doesNotMatch(paragraph.content, /Nome do Estudante/)
    assert.doesNotMatch(paragraph.content, /Turma/)
  }
  const question = sanitized.sections[0].elements[1]
  assert.equal(question.type, "question")
  if (question.type === "question") {
    assert.match(question.content, /15 de agosto de 2026/) // texto pedagógico preservado
  }
})

test("cenário 18 — alternativas não duplicam a letra (sem \"A) A)\")", () => {
  const document = makeDocument(STANDARD)
  const question = document.sections[0].elements[0]
  assert.equal(question.type, "question")
  if (question.type !== "question") return
  question.alternatives = ["A) 3/4", "B) 1/2", "C) 2/6", "D) 1/8"].map((content, index) => ({
    id: `a${index}`,
    letter: String.fromCharCode(65 + index),
    content,
  }))

  const sanitized = sanitizeEditorDocument(document)
  assert.ok(sanitized)
  const saved = sanitized.sections[0].elements[0]
  assert.equal(saved.type, "question")
  if (saved.type !== "question") return
  assert.deepEqual(saved.alternatives.map((alternative) => alternative.letter), ["A", "B", "C", "D"])
  assert.deepEqual(saved.alternatives.map((alternative) => alternative.content), ["3/4", "1/2", "2/6", "1/8"])

  const html = renderToStaticMarkup(<DocumentRenderer document={sanitized} assets={[]} />)
  assert.doesNotMatch(html, /A\)\s*A\)/)
  assert.doesNotMatch(html, /B\)\s*B\)/)
})
