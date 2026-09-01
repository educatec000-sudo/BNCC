import assert from "node:assert/strict"
import test from "node:test"
import {
  isIdentificationFieldSegment,
  isIdentificationFillLine,
  stripIdentificationLines,
  stripIdentificationLinesFromHtml,
} from "../lib/identification"
import { normalizePlanningContent, type PlanningContent } from "../lib/planning-content"
import { buildPlanningDocumentModel } from "../lib/document-model"

// ---------------------------------------------------------------------------
// 1) Detecção de campos de identificação
// ---------------------------------------------------------------------------

test("detecta campos de identificação com preenchimento", () => {
  const detected = [
    "Nome do Estudante: __________________",
    "Nome do aluno: ______",
    "Aluno(a): ____",
    "Turma: ________",
    "Data: ____",
    "Professor(a): ________",
    "Nome da Escola: ________",
    "Escola: ____",
    "Série/Ano: ____",
    "Disciplina: ____",
    "Assunto: ____",
  ]
  for (const line of detected) {
    assert.equal(isIdentificationFillLine(line), true, `deveria detectar: "${line}"`)
  }
})

test("detecta linha com vários campos juntos (legado)", () => {
  assert.equal(isIdentificationFillLine("Nome: ______    Turma: ______    Data: ______"), true)
  assert.equal(isIdentificationFieldSegment("Nome: ______"), true)
  assert.equal(isIdentificationFieldSegment("Turma:"), true)
})

test("NÃO remove conteúdo pedagógico", () => {
  const preserved = [
    "Em 15 de agosto de 2026, ocorreu um eclipse solar.",
    "Data: 15/08/2026",
    "A bola é redonda",
    "Turma: 5º Ano",
    "1,0 x 10^-3 N",
    "F = q · v · B",
    "Qual a data da independência?",
  ]
  for (const line of preserved) {
    assert.equal(isIdentificationFillLine(line), false, `não deveria detectar: "${line}"`)
  }
})

test("stripIdentificationLines remove só as linhas de formulário", () => {
  const text = [
    "Instruções: responda com atenção.",
    "Nome do Estudante: ______",
    "Turma: ____",
    "Em 15 de agosto de 2026, ocorreu um eclipse.",
    "1. Resolva a questão.",
  ].join("\n")
  const result = stripIdentificationLines(text)
  assert.ok(result.includes("Instruções: responda com atenção."))
  assert.ok(result.includes("Em 15 de agosto de 2026, ocorreu um eclipse."))
  assert.ok(result.includes("1. Resolva a questão."))
  assert.ok(!result.includes("Nome do Estudante"))
  assert.ok(!result.includes("Turma:"))
})

test("stripIdentificationLinesFromHtml remove de HTML e preserva fórmulas", () => {
  const html = "Nome do Estudante: ______<br>Turma: ____<br>F = q · v · B<br>Alternativa A: 1,0 x 10^-3 N"
  const result = stripIdentificationLinesFromHtml(html)
  assert.ok(!result.includes("Nome do Estudante"))
  assert.ok(!result.includes("Turma:"))
  assert.ok(result.includes("F = q · v · B"))
  assert.ok(result.includes("1,0 x 10^-3 N"))
})

// ---------------------------------------------------------------------------
// 2) Normalização do conteúdo gerado pela IA
// ---------------------------------------------------------------------------

const inclusion = {
  contexto: "Contexto.",
  principiosDua: { representacao: [], acaoExpressao: [], engajamento: [] },
  estrategias: [],
  adaptacoes: [],
  recursos: [],
  participacao: "",
  avaliacaoAdaptada: [],
  criteriosAvaliacao: [],
}

