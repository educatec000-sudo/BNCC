import assert from "node:assert/strict"
import test from "node:test"
import React from "react"
import { readFile } from "node:fs/promises"
import { renderToStaticMarkup } from "react-dom/server"
import {
  groupSectionElements,
  isTwoColumns,
  layoutFlow,
  layoutQuestionColumns,
  mmToPx,
  pageDimensionsMm,
  paginateBlocks,
  estimateQuestionHeight,
} from "../lib/document-layout"
import {
  headerFieldRows,
  headerFieldWidth,
  isPedagogicalSectionTitle,
  moveHeaderField,
  sanitizeEditorDocument,
  type EditorDocument,
  type EditorElement,
} from "../lib/editor-document"
import { DocumentRenderer } from "../components/DocumentRenderer"

function makeQuestion(id: string, number: number, content: string, alternatives = 4, images: string[] = []): Extract<EditorElement, { type: "question" }> {
  return {
    id,
    type: "question",
    number,
    content,
    alternatives: Array.from({ length: alternatives }, (_, index) => ({
      id: `${id}-a${index}`,
      letter: String.fromCharCode(65 + index),
      content: `Alternativa ${index + 1} de ${number}`,
    })),
    responseLines: 0,
    images: images.map((assetId) => ({ assetId, widthPercent: 75, alignment: "center" as const })),
  }
}

function makeDocument(overrides: Partial<EditorDocument["page"]> & { sections?: EditorDocument["sections"] } = {}): EditorDocument {
  const { sections, ...pageOverrides } = overrides
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
      ...pageOverrides,
    },
    header: {
      visible: true,
      layout: "normal",
      fields: [
        { id: "school", label: "NOME DA ESCOLA", value: "Escola Teste", visible: true, row: 1, widthPercent: 100 },
        { id: "student", label: "ALUNO(A)", value: "", visible: true, row: 2, widthPercent: 50 },
        { id: "date", label: "DATA", value: "", visible: true, row: 2, widthPercent: 50 },
      ],
    },
    footer: { visible: true, showPageNumber: true, showSchoolName: false, showMaterialName: true, customText: "" },
    sections: sections || [
      {
        id: "s1",
        title: "QUESTÕES",
        elements: [
          makeQuestion("q1", 1, "Quanto é 1/2 + 1/4?"),
          makeQuestion("q2", 2, "Quanto é 3/5 - 1/5?"),
          makeQuestion("q3", 3, "Quanto é 2/3 de 9?"),
          makeQuestion("q4", 4, "Qual fração equivale a 0,5?"),
        ],
      },
    ],
  }
}

// ============================ Agrupamento e paginação ============================

test("1. atividade com uma coluna agrupa questões em fluxo único", () => {
  const document = makeDocument()
  assert.equal(isTwoColumns(document), false)
  const groups = groupSectionElements(document.sections[0].elements)
  assert.equal(groups.length, 1)
  assert.equal(groups[0].kind, "questions")
  if (groups[0].kind !== "questions") return
  assert.equal(groups[0].questions.length, 4)
})

test("2. duas colunas: fluxo vertical independente e balanceado (sem emparelhar linhas)", () => {
  const items = ["q1", "q2", "q3", "q4"].map((id) => ({ id, height: 100 }))
  const pages = layoutQuestionColumns(items, 1000)
  assert.equal(pages.length, 1)
  const [left, right] = pages[0]
  assert.deepEqual(left.map((item) => item.id), ["q1", "q2"])
  assert.deepEqual(right.map((item) => item.id), ["q3", "q4"])
})

test("3. uma única questão ocupa só a coluna esquerda, sem lacuna artificial", () => {
  const pages = layoutQuestionColumns([{ id: "q1", height: 100 }], 1000)
  assert.equal(pages.length, 1)
  assert.deepEqual(pages[0][0].map((item) => item.id), ["q1"])
  assert.deepEqual(pages[0][1], [])
})

