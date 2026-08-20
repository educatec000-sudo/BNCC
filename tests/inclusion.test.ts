import assert from "node:assert/strict"
import test from "node:test"
import {
  ACCESSIBILITY_RESOURCE_GROUPS,
  INCLUSION_MODES,
  INCLUSION_NEEDS,
  allAccessibilityResources,
  resolveNeedLabels,
  resolveResourceLabels,
  sanitizePedagogicalProfile,
} from "../lib/inclusion-options"
import { buildBnccPrompt } from "../lib/prompt"

test("oferece três modalidades de inclusão e todas as necessidades solicitadas", () => {
  assert.deepEqual(
    INCLUSION_MODES.map((item) => item.id),
    ["REGULAR", "INCLUSIVE_CLASS", "INDIVIDUALIZED"],
  )
  assert.equal(INCLUSION_NEEDS.length, 10)
  assert.ok(INCLUSION_NEEDS.some((item) => item.id === "autism"))
  assert.ok(INCLUSION_NEEDS.some((item) => item.id === "gifted"))
})

test("recursos de acessibilidade possuem IDs únicos", () => {
  const resources = allAccessibilityResources()
  assert.ok(ACCESSIBILITY_RESOURCE_GROUPS.length >= 6)
  assert.equal(new Set(resources.map((item) => item.id)).size, resources.length)
})

test("rejeita necessidades e recursos inventados enviados diretamente à API", () => {
  assert.equal(resolveNeedLabels(["autism", "invented"]), null)
  assert.equal(resolveResourceLabels(["visual-routine", "invented"]), null)
})

test("sanitiza perfil pedagógico e ignora campos pessoais desconhecidos", () => {
  const profile = sanitizePedagogicalProfile({
    strengths: "Boa participação oral",
    observations: "Responde bem a rotinas visuais",
    studentName: "Dado que não deve ser armazenado neste perfil",
  })

  assert.equal(profile?.strengths, "Boa participação oral")
  assert.equal(profile?.observations, "Responde bem a rotinas visuais")
  assert.equal("studentName" in (profile || {}), false)
})

test("prompt inclusivo recebe DUA, recursos, perfil e preservação do original", () => {
  const prompt = buildBnccPrompt({
    educationStage: "Ensino Fundamental I",
    area: "Ciências",
    grade: "3º Ano",
    planningType: "Atividade",
    request: "Explorar meio ambiente com materiais concretos.",
    inclusionMode: "Turma com necessidades específicas",
    inclusionNeeds: ["Transtorno do Espectro Autista (TEA)"],
    accessibilityResources: ["Rotina visual", "Instruções objetivas"],
    pedagogicalProfile: { interests: "Natureza" },
    originalPlanning: { tema: "Meio ambiente" },
  })

  for (const expected of [
    "Desenho Universal para a Aprendizagem",
    "Transtorno do Espectro Autista",
    "Rotina visual",
    "Natureza",
    "planejamentoOriginalParaAdaptacao",
    "não diagnosticar",
    "inclusao",
  ]) {
    assert.ok(prompt.includes(expected), `Prompt sem ${expected}`)
  }
})
