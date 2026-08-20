import assert from "node:assert/strict"
import test from "node:test"
import {
  analyzePlanningRequest,
  buildMaterialJsonSchema,
  validatePlanningContentForRequest,
  requiresTopic,
} from "../lib/planning-templates"

const cases = [
  ["atividade", "Crie 10 questões de Matemática sobre frações.", "activity", 10],
  ["atividade", "Crie uma atividade de Português com 5 questões.", "activity", 5],
  ["avaliacao", "Crie uma avaliação com 10 questões.", "assessment", 10],
  ["sequencia-didatica", "Crie uma sequência didática de 5 aulas.", "didactic_sequence", 5],
  ["planejamento-semanal", "Faça um planejamento para segunda a sexta.", "weekly_plan", 5],
  ["planejamento-mensal", "Faça um planejamento mensal de Matemática.", "monthly_plan", 4],
  ["projeto-pedagogico", "Crie um projeto interdisciplinar sobre meio ambiente.", "pedagogical_project", 4],
  ["plano-aula", "Crie um plano de aula sobre frações.", "lesson_plan", null],
] as const

for (const [type, request, expectedType, expectedCount] of cases) {
  test(`${type}: identifica estrutura e quantidade para “${request}”`, () => {
    const analysis = analyzePlanningRequest(type, request)
    assert.equal(analysis.materialType, expectedType)
    assert.equal(analysis.expectedCount, expectedCount)
    assert.equal(analysis.quantityValid, true)
  })
}

test("schema de atividade exige questões e não contém metodologia de plano de aula", () => {
  const analysis = analyzePlanningRequest("atividade", "Crie 10 questões sobre frações")
  const schema = buildMaterialJsonSchema(analysis) as {
    properties: Record<string, { minItems?: number; maxItems?: number }>
  }

  assert.ok(schema.properties.questoes)
  assert.equal(schema.properties.questoes.minItems, 10)
  assert.equal(schema.properties.questoes.maxItems, 10)
  assert.equal("metodologia" in schema.properties, false)
  assert.equal("desenvolvimento" in schema.properties, false)
})

test("schema de avaliação é diferente do schema de atividade e de plano de aula", () => {
  const schema = buildMaterialJsonSchema(
    analyzePlanningRequest("avaliacao", "Crie uma avaliação diagnóstica com 10 questões"),
  ) as { properties: Record<string, unknown> }

  assert.ok(schema.properties.tipoAvaliacao)
  assert.ok(schema.properties.criteriosGerais)
  assert.ok(schema.properties.rubrica)
  assert.equal("metodologia" in schema.properties, false)
})

test("schema semanal exige exatamente cinco dias", () => {
  const schema = buildMaterialJsonSchema(
    analyzePlanningRequest("planejamento-semanal", "Planejamento de segunda a sexta"),
  ) as { properties: { dias: { minItems: number; maxItems: number } } }

  assert.equal(schema.properties.dias.minItems, 5)
  assert.equal(schema.properties.dias.maxItems, 5)
})

test("validação rejeita atividade com quantidade diferente da solicitada", () => {
  const analysis = analyzePlanningRequest("atividade", "Crie 10 questões sobre frações")
  const invalid = {
    materialType: "activity",
    metadata: {
      titulo: "Atividade de frações",
      etapaEnsino: "Ensino Fundamental I",
      area: "Matemática",
      serieAno: "4º Ano",
      tipoPlanejamento: "Atividade",
      assunto: "Frações",
      pedidoProfessor: "10 questões sobre frações",
    },
    habilidadesBncc: [],
    competenciasGerais: [],
    visualResources: [],
    inclusaoAcessibilidade: {},
    titulo: "Atividade de frações",
    instrucoes: "Resolva.",
    camposIdentificacao: ["Nome", "Turma", "Data"],
    quantidadeQuestoes: 8,
    questoes: Array.from({ length: 8 }, (_, index) => ({
      numero: index + 1,
      enunciado: `Questão ${index + 1}`,
      tipo: "aberta",
      alternativas: [],
      resposta: "Resposta",
      explicacao: "Explicação",
    })),
    gabarito: Array.from({ length: 8 }, (_, index) => ({
      numero: index + 1,
      resposta: "Resposta",
      explicacao: "Explicação",
    })),
  }

  const result = validatePlanningContentForRequest(invalid, analysis)
  assert.equal(result.valid, false)
})

test("assunto é obrigatório para materiais pedagógicos e opcional apenas em Outro", () => {
  assert.equal(requiresTopic("plano-aula"), true)
  assert.equal(requiresTopic("atividade"), true)
  assert.equal(requiresTopic("avaliacao"), true)
  assert.equal(requiresTopic("outro"), false)
})

test("quantidades abusivas são rejeitadas antes da chamada à IA", () => {
  const analysis = analyzePlanningRequest("atividade", "Crie 100 questões")
  assert.equal(analysis.quantityValid, false)
})
