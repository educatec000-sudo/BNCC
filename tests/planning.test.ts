import assert from "node:assert/strict"
import test from "node:test"
import {
  EDUCATION_STAGES,
  PLANNING_TYPES,
  findPlanningSelectionIds,
  resolvePlanningSelection,
} from "../lib/planning-options"
import { buildBnccPrompt } from "../lib/prompt"

test("todas as etapas possuem áreas e séries próprias", () => {
  assert.equal(EDUCATION_STAGES.length, 7)
  for (const stage of EDUCATION_STAGES) {
    assert.ok(stage.areas.length > 0, `${stage.label} sem áreas`)
    assert.ok(stage.grades.length > 0, `${stage.label} sem séries`)
  }
})

test("não aceita área incompatível com a etapa", () => {
  assert.equal(
    resolvePlanningSelection({
      stageId: "educacao-infantil",
      areaId: "fisica",
      gradeId: "criancas-pequenas",
      planningTypeId: "plano-aula",
    }),
    null,
  )
})

test("resolve uma seleção válida com os rótulos usados pela IA e pelo banco", () => {
  const selection = resolvePlanningSelection({
    stageId: "fundamental-i",
    areaId: "ciencias",
    gradeId: "3-ano-fundamental",
    planningTypeId: "sequencia-didatica",
  })

  assert.equal(selection?.stageLabel, "Ensino Fundamental I")
  assert.equal(selection?.areaLabel, "Ciências")
  assert.equal(selection?.gradeLabel, "3º Ano")
  assert.equal(selection?.planningTypeLabel, "Sequência didática")
})

test("reaproveita planejamentos legados ao abrir o modo de edição", () => {
  const selection = findPlanningSelectionIds({
    stage: "Não informado",
    area: "Ciências",
    grade: "5º ano - Ensino Fundamental",
    planningType: "Plano de aula",
  })

  assert.equal(selection?.stageId, "fundamental-i")
  assert.equal(selection?.areaId, "ciencias")
  assert.equal(selection?.gradeId, "5-ano-fundamental")
})

test("tipos de planejamento permanecem centralizados e configuráveis", () => {
  assert.equal(PLANNING_TYPES.length, 9)
  assert.ok(PLANNING_TYPES.some((item) => item.id === "avaliacao"))
  assert.ok(PLANNING_TYPES.some((item) => item.id === "outro"))
})

test("prompt envia todo o contexto selecionado para a IA", () => {
  const prompt = buildBnccPrompt({
    educationStage: "Ensino Fundamental I",
    area: "Ciências",
    grade: "3º Ano",
    planningType: "Plano de aula",
    topic: "Meio ambiente e reciclagem",
    request: "Crie uma aula prática sobre meio ambiente.",
    additionalPreferences: "Usar materiais recicláveis.",
  })

  for (const expected of [
    "Ensino Fundamental I",
    "Ciências",
    "3º Ano",
    "Plano de aula",
    "Meio ambiente e reciclagem",
    "Crie uma aula prática sobre meio ambiente.",
    "Usar materiais recicláveis.",
    "habilidades e competências",
  ]) {
    assert.ok(prompt.includes(expected), `Prompt sem: ${expected}`)
  }
})