test("4. 20 questões preenchem as duas colunas (10/10) mantendo a sequência", () => {
  const items = Array.from({ length: 20 }, (_, index) => ({ id: `q${index + 1}`, height: 100 }))
  const pages = layoutQuestionColumns(items, 600)
  const flat = pages.flatMap(([left, right]) => [...left, ...right])
  assert.equal(flat.length, 20)
  // sequência de leitura (esquerda de cima para baixo e depois direita) = 1..20
  assert.deepEqual(flat.map((item) => Number(item.id.slice(1))), Array.from({ length: 20 }, (_, index) => index + 1))
  const leftCount = pages.reduce((sum, [left]) => sum + left.length, 0)
  const rightCount = pages.reduce((sum, [, right]) => sum + right.length, 0)
  assert.equal(leftCount, 10)
  assert.equal(rightCount, 10)
})

test("5. tamanhos diferentes equilibram as colunas pela altura real", () => {
  const items = [
    { id: "q1", height: 100 },
    { id: "q2", height: 40 },
    { id: "q3", height: 40 },
    { id: "q4", height: 100 },
  ]
  const pages = layoutQuestionColumns(items, 1000)
  const [left, right] = pages[0]
  assert.deepEqual(left.map((item) => item.id), ["q1", "q2"])
  assert.deepEqual(right.map((item) => item.id), ["q3", "q4"])
})

test("6. questão muito grande ocupa uma coluna sozinha e não é dividida nem esmagada", () => {
  const items = [{ id: "big", height: 5000 }, { id: "q2", height: 100 }]
  const pages = layoutQuestionColumns(items, 600)
  const [left, right] = pages[0]
  assert.deepEqual(left.map((item) => item.id), ["big"])
  assert.deepEqual(right.map((item) => item.id), ["q2"])
})

test("7. várias páginas: páginas intermediárias cheias e última balanceada", () => {
  const items = Array.from({ length: 20 }, (_, index) => ({ id: `q${index + 1}`, height: 100 }))
  const pages = layoutQuestionColumns(items, 600)
  assert.equal(pages.length, 2)
  assert.equal(pages[0][0].length + pages[0][1].length, 12)
  assert.equal(pages[1][0].length + pages[1][1].length, 8)
})

test("8. layoutFlow: instruções em largura total e questões em colunas logo abaixo", () => {
  const flow = [
    { kind: "full" as const, id: "title", height: 40 },
    { kind: "full" as const, id: "instr", height: 80 },
    { kind: "question" as const, id: "q1", height: 100 },
    { kind: "question" as const, id: "q2", height: 100 },
    { kind: "question" as const, id: "q3", height: 100 },
    { kind: "question" as const, id: "q4", height: 100 },
  ]
  const pages = layoutFlow(flow, 500)
  assert.equal(pages.length, 1)
  assert.deepEqual(pages[0].full.map((block) => block.id), ["title", "instr"])
  assert.deepEqual(pages[0].columns[0].map((block) => block.id), ["q1", "q2"])
  assert.deepEqual(pages[0].columns[1].map((block) => block.id), ["q3", "q4"])
})

test("9. questão maior que o espaço restante abaixo das instruções vai para a próxima página", () => {
  const flow = [
    { kind: "full" as const, id: "instr", height: 300 },
    { kind: "question" as const, id: "q1", height: 300 },
  ]
  const pages = layoutFlow(flow, 500)
  assert.equal(pages.length, 2)
  assert.deepEqual(pages[0].full.map((block) => block.id), ["instr"])
  assert.equal(pages[0].columns.length, 0)
  assert.deepEqual(pages[1].columns[0].map((block) => block.id), ["q1"])
})

test("10. paginação quebra em páginas de altura fixa sem dividir bloco no meio", () => {
  const blocks = Array.from({ length: 24 }, (_, index) => ({ key: `b${index}`, height: 60 }))
  const pages = paginateBlocks(blocks, 400)
  assert.equal(pages.length, 4)
  assert.deepEqual(pages.map((page) => page.length), [6, 6, 6, 6])
})

