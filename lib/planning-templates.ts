import type { PlanningContent, MaterialType } from "@/lib/planning-content"
import { isPlanningContent } from "@/lib/planning-content"

export interface RequestAnalysis {
  materialType: MaterialType
  requestedQuantity: number | null
  expectedCount: number | null
  quantityUnit: "questoes" | "aulas" | "semanas" | "etapas" | "unidades" | "itens" | null
  difficulty: string
  outputFormat: string
  theme: string
  quantityValid: boolean
}

const TYPE_TO_MATERIAL: Record<string, MaterialType> = {
  "plano-aula": "lesson_plan",
  "sequencia-didatica": "didactic_sequence",
  "planejamento-semanal": "weekly_plan",
  "planejamento-mensal": "monthly_plan",
  "projeto-pedagogico": "pedagogical_project",
  atividade: "activity",
  avaliacao: "assessment",
  "plano-ensino": "teaching_plan",
  outro: "other",
}

export const MATERIAL_INSTRUCTIONS: Record<MaterialType, string> = {
  lesson_plan:
    "Produza exclusivamente um PLANO DE AULA: tema, duração, objetivos, conteúdos, metodologia, recursos, desenvolvimento, atividades, avaliação e referências.",
  didactic_sequence:
    "Produza exclusivamente uma SEQUÊNCIA DIDÁTICA composta por várias aulas articuladas. Cada aula deve avançar em relação à anterior e possuir objetivos, conteúdos, atividades, recursos, avaliação e duração próprios.",
  weekly_plan:
    "Produza exclusivamente um PLANEJAMENTO SEMANAL organizado de segunda a sexta-feira. Cada dia deve possuir objetivos, conteúdos, atividades, recursos e avaliação. Não use formato de plano de aula único.",
  monthly_plan:
    "Produza exclusivamente um PLANEJAMENTO MENSAL com objetivos do mês, conteúdos, organização por semanas, atividades, projetos, recursos e avaliação mensal.",
  pedagogical_project:
    "Produza exclusivamente um PROJETO PEDAGÓGICO completo, preferencialmente interdisciplinar: justificativa, problema, objetivos, público, áreas, metodologia, etapas, cronograma, recursos, avaliação e produto final.",
  activity:
    "Produza exclusivamente uma ATIVIDADE pronta para o estudante: instruções, questões numeradas e gabarito. Não inclua metodologia, desenvolvimento ou plano de aula. NÃO inclua título, cabeçalho nem campos de identificação (nome do estudante, turma, data, escola, professor): o título e o cabeçalho já existem na aplicação e pertencem ao cabeçalho, não ao conteúdo.",
  assessment:
    "Produza exclusivamente um INSTRUMENTO AVALIATIVO (prova, avaliação diagnóstica, formativa, somativa, rubrica ou checklist conforme o pedido), com questões/itens, critérios e gabarito. Não produza plano de aula. NÃO inclua título, cabeçalho nem campos de identificação: o título e o cabeçalho já existem na aplicação.",
  teaching_plan:
    "Produza exclusivamente um PLANO DE ENSINO de longo prazo, organizado por período letivo e unidades, com ementa, objetivos, conteúdos, metodologia, recursos e avaliação.",
  other:
    "Interprete o material solicitado e produza exatamente esse formato. Não force plano de aula. Organize o resultado em seções adequadas ao pedido.",
}

function extractNumber(request: string, terms: string[]): number | null {
  const joined = terms.join("|")
  const before = new RegExp(`(\\d{1,3})\\s*(?:${joined})`, "i").exec(request)
  if (before) return Number(before[1])
  const after = new RegExp(`(?:${joined})\\s*(?:de|com|em)?\\s*(\\d{1,3})`, "i").exec(request)
  return after ? Number(after[1]) : null
}

function extractTheme(request: string): string {
  const match = /(?:sobre|tema|a respeito de)\s+([^,.!?]+)/i.exec(request)
  return (match?.[1] || request).trim().slice(0, 120)
}

export function materialTypeFromPlanningTypeId(planningTypeId: string): MaterialType | null {
  return TYPE_TO_MATERIAL[planningTypeId] || null
}

export function requiresTopic(planningTypeId: string): boolean {
  return planningTypeId !== "outro"
}