function baseContent(materialType: "activity" | "assessment"): PlanningContent {
  const common = {
    materialType,
    metadata: {
      titulo: "Atividade de Física",
      etapaEnsino: "Ensino Médio",
      area: "Física",
      serieAno: "3º Ano",
      tipoPlanejamento: "Atividade",
      assunto: "Eletromagnetismo",
      pedidoProfessor: "Atividade sobre eletromagnetismo.",
    },
    habilidadesBncc: [],
    competenciasGerais: [],
    visualResources: [],
    inclusaoAcessibilidade: inclusion,
  }
  if (materialType === "activity") {
    return {
      ...common,
      materialType: "activity",
      titulo: "Atividade de Física",
      instrucoes: "Responda com atenção.",
      camposIdentificacao: ["Nome", "Turma", "Data"],
      quantidadeQuestoes: 2,
      questoes: [
        { numero: 1, enunciado: "Uma carga q = 2,0 x 10^-6 C.", tipo: "aberta", alternativas: ["A) 1,0", "B) 4,0"], resposta: "B)", explicacao: "F = q·v·B" },
        { numero: 2, enunciado: "O que é indução?", tipo: "aberta", alternativas: [], resposta: "Indução é...", explicacao: "..." },
      ],
      gabarito: [
        { numero: 1, resposta: "B)", explicacao: "F = q·v·B" },
        { numero: 2, resposta: "Indução é...", explicacao: "..." },
      ],
    } as PlanningContent
  }
  return {
    ...common,
    materialType: "assessment",
    titulo: "Avaliação de Física",
    tipoAvaliacao: "Avaliação formativa",
    instrucoes: "Responda com atenção.",
    camposIdentificacao: ["Nome", "Turma", "Data"],
    criteriosGerais: [],
    quantidadeQuestoes: 2,
    questoes: [
      { numero: 1, enunciado: "Uma carga q = 2,0 x 10^-6 C.", tipo: "aberta", alternativas: ["A) 1,0", "B) 4,0"], resposta: "B)", explicacao: "F = q·v·B" },
      { numero: 2, enunciado: "O que é indução?", tipo: "aberta", alternativas: [], resposta: "Indução é...", explicacao: "..." },
    ],
    gabarito: [
      { numero: 1, resposta: "B)", criterio: "F = q·v·B" },
      { numero: 2, resposta: "Indução é...", criterio: "..." },
    ],
    rubrica: [],
  } as PlanningContent
}

test("normalizePlanningContent zera camposIdentificacao e limpa instruções", () => {
  const content = baseContent("activity")
  if (content.materialType !== "activity") return
  content.instrucoes = "Nome do Estudante: ______\nTurma: ____\nData: ____\nResponda com atenção.\nEm 15 de agosto de 2026, ocorreu um eclipse."
  const normalized = normalizePlanningContent(content)
  if (normalized.materialType !== "activity") return
  assert.deepEqual(normalized.camposIdentificacao, [])
  assert.ok(!normalized.instrucoes.includes("Nome do Estudante"))
  assert.ok(!normalized.instrucoes.includes("Turma:"))
  assert.ok(!normalized.instrucoes.includes("Data:"))
  assert.ok(normalized.instrucoes.includes("Responda com atenção."))
  assert.ok(normalized.instrucoes.includes("Em 15 de agosto de 2026, ocorreu um eclipse."))
})

test("normalizePlanningContent limpa enunciados de questões", () => {
  const content = baseContent("assessment")
  if (content.materialType !== "assessment") return
  content.questoes[0].enunciado = "Nome do Estudante: ____\nUma carga q = 2,0 x 10^-6 C."
  const normalized = normalizePlanningContent(content)
  if (normalized.materialType !== "assessment") return
  assert.ok(!normalized.questoes[0].enunciado.includes("Nome do Estudante"))
  assert.ok(normalized.questoes[0].enunciado.includes("Uma carga q = 2,0 x 10^-6 C."))
})

// ---------------------------------------------------------------------------
// 3) Fluxo completo: 5 atividades simuladas sem segundo cabeçalho
// ---------------------------------------------------------------------------

const ID_TERMS = ["Nome do Estudante", "Nome do aluno", "Aluno(a)", "Turma:", "Data:", "Professor(a)", "Nome da Escola", "Escola:"]

function assertNoSecondHeader(blockTexts: string[], label: string) {
  for (const text of blockTexts) {
    for (const term of ID_TERMS) {
      assert.ok(!text.includes(term), `${label}: termo "${term}" vazou para o conteúdo: "${text.slice(0, 80)}"`)
    }
  }
}

const variants: { name: string; mutate: (c: PlanningContent) => void }[] = [
  { name: "1. atividade com camposIdentificacao", mutate: (c) => { if (c.materialType === "activity") c.camposIdentificacao = ["Nome", "Turma", "Data"] } },
  { name: "2. atividade com formulário nas instruções", mutate: (c) => { if (c.materialType === "activity") c.instrucoes = "Nome do Estudante: ____\nTurma: ____\nData: ____\nResponda." } },
  { name: "3. avaliação com campos + instruções", mutate: (c) => { if (c.materialType === "assessment") { c.camposIdentificacao = ["Nome", "Turma", "Data"]; c.instrucoes = "Escola: ____\nProfessor(a): ____\nResponda." } } },
  { name: "4. atividade com formulário no enunciado", mutate: (c) => { if (c.materialType === "activity") c.questoes[0].enunciado = "Nome do Estudante: ____\nUma carga q = 2,0 x 10^-6 C." } },
  { name: "5. atividade limpa (controle)", mutate: () => {} },
]