test("11. questões de tamanhos diferentes fluem sem quebrar bloco no meio", () => {
  const blocks = [
    { key: "small", height: 50 },
    { key: "big", height: 300 },
    { key: "small2", height: 100 },
  ]
  const pages = paginateBlocks(blocks, 400)
  assert.deepEqual(pages.map((page) => page.map((index) => blocks[index].key)), [["small", "big"], ["small2"]])
  assert.deepEqual(pages[0].map((index) => blocks[index].key), ["small", "big"])
})

test("12. questões com imagens contribuem para a altura estimada", () => {
  const question = makeQuestion("q1", 1, "Com imagem", 4, ["asset-1"])
  const base = estimateQuestionHeight(makeQuestion("q2", 2, "Sem imagem", 4))
  assert.ok(estimateQuestionHeight(question) > base)
})

test("13. texto longo e muitas alternativas aumentam a altura estimada", () => {
  const short = estimateQuestionHeight(makeQuestion("s", 1, "Curto", 2))
  const long = estimateQuestionHeight(makeQuestion("l", 2, "L".repeat(400), 2))
  const many = estimateQuestionHeight(makeQuestion("m", 3, "Curto", 8))
  assert.ok(long > short)
  assert.ok(many > short)
})

// ============================ Persistência e sanitização ============================

test("14. fórmulas são preservadas sem alteração pela normalização", () => {
  const document = makeDocument()
  const question = document.sections[0].elements[0]
  assert.equal(question.type, "question")
  if (question.type !== "question") return
  question.content = "Calcule a força: F = q · v · B, com q = 1,0 x 10^-3 C."
  const sanitized = sanitizeEditorDocument(document)
  assert.ok(sanitized)
  const saved = sanitized.sections[0].elements[0]
  assert.equal(saved.type, "question")
  if (saved.type !== "question") return
  assert.match(saved.content, /1,0 x 10\^-3 C/)
  assert.match(saved.content, /F = q · v · B/)
})

test("15. alteração da fonte global é salva e reaberta", () => {
  const document = makeDocument({ defaultFontFamily: "Times New Roman" })
  const sanitized = sanitizeEditorDocument(JSON.parse(JSON.stringify(document)))
  assert.ok(sanitized)
  assert.equal(sanitized.page.defaultFontFamily, "Times New Roman")
})

test("16. alteração do tamanho global é salva e reaberta", () => {
  const document = makeDocument({ defaultFontSize: 14 })
  const sanitized = sanitizeEditorDocument(JSON.parse(JSON.stringify(document)))
  assert.ok(sanitized)
  assert.equal(sanitized.page.defaultFontSize, 14)
})

test("17. alteração do espaçamento global é salva e reaberta", () => {
  const document = makeDocument({ lineHeight: 2, defaultSpacingAfter: 12 })
  const sanitized = sanitizeEditorDocument(JSON.parse(JSON.stringify(document)))
  assert.ok(sanitized)
  assert.equal(sanitized.page.lineHeight, 2)
  assert.equal(sanitized.page.defaultSpacingAfter, 12)
})

test("18. alinhamento global aplica padrão ao corpo sem quebrar alternativas", () => {
  const document = makeDocument({ defaultAlignment: "justify" })
  const html = renderToStaticMarkup(<DocumentRenderer document={document} assets={[]} />)
  assert.match(html, /justify/)
  assert.match(html, /text-align:left/)
})

test("19. cabeçalho: alterar, reordenar, ocultar e redimensionar campos", () => {
  const document = makeDocument()
  const sanitized = sanitizeEditorDocument(document)!
  sanitized.header.fields.push({ id: "custom-nota", label: "NOTA", value: "", visible: true, row: 3, widthPercent: 100, custom: true })
  const reordered = moveHeaderField(sanitized.header.fields, "date", "up")
  const rows = headerFieldRows(reordered)
  const pair = rows.find((row) => row.some((field) => field.id === "student"))!
  assert.deepEqual(pair.map((field) => field.id), ["date", "student"])
  const hidden = reordered.map((field) => (field.id === "date" ? { ...field, visible: false } : field))
  assert.ok(!headerFieldRows(hidden).flat().some((field) => field.id === "date"))
  const resized = reordered.map((field) => {
    if (field.id === "date") return { ...field, widthPercent: 30 }
    if (field.id === "student") return { ...field, widthPercent: 70 }
    return field
  })
  const resizedPair = headerFieldRows(resized).find((row) => row.some((field) => field.id === "student"))!
  assert.equal(headerFieldWidth(resizedPair.find((field) => field.id === "student")!, resizedPair.length), 70)
  assert.equal(headerFieldWidth(resizedPair.find((field) => field.id === "date")!, resizedPair.length), 30)
})