export function planningTypeIdFromLabel(label: string): string | null {
  const normalized = label
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
  const entries: [string, string[]][] = [
    ["plano-aula", ["plano de aula"]],
    ["sequencia-didatica", ["sequencia didatica"]],
    ["planejamento-semanal", ["planejamento semanal"]],
    ["planejamento-mensal", ["planejamento mensal"]],
    ["projeto-pedagogico", ["projeto pedagogico"]],
    ["atividade", ["atividade"]],
    ["avaliacao", ["avaliacao"]],
    ["plano-ensino", ["plano de ensino"]],
    ["outro", ["outro"]],
  ]
  return entries.find(([, aliases]) => aliases.includes(normalized))?.[0] || null
}

export function analyzePlanningRequest(
  planningTypeId: string,
  request: string,
): RequestAnalysis {
  const materialType = materialTypeFromPlanningTypeId(planningTypeId) || "other"
  let requestedQuantity: number | null = null
  let expectedCount: number | null = null
  let quantityUnit: RequestAnalysis["quantityUnit"] = null

  if (materialType === "activity" || materialType === "assessment") {
    requestedQuantity = extractNumber(request, ["quest(?:ão|oes|ões)", "itens?", "exerc[ií]cios?"])
    expectedCount = requestedQuantity || 10
    quantityUnit = "questoes"
  } else if (materialType === "didactic_sequence") {
    requestedQuantity = extractNumber(request, ["aulas?", "encontros?"])
    expectedCount = requestedQuantity || 3
    quantityUnit = "aulas"
  } else if (materialType === "weekly_plan") {
    requestedQuantity = 5
    expectedCount = 5
    quantityUnit = "itens"
  } else if (materialType === "monthly_plan") {
    requestedQuantity = extractNumber(request, ["semanas?"])
    expectedCount = requestedQuantity || 4
    quantityUnit = "semanas"
  } else if (materialType === "pedagogical_project") {
    requestedQuantity = extractNumber(request, ["etapas?", "fases?"])
    expectedCount = requestedQuantity || 4
    quantityUnit = "etapas"
  } else if (materialType === "teaching_plan") {
    requestedQuantity = extractNumber(request, ["unidades?", "bimestres?", "trimestres?"])
    expectedCount = requestedQuantity || 4
    quantityUnit = "unidades"
  } else if (materialType === "other") {
    requestedQuantity = extractNumber(request, ["itens?", "t[oó]picos?", "partes?"])
    expectedCount = requestedQuantity
    quantityUnit = requestedQuantity ? "itens" : null
  }

  const lower = request.toLowerCase()
  const difficulty = /avan[cç]ad|dif[ií]cil|desafiador/.test(lower)
    ? "avançado"
    : /f[aá]cil|b[aá]sico|simples/.test(lower)
      ? "básico"
      : /intermedi[aá]ri/.test(lower)
        ? "intermediário"
        : "adequado à série/ano"

  const outputFormat =
    materialType === "assessment"
      ? /diagn[oó]stic/.test(lower)
        ? "avaliação diagnóstica"
        : /formativ/.test(lower)
          ? "avaliação formativa"
          : /somativ/.test(lower)
            ? "avaliação somativa"
            : /rubrica/.test(lower)
              ? "rubrica"
              : /checklist/.test(lower)
                ? "checklist"
                : "avaliação com questões e gabarito"
      : materialType === "activity"
        ? "atividade com questões numeradas e gabarito"
        : MATERIAL_INSTRUCTIONS[materialType].split(":")[0]

  return {
    materialType,
    requestedQuantity,
    expectedCount,
    quantityUnit,
    difficulty,
    outputFormat,
    theme: extractTheme(request),
    quantityValid: expectedCount === null || (expectedCount >= 1 && expectedCount <= 50),
  }
}

const stringSchema = { type: "string" } as const
const stringArraySchema = { type: "array", items: stringSchema } as const

const metadataSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    titulo: stringSchema,
    etapaEnsino: stringSchema,
    area: stringSchema,
    serieAno: stringSchema,
    tipoPlanejamento: stringSchema,
    assunto: stringSchema,
    pedidoProfessor: stringSchema,
  },
  required: [
    "titulo",
    "etapaEnsino",
    "area",
    "serieAno",
    "tipoPlanejamento",
    "assunto",
    "pedidoProfessor",
  ],
} as const

const skillSchema = {
  type: "array",
  items: {
    type: "object",
    additionalProperties: false,
    properties: { codigo: stringSchema, descricao: stringSchema },
    required: ["codigo", "descricao"],
  },
} as const

