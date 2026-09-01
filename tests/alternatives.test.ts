import assert from "node:assert/strict"
import test from "node:test"
import {
  alternativeLetter,
  alternativeMark,
  normalizeAlternativeList,
  normalizeAlternativeText,
  normalizeAnswerLetter,
  splitAlternativeLetter,
} from "../lib/alternatives"
import {
  headerFieldRows,
  sanitizeEditorDocument,
  type EditorDocument,
} from "../lib/editor-document"

test("alternativeLetter gera A, B, C... e continua após Z", () => {
  assert.equal(alternativeLetter(0), "A")
  assert.equal(alternativeLetter(1), "B")
  assert.equal(alternativeLetter(4), "E")
  assert.equal(alternativeLetter(25), "Z")
  assert.equal(alternativeLetter(26), "AA")
  assert.equal(alternativeMark("A"), "A)")
})

const formats = [
  ["A) texto", "texto"],
  ["A. texto", "texto"],
  ["(A) texto", "texto"],
  ["A - texto", "texto"],
  ["A- texto", "texto"],
  ["A: texto", "texto"],
  ["a) 1,0 x 10^-3 N", "1,0 x 10^-3 N"],
  ["A)1,0 x 10^-3 N", "1,0 x 10^-3 N"],
  ["B. 4,0 x 10^-3 N", "4,0 x 10^-3 N"],
  ["texto sem letra", "texto sem letra"],
] as const

for (const [input, expected] of formats) {
  test(`normaliza alternativa "${input}"`, () => {
    assert.equal(normalizeAlternativeText(input), expected)
  })
}

test("não remove 'A' quando é palavra (sem marcador)", () => {
  assert.equal(normalizeAlternativeText("A bola é redonda"), "A bola é redonda")
  assert.equal(normalizeAlternativeText("1,0 x 10^-3 N"), "1,0 x 10^-3 N")
})

test("splitAlternativeLetter separa letra e texto", () => {
  assert.deepEqual(splitAlternativeLetter("(A) texto"), { letter: "A", text: "texto" })
  assert.deepEqual(splitAlternativeLetter("a) x"), { letter: "A", text: "x" })
  assert.deepEqual(splitAlternativeLetter("texto"), { letter: "", text: "texto" })
})

test("normalizeAlternativeList atribui letra pela posição e limpa o texto", () => {
  const list = normalizeAlternativeList(["A) um", "B. dois", "(C) três", "quatro"])
  assert.deepEqual(list, [
    { letter: "A", text: "um" },
    { letter: "B", text: "dois" },
    { letter: "C", text: "três" },
    { letter: "D", text: "quatro" },
  ])
})

test("normalizeAnswerLetter converte 'A)', 'A.', '(A)' para 'A' e preserva texto aberto", () => {
  assert.equal(normalizeAnswerLetter("A)"), "A")
  assert.equal(normalizeAnswerLetter("a."), "A")
  assert.equal(normalizeAnswerLetter("(B)"), "B")
  assert.equal(normalizeAnswerLetter("Resposta dissertativa completa"), "Resposta dissertativa completa")
})

function baseDocument(): EditorDocument {
  return {
    schemaVersion: 1,
    title: "Atividade de Física",
    topic: "Força magnética",
    subtitle: "3º Ano · Física",
    page: {
      size: "A4", orientation: "portrait", marginTop: 20, marginRight: 18, marginBottom: 20, marginLeft: 18,
      defaultFontFamily: "Arial", defaultFontSize: 11, lineHeight: 1.5,
    },
    header: {
      visible: true,
      layout: "normal",
      fields: [
        { id: "school", label: "NOME DA ESCOLA", value: "", visible: true, fullWidth: true, widthPercent: 100 },
        { id: "student", label: "ALUNO(A)", value: "", visible: true, widthPercent: 50 },
        { id: "date", label: "DATA", value: "", visible: true, widthPercent: 50 },
        { id: "topic", label: "ASSUNTO", value: "Força magnética", visible: true, fullWidth: true, widthPercent: 100 },
      ],
    },
    footer: { visible: true, showPageNumber: true, showSchoolName: false, showMaterialName: false, customText: "" },
    sections: [{
      id: "s1",
      title: "QUESTÕES",
      elements: [{
        id: "q1",
        type: "question",
        number: 1,
        content: "Qual é a força sobre a carga?",
        alternatives: [
          { id: "a0", letter: "A", content: "A) 1,0 x 10^-3 N" },
          { id: "a1", letter: "B", content: "B) 4,0 x 10^-3 N" },
          { id: "a2", letter: "C", content: "2,0 x 10^-3 N" },
        ],
        answer: "B)",
        justification: "F = q · v · B",
        responseLines: 0,
        images: [],
      }],
    }],
  }
}