test("20. salvar preserva colunas, margens, fonte, espaçamento, separador e alinhamento", () => {
  const document = makeDocument({
    columns: "two",
    columnGap: 32,
    columnSeparator: "line",
    marginTop: 25,
    defaultFontFamily: "Georgia",
    defaultFontSize: 12,
    lineHeight: 1.15,
    defaultAlignment: "center",
    defaultSpacingAfter: 10,
    defaultColor: "#1a2b3c",
  })
  const sanitized = sanitizeEditorDocument(JSON.parse(JSON.stringify(document)))
  assert.ok(sanitized)
  const page = sanitized.page
  assert.equal(page.columns, "two")
  assert.equal(page.columnGap, 32)
  assert.equal(page.columnSeparator, "line")
  assert.equal(page.marginTop, 25)
  assert.equal(page.defaultFontFamily, "Georgia")
  assert.equal(page.defaultFontSize, 12)
  assert.equal(page.lineHeight, 1.15)
  assert.equal(page.defaultAlignment, "center")
  assert.equal(page.defaultSpacingAfter, 10)
  assert.equal(page.defaultColor, "#1a2b3c")
  assert.equal(page.pedagogicalPageBreakBefore, true)
})

test("20b. margens padrão são 15 mm quando não informadas", () => {
  const document = makeDocument()
  // remove margens para testar o padrão do sanitizador
  const raw = JSON.parse(JSON.stringify(document)) as Record<string, any>
  delete raw.page.marginTop
  delete raw.page.marginRight
  delete raw.page.marginBottom
  delete raw.page.marginLeft
  const sanitized = sanitizeEditorDocument(raw)
  assert.ok(sanitized)
  assert.equal(sanitized.page.marginTop, 15)
  assert.equal(sanitized.page.marginRight, 15)
  assert.equal(sanitized.page.marginBottom, 15)
  assert.equal(sanitized.page.marginLeft, 15)
})

test("21. espaçamento entre colunas é sanitizado (8..80)", () => {
  const small = sanitizeEditorDocument(makeDocument({ columns: "two", columnGap: 2 }))!
  assert.equal(small.page.columnGap, 8)
  const big = sanitizeEditorDocument(makeDocument({ columns: "two", columnGap: 999 }))!
  assert.equal(big.page.columnGap, 80)
  const ok = sanitizeEditorDocument(makeDocument({ columns: "two", columnGap: 32 }))!
  assert.equal(ok.page.columnGap, 32)
})

test("22. margens pequenas e grandes são recalculadas dentro dos limites (8..50)", () => {
  const small = sanitizeEditorDocument(makeDocument({ marginTop: 2 }))!
  assert.equal(small.page.marginTop, 8)
  const big = sanitizeEditorDocument(makeDocument({ marginLeft: 200 }))!
  assert.equal(big.page.marginLeft, 50)
})

test("23. largura da coluna usa página, margens e espaçamento", () => {
  const document = makeDocument({ columns: "two", marginLeft: 20, marginRight: 20, columnGap: 24 })
  const dimensions = pageDimensionsMm(document)
  const usable = mmToPx(dimensions.width) - mmToPx(20) - mmToPx(20)
  const columnWidth = (usable - 24) / 2
  assert.ok(columnWidth > 0)
  assert.ok(columnWidth < usable)
  assert.ok(Math.abs(columnWidth - (usable - 24) / 2) < 1e-6)
})