const competenciesSchema = {
  type: "array",
  items: {
    type: "object",
    additionalProperties: false,
    properties: { numero: { type: "integer", minimum: 1, maximum: 10 }, descricao: stringSchema },
    required: ["numero", "descricao"],
  },
} as const

const inclusionSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    contexto: stringSchema,
    principiosDua: {
      type: "object",
      additionalProperties: false,
      properties: {
        representacao: stringArraySchema,
        acaoExpressao: stringArraySchema,
        engajamento: stringArraySchema,
      },
      required: ["representacao", "acaoExpressao", "engajamento"],
    },
    estrategias: stringArraySchema,
    adaptacoes: stringArraySchema,
    recursos: stringArraySchema,
    participacao: stringSchema,
    avaliacaoAdaptada: stringArraySchema,
    criteriosAvaliacao: stringArraySchema,
  },
  required: [
    "contexto",
    "principiosDua",
    "estrategias",
    "adaptacoes",
    "recursos",
    "participacao",
    "avaliacaoAdaptada",
    "criteriosAvaliacao",
  ],
} as const

const visualResourcesSchema = {
  type: "array",
  maxItems: 4,
  items: {
    type: "object",
    additionalProperties: false,
    properties: {
      placementKey: stringSchema,
      pedagogicalPurpose: stringSchema,
      prompt: stringSchema,
      altText: stringSchema,
      required: { type: "boolean" },
    },
    required: ["placementKey", "pedagogicalPurpose", "prompt", "altText", "required"],
  },
} as const

const questionSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    numero: { type: "integer", minimum: 1 },
    enunciado: stringSchema,
    tipo: stringSchema,
    alternativas: stringArraySchema,
    resposta: stringSchema,
    explicacao: stringSchema,
  },
  required: ["numero", "enunciado", "tipo", "alternativas", "resposta", "explicacao"],
} as const

function commonProperties(materialType: MaterialType) {
  return {
    materialType: { type: "string", enum: [materialType] },
    metadata: metadataSchema,
    habilidadesBncc: skillSchema,
    competenciasGerais: competenciesSchema,
    visualResources: visualResourcesSchema,
    inclusaoAcessibilidade: inclusionSchema,
  }
}

const commonRequired = [
  "materialType",
  "metadata",
  "habilidadesBncc",
  "competenciasGerais",
  "visualResources",
  "inclusaoAcessibilidade",
]

function exactArray(items: unknown, count: number | null) {
  return {
    type: "array",
    items,
    ...(count ? { minItems: count, maxItems: count } : {}),
  }
}