for (const variant of variants) {
  test(`fluxo: ${variant.name} não gera segundo cabeçalho`, () => {
    const content = baseContent(variant.name.startsWith("3") ? "assessment" : "activity")
    variant.mutate(content)
    const normalized = normalizePlanningContent(content)
    const model = buildPlanningDocumentModel({
      title: "Atividade de Física",
      topic: "Eletromagnetismo",
      educationStage: "Ensino Médio",
      subject: "Física",
      grade: "3º Ano",
      planningType: "Atividade",
      request: "Atividade sobre eletromagnetismo.",
      content: normalized,
      images: [],
    })

    // Blocos de conteúdo não podem conter campos de identificação.
    const blockTexts = model.sections.flatMap((section) =>
      section.blocks.flatMap((block) => {
        if (block.type === "paragraph") return [block.text]
        if (block.type === "questions") return block.questions.map((q) => q.enunciado)
        return []
      }),
    )
    assertNoSecondHeader(blockTexts, variant.name)

    // Questões preservam o conteúdo pedagógico e as fórmulas.
    const questionsBlock = model.sections.flatMap((s) => s.blocks).find((b) => b.type === "questions")
    assert.ok(questionsBlock, "bloco de questões ausente")
    if (questionsBlock && questionsBlock.type === "questions") {
      const hasPhysics = questionsBlock.questions.some((q) => q.enunciado.includes("q = 2,0 x 10^-6 C"))
      assert.ok(hasPhysics, "enunciado de física foi perdido")
    }
  })
}

test("instruções pedagógicas permanecem após normalização", () => {
  const content = baseContent("activity")
  if (content.materialType !== "activity") return
  content.instrucoes = "Leia o texto e responda. Em 15 de agosto de 2026, ocorreu um eclipse solar."
  const normalized = normalizePlanningContent(content)
  if (normalized.materialType !== "activity") return
  assert.ok(normalized.instrucoes.includes("Em 15 de agosto de 2026, ocorreu um eclipse solar."))
})

// ---------------------------------------------------------------------------
// 4) Título duplicado: o título vive UMA vez, no cabeçalho
// ---------------------------------------------------------------------------

test("atividade/avaliação não usam o título como título de seção (sem título duplicado)", () => {
  for (const type of ["activity", "assessment"] as const) {
    const content = baseContent(type)
    if (content.materialType === "activity") {
      // A IA devolve o MESMO título em metadata.titulo e em titulo (duplicação clássica).
      content.titulo = content.metadata.titulo
    }
    const normalized = normalizePlanningContent(content)
    const model = buildPlanningDocumentModel({
      title: normalized.metadata.titulo,
      topic: "Eletromagnetismo",
      educationStage: "Ensino Médio",
      subject: "Física",
      grade: "3º Ano",
      planningType: type === "activity" ? "Atividade" : "Avaliação",
      request: "Atividade sobre eletromagnetismo.",
      content: normalized,
      images: [],
    })

    // A seção de conteúdo NÃO repete o título (que está no cabeçalho do documento).
    const contentSection = model.sections.find((section) =>
      section.blocks.some((block) => block.type === "questions"),
    )
    assert.ok(contentSection, `${type}: seção de questões ausente`)
    assert.equal(contentSection.title, "", `${type}: título duplicado na seção de conteúdo`)
    assert.equal(model.title, "Atividade de Física", `${type}: título do cabeçalho deve ser preservado`)
    // Instruções preservadas dentro do conteúdo.
    const paragraph = contentSection.blocks.find((block) => block.type === "paragraph")
    assert.ok(paragraph && paragraph.type === "paragraph" && paragraph.text.includes("Responda com atenção."))
  }
})

test("normalizePlanningContent remove título duplicado do início das instruções", () => {
  const content = baseContent("activity")
  if (content.materialType !== "activity") return
  content.titulo = "Atividade de Física"
  content.instrucoes = "Atividade de Física\n\nResponda com atenção.\nResolva as questões abaixo."
  const normalized = normalizePlanningContent(content)
  if (normalized.materialType !== "activity") return
  assert.ok(!normalized.instrucoes.startsWith("Atividade de Física"))
  assert.ok(normalized.instrucoes.includes("Responda com atenção."))
  assert.ok(normalized.instrucoes.includes("Resolva as questões abaixo."))
})

test("normalizePlanningContent NÃO remove título legítimo no meio do texto", () => {
  const content = baseContent("activity")
  if (content.materialType !== "activity") return
  content.titulo = "Atividade de Física"
  content.instrucoes = "Leia com atenção.\nO título da atividade é Atividade de Física e ele orienta o estudo."
  const normalized = normalizePlanningContent(content)
  if (normalized.materialType !== "activity") return
  assert.ok(normalized.instrucoes.includes("Atividade de Física"))
})