test("sanitizeEditorDocument remove letra embutida das alternativas e normaliza resposta", () => {
  const sanitized = sanitizeEditorDocument(baseDocument())
  assert.ok(sanitized)
  const question = sanitized.sections[0].elements[0]
  assert.equal(question.type, "question")
  if (question.type !== "question") return
  assert.equal(question.alternatives[0].letter, "A")
  assert.equal(question.alternatives[0].content, "1,0 x 10^-3 N")
  assert.equal(question.alternatives[1].content, "4,0 x 10^-3 N")
  assert.equal(question.alternatives[2].letter, "C")
  assert.equal(question.alternatives[2].content, "2,0 x 10^-3 N")
  assert.equal(question.answer, "B")
  assert.equal(question.justification, "F = q · v · B")
})

test("alternativas legadas (texto com 'A)') são migradas ao abrir", () => {
  const legacy = baseDocument()
  const legacyQuestion = legacy.sections[0].elements[0]
  if (legacyQuestion.type !== "question") return
  legacyQuestion.alternatives = [
    { id: "a0", letter: "A", content: "A) 1,0 x 10^-3 N" },
    { id: "a1", letter: "B", content: "B) 4,0 x 10^-3 N" },
    { id: "a2", letter: "C", content: "C) 2,0 x 10^-3 N" },
  ]
  const sanitized = sanitizeEditorDocument(legacy)
  assert.ok(sanitized)
  const question = sanitized.sections[0].elements[0]
  if (question.type !== "question") return
  for (const alternative of question.alternatives) {
    assert.doesNotMatch(alternative.content, /^[A-Z]\)\s*/)
  }
})

test("cabeçalho agrupa escola e assunto em linha inteira e os demais em pares", () => {
  // Documentos legados (fullWidth, sem `row`) são migrados pelo sanitizer: a
  // escola e o assunto ficam em linha própria e os demais campos em pares.
  const sanitized = sanitizeEditorDocument(baseDocument())
  assert.ok(sanitized)
  const rows = headerFieldRows(sanitized.header.fields)
  assert.deepEqual(rows.map((row) => row.map((field) => field.id)), [
    ["school"],
    ["student", "date"],
    ["topic"],
  ])
})

test("questões abertas preservam resposta em texto", () => {
  const document = baseDocument()
  const question = document.sections[0].elements[0]
  if (question.type !== "question") return
  question.alternatives = []
  question.answer = "A força resultante é nula quando v é paralelo a B."
  const sanitized = sanitizeEditorDocument(document)
  assert.ok(sanitized)
  const saved = sanitized.sections[0].elements[0]
  if (saved.type !== "question") return
  assert.equal(saved.answer, "A força resultante é nula quando v é paralelo a B.")
})

test("migra documentos antigos: remove tabela de gabarito estática quando a questão já tem resposta", () => {
  const legacy = baseDocument()
  legacy.sections.push({
    id: "gabarito",
    title: "Gabarito",
    pageBreakBefore: true,
    elements: [{
      id: "gt",
      type: "table",
      headers: ["Questão", "Resposta", "Explicação"],
      rows: [["1", "A)", "Força magnética"]],
    }],
  })
  const sanitized = sanitizeEditorDocument(legacy)
  assert.ok(sanitized)
  const titles = sanitized.sections.map((section) => section.title.replace(/<[^>]+>/g, "").trim())
  assert.ok(!titles.includes("Gabarito"), "tabela estática antiga deveria ser removida")
})