export function buildMaterialJsonSchema(analysis: RequestAnalysis): Record<string, unknown> {
  const common = commonProperties(analysis.materialType)
  const count = analysis.expectedCount
  let specific: Record<string, unknown>
  let required: string[]

  switch (analysis.materialType) {
    case "lesson_plan":
      specific = {
        tema: stringSchema,
        duracao: stringSchema,
        objetivos: {
          type: "object",
          additionalProperties: false,
          properties: { geral: stringSchema, especificos: stringArraySchema },
          required: ["geral", "especificos"],
        },
        conteudos: stringArraySchema,
        metodologia: stringArraySchema,
        recursos: stringArraySchema,
        desenvolvimento: {
          type: "object",
          additionalProperties: false,
          properties: { abertura: stringSchema, etapas: stringArraySchema, fechamento: stringSchema },
          required: ["abertura", "etapas", "fechamento"],
        },
        atividades: stringArraySchema,
        avaliacao: {
          type: "object",
          additionalProperties: false,
          properties: { descricao: stringSchema, criterios: stringArraySchema, instrumentos: stringArraySchema },
          required: ["descricao", "criterios", "instrumentos"],
        },
        referencias: stringArraySchema,
      }
      required = ["tema", "duracao", "objetivos", "conteudos", "metodologia", "recursos", "desenvolvimento", "atividades", "avaliacao", "referencias"]
      break
    case "didactic_sequence":
      specific = {
        tema: stringSchema,
        objetivoGeral: stringSchema,
        numeroAulas: { type: "integer", minimum: count || 1, maximum: count || 50 },
        aulas: exactArray({
          type: "object",
          additionalProperties: false,
          properties: {
            numero: { type: "integer", minimum: 1 }, titulo: stringSchema, objetivos: stringArraySchema,
            conteudos: stringArraySchema, atividades: stringArraySchema, recursos: stringArraySchema,
            avaliacao: stringSchema, duracao: stringSchema,
          },
          required: ["numero", "titulo", "objetivos", "conteudos", "atividades", "recursos", "avaliacao", "duracao"],
        }, count),
        recursosGerais: stringArraySchema,
        avaliacaoFinal: stringSchema,
      }
      required = ["tema", "objetivoGeral", "numeroAulas", "aulas", "recursosGerais", "avaliacaoFinal"]
      break
    case "weekly_plan":
      specific = {
        temaSemana: stringSchema,
        objetivoSemanal: stringSchema,
        dias: exactArray({
          type: "object",
          additionalProperties: false,
          properties: {
            dia: { type: "string", enum: ["Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira"] },
            objetivos: stringArraySchema, conteudos: stringArraySchema, atividades: stringArraySchema,
            recursos: stringArraySchema, avaliacao: stringSchema,
          },
          required: ["dia", "objetivos", "conteudos", "atividades", "recursos", "avaliacao"],
        }, 5),
        observacoes: stringSchema,
      }
      required = ["temaSemana", "objetivoSemanal", "dias", "observacoes"]
      break
    case "monthly_plan":
      specific = {
        mesReferencia: stringSchema,
        objetivosMes: stringArraySchema,
        conteudos: stringArraySchema,
        semanas: exactArray({
          type: "object",
          additionalProperties: false,
          properties: {
            semana: { type: "integer", minimum: 1 }, foco: stringSchema, objetivos: stringArraySchema,
            conteudos: stringArraySchema, atividades: stringArraySchema, avaliacao: stringSchema,
          },
          required: ["semana", "foco", "objetivos", "conteudos", "atividades", "avaliacao"],
        }, count),
        projetos: stringArraySchema,
        recursos: stringArraySchema,
        avaliacaoMensal: stringSchema,
      }
      required = ["mesReferencia", "objetivosMes", "conteudos", "semanas", "projetos", "recursos", "avaliacaoMensal"]
      break
    case "pedagogical_project":
      specific = {
        titulo: stringSchema, justificativa: stringSchema, problema: stringSchema, objetivoGeral: stringSchema,
        objetivosEspecificos: stringArraySchema, publicoAlvo: stringSchema, areasEnvolvidas: stringArraySchema,
        metodologia: stringArraySchema,
        etapas: exactArray({
          type: "object", additionalProperties: false,
          properties: { numero: { type: "integer", minimum: 1 }, titulo: stringSchema, descricao: stringSchema },
          required: ["numero", "titulo", "descricao"],
        }, count),
        cronograma: { type: "array", items: { type: "object", additionalProperties: false, properties: { periodo: stringSchema, acao: stringSchema }, required: ["periodo", "acao"] } },
        recursos: stringArraySchema, avaliacao: stringSchema, produtoFinal: stringSchema,
      }
      required = ["titulo", "justificativa", "problema", "objetivoGeral", "objetivosEspecificos", "publicoAlvo", "areasEnvolvidas", "metodologia", "etapas", "cronograma", "recursos", "avaliacao", "produtoFinal"]
      break
    case "activity":
      specific = {
        titulo: stringSchema, instrucoes: stringSchema,
        quantidadeQuestoes: { type: "integer", minimum: count || 1, maximum: count || 50 },
        questoes: exactArray(questionSchema, count),
        gabarito: exactArray({
          type: "object", additionalProperties: false,
          properties: { numero: { type: "integer", minimum: 1 }, resposta: stringSchema, explicacao: stringSchema },
          required: ["numero", "resposta", "explicacao"],
        }, count),
      }
      required = ["titulo", "instrucoes", "quantidadeQuestoes", "questoes", "gabarito"]
      break
    case "assessment":
      specific = {
        titulo: stringSchema, tipoAvaliacao: stringSchema, instrucoes: stringSchema,
        criteriosGerais: stringArraySchema,
        quantidadeQuestoes: { type: "integer", minimum: count || 1, maximum: count || 50 },
        questoes: exactArray(questionSchema, count),
        gabarito: exactArray({
          type: "object", additionalProperties: false,
          properties: { numero: { type: "integer", minimum: 1 }, resposta: stringSchema, criterio: stringSchema },
          required: ["numero", "resposta", "criterio"],
        }, count),
        rubrica: { type: "array", items: { type: "object", additionalProperties: false, properties: { criterio: stringSchema, niveis: stringArraySchema }, required: ["criterio", "niveis"] } },
      }
      required = ["titulo", "tipoAvaliacao", "instrucoes", "criteriosGerais", "quantidadeQuestoes", "questoes", "gabarito", "rubrica"]
      break
    case "teaching_plan":
      specific = {
        periodoLetivo: stringSchema, ementa: stringSchema, objetivosGerais: stringArraySchema,
        unidades: exactArray({
          type: "object", additionalProperties: false,
          properties: {
            unidade: { type: "integer", minimum: 1 }, titulo: stringSchema, periodo: stringSchema,
            objetivos: stringArraySchema, conteudos: stringArraySchema, metodologia: stringArraySchema, avaliacao: stringSchema,
          },
          required: ["unidade", "titulo", "periodo", "objetivos", "conteudos", "metodologia", "avaliacao"],
        }, count),
        metodologiaGeral: stringArraySchema, recursos: stringArraySchema, avaliacao: stringSchema, referencias: stringArraySchema,
      }
      required = ["periodoLetivo", "ementa", "objetivosGerais", "unidades", "metodologiaGeral", "recursos", "avaliacao", "referencias"]
      break
    case "other":
    default:
      specific = {
        titulo: stringSchema, formatoIdentificado: stringSchema,
        secoes: exactArray({
          type: "object", additionalProperties: false,
          properties: { titulo: stringSchema, conteudo: stringSchema, itens: stringArraySchema },
          required: ["titulo", "conteudo", "itens"],
        }, count),
      }
      required = ["titulo", "formatoIdentificado", "secoes"]
  }

  return {
    type: "object",
    additionalProperties: false,
    properties: { ...common, ...specific },
    required: [...commonRequired, ...required],
  }
}