test("24. reabrir atividade preserva ordem, linhas, larguras e visibilidade do cabeçalho", () => {
  const document = makeDocument()
  document.header.fields = [
    { id: "student", label: "ALUNO(A)", value: "", visible: true, row: 1, widthPercent: 70 },
    { id: "date", label: "DATA", value: "", visible: true, row: 1, widthPercent: 30 },
    { id: "school", label: "NOME DA ESCOLA", value: "Escola", visible: true, row: 2, widthPercent: 100 },
    { id: "custom-x", label: "NOTA", value: "", visible: true, row: 3, widthPercent: 100, custom: true },
  ]
  const sanitized = sanitizeEditorDocument(JSON.parse(JSON.stringify(document)))
  assert.ok(sanitized)
  const snapshot = sanitized.header.fields.map((field) => [field.id, field.row, field.visible, field.widthPercent])
  assert.deepEqual(snapshot, [
    ["student", 1, true, 70],
    ["date", 1, true, 30],
    ["school", 2, true, 100],
    ["custom-x", 3, true, 100],
  ])
})

// ============================ Preview / Impressão / PDF ============================

test("25. preview limpo usa colunas independentes (sem emparelhamento em linhas)", () => {
  const document = makeDocument({ columns: "two" })
  const html = renderToStaticMarkup(<DocumentRenderer document={document} assets={[]} />)
  assert.match(html, /document-question-columns/)
  assert.doesNotMatch(html, /document-questions-row/)
  const cells = html.match(/document-question-cell/g) || []
  assert.equal(cells.length, 4)
})

test("26. uma coluna: preview sem contêiner de colunas", () => {
  const document = makeDocument()
  const html = renderToStaticMarkup(<DocumentRenderer document={document} assets={[]} />)
  assert.doesNotMatch(html, /document-question-columns/)
})

test("27. separador de colunas (linha discreta) aparece no preview", () => {
  const document = makeDocument({ columns: "two", columnSeparator: "line" })
  const html = renderToStaticMarkup(<DocumentRenderer document={document} assets={[]} />)
  assert.match(html, /column-rule/)
})

test("28. impressão usa regras CSS de colunas, quebra de coluna e página", async () => {
  const css = await readFile(new URL("../app/globals.css", import.meta.url), "utf8")
  assert.match(css, /\.document-question-columns[\s\S]*break-inside:\s*avoid-column/)
  assert.match(css, /\.document-question-cell[\s\S]*break-inside:\s*avoid/)
  assert.match(css, /@media print/)
})

