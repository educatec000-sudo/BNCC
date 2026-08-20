import assert from "node:assert/strict"
import test from "node:test"
import { buildEducationalImagePrompt } from "../lib/images/prompt"
import { imageModeLimit, isImageMode, isImageStyle } from "../lib/image-options"
import { analyzePlanningRequest, buildMaterialJsonSchema } from "../lib/planning-templates"
import { getDailyImageLimit, getImageUsageLimits } from "../lib/plans-core"

test("usa o modelo visual com opções validadas", () => {
  assert.equal(isImageMode("WHEN_NEEDED"), true)
  assert.equal(isImageMode("unlimited"), false)
  assert.equal(isImageStyle("COLORING_PAGE"), true)
  assert.equal(isImageStyle("random"), false)
})

test("limita imagens automáticas conforme o modo", () => {
  assert.equal(imageModeLimit("NONE"), 0)
  assert.equal(imageModeLimit("WHEN_NEEDED"), 2)
  assert.equal(imageModeLimit("USEFUL"), 3)
  assert.equal(imageModeLimit("WHEN_POSSIBLE"), 4)
})

test("prompt de desenho para colorir exige contornos e ausência de sombras", () => {
  const prompt = buildEducationalImagePrompt({
    basePrompt: "Onça, arara e macaco na floresta amazônica",
    topic: "Animais da Amazônia",
    educationStage: "Ensino Fundamental I",
    grade: "2º Ano",
    style: "COLORING_PAGE",
    coloringPage: true,
    accessible: false,
    inclusionNeeds: [],
    pedagogicalPurpose: "Atividade para colorir e reconhecer animais",
  })
  for (const expected of ["preto e branco", "fundo branco", "contornos grossos", "sem sombras"]) {
    assert.ok(prompt.includes(expected))
  }
})

test("prompt EJA evita visual infantilizado", () => {
  const prompt = buildEducationalImagePrompt({
    basePrompt: "Situação cotidiana de compras no mercado",
    topic: "Porcentagem",
    educationStage: "EJA",
    grade: "EJA — Etapa 2",
    style: "EDUCATIONAL",
    coloringPage: false,
    accessible: false,
    inclusionNeeds: [],
    pedagogicalPurpose: "Contextualizar cálculo percentual",
  })
  assert.ok(prompt.includes("não infantilizar"))
  assert.ok(prompt.includes("aparência madura"))
})

test("prompt acessível pede composição simples e alto contraste", () => {
  const prompt = buildEducationalImagePrompt({
    basePrompt: "Diagrama do Sistema Solar",
    topic: "Sistema Solar",
    educationStage: "Ensino Fundamental I",
    grade: "5º Ano",
    style: "ACCESSIBLE_INCLUSIVE",
    coloringPage: false,
    accessible: true,
    inclusionNeeds: ["Baixa Visão"],
    pedagogicalPurpose: "Comparar tamanhos e órbitas",
  })
  assert.ok(prompt.includes("contraste alto"))
  assert.ok(prompt.includes("poucos elementos"))
  assert.ok(prompt.includes("Baixa Visão"))
})

test("limites de imagem por plano e diário são configuráveis", () => {
  process.env.FREE_IMAGE_TOTAL_LIMIT = "2"
  process.env.PROFESSOR_MONTHLY_IMAGE_LIMIT = "20"
  process.env.PREMIUM_MONTHLY_IMAGE_LIMIT = "60"
  process.env.DAILY_IMAGE_LIMIT_PER_USER = "10"
  assert.deepEqual(getImageUsageLimits(), { free: 2, professor: 20, premium: 60 })
  assert.equal(getDailyImageLimit(), 10)
})

test("schema textual prepara recursos visuais vinculados", () => {
  const schema = buildMaterialJsonSchema(
    analyzePlanningRequest("atividade", "Crie 10 questões de Ciências sobre animais"),
  ) as { properties: Record<string, unknown>; required: string[] }
  assert.ok(schema.properties.visualResources)
  assert.ok(schema.required.includes("visualResources"))
})