export function validatePlanningContentForRequest(
  value: unknown,
  analysis: RequestAnalysis,
): { valid: boolean; errors: string[]; content?: PlanningContent } {
  if (!isPlanningContent(value)) return { valid: false, errors: ["JSON não corresponde ao tipo de material."] }
  const errors: string[] = []
  if (value.materialType !== analysis.materialType) {
    errors.push(`Tipo retornado ${value.materialType}; esperado ${analysis.materialType}.`)
  }

  const expected = analysis.expectedCount
  if (expected) {
    let actual: number | null = null
    if (value.materialType === "activity" || value.materialType === "assessment") {
      actual = value.questoes.length
      if (value.quantidadeQuestoes !== expected) {
        errors.push(`Campo quantidadeQuestoes com ${value.quantidadeQuestoes}; esperado ${expected}.`)
      }
      if (value.gabarito.length !== expected) errors.push(`Gabarito com ${value.gabarito.length}; esperado ${expected}.`)
      if (value.questoes.some((item, index) => item.numero !== index + 1)) {
        errors.push("Questões não estão numeradas sequencialmente a partir de 1.")
      }
      if (value.gabarito.some((item, index) => item.numero !== index + 1)) {
        errors.push("Gabarito não está numerado sequencialmente a partir de 1.")
      }
    } else if (value.materialType === "didactic_sequence") {
      actual = value.aulas.length
      if (value.numeroAulas !== expected) {
        errors.push(`Campo numeroAulas com ${value.numeroAulas}; esperado ${expected}.`)
      }
      if (value.aulas.some((item, index) => item.numero !== index + 1)) {
        errors.push("Aulas não estão numeradas sequencialmente a partir de 1.")
      }
    } else if (value.materialType === "weekly_plan") actual = value.dias.length
    else if (value.materialType === "monthly_plan") actual = value.semanas.length
    else if (value.materialType === "pedagogical_project") actual = value.etapas.length
    else if (value.materialType === "teaching_plan") actual = value.unidades.length
    else if (value.materialType === "other") actual = value.secoes.length
    if (actual !== null && actual !== expected) errors.push(`Quantidade retornada ${actual}; esperada ${expected}.`)
  }

  if (value.materialType === "weekly_plan") {
    const expectedDays = ["Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira"]
    if (value.dias.some((day, index) => day.dia !== expectedDays[index])) {
      errors.push("Planejamento semanal não contém segunda a sexta na ordem correta.")
    }
  }

  return { valid: errors.length === 0, errors, content: value }
}