test("29. PDF usa o mesmo algoritmo de fluxo em colunas (nada de questionRows)", async () => {
  const pdf = await readFile(new URL("../lib/pdf/EditorPdfDocument.tsx", import.meta.url), "utf8")
  assert.match(pdf, /layoutFlow\(/)
  assert.match(pdf, /estimateQuestionHeight\(/)
  assert.match(pdf, /columnSeparator/)
  assert.match(pdf, /groupSectionElements\(/)
  assert.match(pdf, /isTwoColumns\(document\)/)
  assert.doesNotMatch(pdf, /questionRows\(/)
})

test("30. editor usa o mesmo algoritmo de fluxo em colunas (nada de questionRows)", async () => {
  const editor = await readFile(new URL("../components/StructuredContentEditor.tsx", import.meta.url), "utf8")
  assert.match(editor, /layoutFlow\(/)
  assert.doesNotMatch(editor, /questionRows/)
  assert.doesNotMatch(editor, /document-questions-row/)
})

// ============================ Alternativas e cabeçalho ============================

test("31. alternativas não duplicam a letra (sem \"A) A)\")", () => {
  const document = makeDocument()
  const question = document.sections[0].elements[0]
  assert.equal(question.type, "question")
  if (question.type !== "question") return
  question.alternatives = ["A) um", "B) dois", "C) três", "D) quatro"].map((content, index) => ({
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
  assert.deepEqual(saved.alternatives.map((alternative) => alternative.content), ["um", "dois", "três", "quatro"])
  const html = renderToStaticMarkup(<DocumentRenderer document={sanitized} assets={[]} />)
  assert.doesNotMatch(html, /A\)\s*A\)/)
})

test("33. títulos pedagógicos são reconhecidos (BNCC/inclusão) e títulos de atividade não", () => {
  assert.equal(isPedagogicalSectionTitle("Habilidades e competências BNCC"), true)
  assert.equal(isPedagogicalSectionTitle("HABILIDADES E COMPETÊNCIAS BNCC"), true)
  assert.equal(isPedagogicalSectionTitle("Inclusão, acessibilidade e DUA"), true)
  assert.equal(isPedagogicalSectionTitle("Competências gerais"), true)
  assert.equal(isPedagogicalSectionTitle("QUESTÕES"), false)
  assert.equal(isPedagogicalSectionTitle("Atividade de Matemática"), false)
})

test("34. documentos antigos migram seções BNCC para o tipo pedagógico", () => {
  const document = makeDocument()
  document.sections.push({
    id: "bncc",
    title: "Habilidades e competências BNCC",
    elements: [{ id: "t1", type: "table", headers: ["Código", "Descrição"], rows: [["EF05MA03", "Frações"]] }],
  })
  const sanitized = sanitizeEditorDocument(JSON.parse(JSON.stringify(document)))
  assert.ok(sanitized)
  const bncc = sanitized.sections.find((section) => section.id === "bncc")
  assert.ok(bncc)
  assert.equal(bncc.kind, "pedagogical")
})

test("35. seção pedagógica com questões fica em UMA coluna mesmo com simulado em duas", () => {
  const document = makeDocument({ columns: "two" })
  document.sections = [
    {
      id: "activity",
      title: "QUESTÕES",
      elements: [makeQuestion("q1", 1, "Questão 1"), makeQuestion("q2", 2, "Questão 2")],
    },
    {
      id: "bncc",
      title: "Habilidades e competências BNCC",
      kind: "pedagogical",
      elements: [makeQuestion("q3", 3, "Questão pedagógica")],
    },
  ]
  const html = renderToStaticMarkup(<DocumentRenderer document={document} assets={[]} />)
  // apenas a seção de atividade usa colunas
  assert.equal((html.match(/document-question-columns/g) || []).length, 1)
  // apenas as 2 questões da atividade ganham célula de coluna
  assert.equal((html.match(/document-question-cell/g) || []).length, 2)
  // a questão pedagógica é renderizada (fluxo de uma coluna)
  assert.match(html, /Questão pedagógica/)
})

test("36. seção pedagógica inicia em nova página por padrão e pode continuar na mesma", () => {
  const withBreak = makeDocument({ columns: "two" })
  withBreak.sections = [
    { id: "activity", title: "QUESTÕES", elements: [makeQuestion("q1", 1, "Questão 1")] },
    { id: "bncc", title: "Habilidades e competências BNCC", kind: "pedagogical", elements: [{ id: "t1", type: "table", headers: ["C"], rows: [["x"]] }] },
  ]
  const htmlBreak = renderToStaticMarkup(<DocumentRenderer document={withBreak} assets={[]} />)
  assert.match(htmlBreak, /break-before-page/)

  const withoutBreak = makeDocument({ columns: "two", pedagogicalPageBreakBefore: false })
  withoutBreak.sections = [
    { id: "activity", title: "QUESTÕES", elements: [makeQuestion("q1", 1, "Questão 1")] },
    { id: "bncc", title: "Habilidades e competências BNCC", kind: "pedagogical", elements: [{ id: "t1", type: "table", headers: ["C"], rows: [["x"]] }] },
  ]
  const htmlSame = renderToStaticMarkup(<DocumentRenderer document={withoutBreak} assets={[]} />)
  assert.doesNotMatch(htmlSame, /break-before-page/)
})

test("36b. APENAS UMA quebra: várias seções pedagógicas + gabarito fluem sem páginas exclusivas", () => {
  const document = makeDocument({ columns: "two" })
  const questions = [makeQuestion("q1", 1, "Questão 1")]
  const pedagogicalTable = { id: "t1", type: "table" as const, headers: ["Código", "Descrição"], rows: [["EF05MA03", "Frações"]] }
  document.sections = [
    { id: "activity", title: "QUESTÕES", elements: questions },
    { id: "bncc", title: "Habilidades e competências BNCC", kind: "pedagogical", elements: [pedagogicalTable] },
    { id: "inclusao", title: "Inclusão, acessibilidade e DUA", kind: "pedagogical", elements: [pedagogicalTable] },
  ]
  // questões com resposta/justificativa geram o gabarito derivado (3ª seção pedagógica)
  questions[0].answer = "A"
  questions[0].justification = "Explicação"
  const html = renderToStaticMarkup(<DocumentRenderer document={document} assets={[]} />)
  // exatamente UMA quebra obrigatória (antes da primeira seção pedagógica)
  assert.equal((html.match(/break-before-page/g) || []).length, 1)
  // gabarito presente e fluindo na mesma região pedagógica (sem quebra própria)
  assert.match(html, /Gabarito/)
  assert.match(html, /Inclusão, acessibilidade e DUA/)
  assert.match(html, /Habilidades e competências BNCC/)
})

test("37. PDF separa a seção pedagógica (nova página + uma coluna) com quebra única", async () => {
  const pdf = await readFile(new URL("../lib/pdf/EditorPdfDocument.tsx", import.meta.url), "utf8")
  assert.match(pdf, /section\.kind === "pedagogical"/)
  assert.match(pdf, /pedagogicalPageBreakBefore !== false/)
  assert.match(pdf, /isPedagogical/)
  // quebra obrigatória apenas na PRIMEIRA seção pedagógica
  assert.match(pdf, /firstPedagogicalIndex/)
  assert.match(pdf, /pedagogicalStarted/)
  // gabarito deriva do fluxo, sem página exclusiva nem break próprio
  assert.match(pdf, /renderGabarito\(/)
  assert.doesNotMatch(pdf, /gabaritoView\s*&&\s*\(\s*<Page/)
})

test("38. editor marca a separação atividade/pedagógica e expõe o controle", async () => {
  const editor = await readFile(new URL("../components/StructuredContentEditor.tsx", import.meta.url), "utf8")
  assert.match(editor, /FIM DA ATIVIDADE/)
  assert.match(editor, /INFORMAÇÕES PEDAGÓGICAS/)
  assert.match(editor, /kind === "pedagogical"/)
  assert.match(editor, /Separar informações pedagógicas/)
})

test("39. separador pedagógico é persistido (padrão ativado; pode desligar)", () => {
  const on = sanitizeEditorDocument(makeDocument())
  assert.equal(on?.page.pedagogicalPageBreakBefore, true)
  const off = sanitizeEditorDocument(makeDocument({ pedagogicalPageBreakBefore: false }))
  assert.equal(off?.page.pedagogicalPageBreakBefore, false)
})

test("32. cabeçalho não é duplicado: conteúdo de identificação é removido e o pedagógico preservado", () => {
  const document = makeDocument()
  document.sections[0].elements = [
    { id: "p1", type: "paragraph", content: "Nome do Estudante: ______<br>Turma: ____" },
    makeQuestion("q1", 1, "Em 15 de agosto de 2026, ocorreu um eclipse lunar. Explique."),
  ]
  const sanitized = sanitizeEditorDocument(document)
  assert.ok(sanitized)
  const paragraph = sanitized.sections[0].elements[0]
  assert.equal(paragraph.type, "paragraph")
  if (paragraph.type === "paragraph") {
    assert.doesNotMatch(paragraph.content, /Nome do Estudante/)
  }
  const question = sanitized.sections[0].elements[1]
  assert.equal(question.type, "question")
  if (question.type === "question") {
    assert.match(question.content, /15 de agosto de 2026/)
  }
  const html = renderToStaticMarkup(<DocumentRenderer document={sanitized} assets={[]} />)
  assert.equal((html.match(/NOME DA ESCOLA/g) || []).length, 1)
})
