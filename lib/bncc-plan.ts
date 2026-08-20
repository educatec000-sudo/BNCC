export interface LessonIdentification {
  tema: string
  disciplina: string
  ano: string
  duracao: string
  nivel: string
  etapaEnsino: string
  tipoPlanejamento: string
  pedidoProfessor: string
}

export interface LearningObjectives {
  geral: string
  especificos: string[]
}

export interface BnccSkill {
  codigo: string
  descricao: string
}

export interface GeneralCompetency {
  numero: number
  descricao: string
}

export interface LessonStep {
  duracao: string
  descricao: string
  etapas?: string[]
}

export interface LessonActivity {
  titulo: string
  descricao: string
  duracao: string
  tipo: "individual" | "grupo" | "turma"
}

export interface InclusionAccessibilityContent {
  contexto: string
  principiosDua: {
    representacao: string[]
    acaoExpressao: string[]
    engajamento: string[]
  }
  estrategias: string[]
  adaptacoes: string[]
  recursos: string[]
  participacao: string
  avaliacaoAdaptada: string[]
  criteriosAvaliacao: string[]
}

export interface LessonPlanContent {
  identificacao: LessonIdentification
  objetivos: LearningObjectives
  habilidadesBncc: BnccSkill[]
  competenciasGerais: GeneralCompetency[]
  sequenciaDidatica: {
    abertura: LessonStep
    desenvolvimento: LessonStep & { etapas: string[] }
    fechamento: LessonStep
  }
  atividades: LessonActivity[]
  recursosPedagogicos: {
    materiais: string[]
    tecnologias: string[]
    referencias: string[]
  }
  avaliacao: {
    criterios: string[]
    instrumentos: string[]
    descricao: string
  }
  encaminhamentos: {
    proximasAulas: string
    atividadesComplementares: string[]
  }
  inclusaoAcessibilidade: InclusionAccessibilityContent
}

const stringSchema = { type: "string" } as const
const stringArraySchema = {
  type: "array",
  items: stringSchema,
} as const

export const BNCC_PLAN_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    identificacao: {
      type: "object",
      additionalProperties: false,
      properties: {
        tema: stringSchema,
        disciplina: stringSchema,
        ano: stringSchema,
        duracao: stringSchema,
        nivel: stringSchema,
        etapaEnsino: stringSchema,
        tipoPlanejamento: stringSchema,
        pedidoProfessor: stringSchema,
      },
      required: [
        "tema",
        "disciplina",
        "ano",
        "duracao",
        "nivel",
        "etapaEnsino",
        "tipoPlanejamento",
        "pedidoProfessor",
      ],
    },
    objetivos: {
      type: "object",
      additionalProperties: false,
      properties: {
        geral: stringSchema,
        especificos: stringArraySchema,
      },
      required: ["geral", "especificos"],
    },
    habilidadesBncc: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          codigo: stringSchema,
          descricao: stringSchema,
        },
        required: ["codigo", "descricao"],
      },
    },
    competenciasGerais: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          numero: { type: "integer", minimum: 1, maximum: 10 },
          descricao: stringSchema,
        },
        required: ["numero", "descricao"],
      },
    },
    sequenciaDidatica: {
      type: "object",
      additionalProperties: false,
      properties: {
        abertura: {
          type: "object",
          additionalProperties: false,
          properties: {
            duracao: stringSchema,
            descricao: stringSchema,
          },
          required: ["duracao", "descricao"],
        },
        desenvolvimento: {
          type: "object",
          additionalProperties: false,
          properties: {
            duracao: stringSchema,
            descricao: stringSchema,
            etapas: stringArraySchema,
          },
          required: ["duracao", "descricao", "etapas"],
        },
        fechamento: {
          type: "object",
          additionalProperties: false,
          properties: {
            duracao: stringSchema,
            descricao: stringSchema,
          },
          required: ["duracao", "descricao"],
        },
      },
      required: ["abertura", "desenvolvimento", "fechamento"],
    },
    atividades: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          titulo: stringSchema,
          descricao: stringSchema,
          duracao: stringSchema,
          tipo: { type: "string", enum: ["individual", "grupo", "turma"] },
        },
        required: ["titulo", "descricao", "duracao", "tipo"],
      },
    },
    recursosPedagogicos: {
      type: "object",
      additionalProperties: false,
      properties: {
        materiais: stringArraySchema,
        tecnologias: stringArraySchema,
        referencias: stringArraySchema,
      },
      required: ["materiais", "tecnologias", "referencias"],
    },
    avaliacao: {
      type: "object",
      additionalProperties: false,
      properties: {
        criterios: stringArraySchema,
        instrumentos: stringArraySchema,
        descricao: stringSchema,
      },
      required: ["criterios", "instrumentos", "descricao"],
    },
    encaminhamentos: {
      type: "object",
      additionalProperties: false,
      properties: {
        proximasAulas: stringSchema,
        atividadesComplementares: stringArraySchema,
      },
      required: ["proximasAulas", "atividadesComplementares"],
    },
    inclusaoAcessibilidade: {
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
    },
  },
  required: [
    "identificacao",
    "objetivos",
    "habilidadesBncc",
    "competenciasGerais",
    "sequenciaDidatica",
    "atividades",
    "recursosPedagogicos",
    "avaliacao",
    "encaminhamentos",
    "inclusaoAcessibilidade",
  ],
} as const

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function hasString(record: Record<string, unknown>, key: string): boolean {
  return typeof record[key] === "string"
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string")
}

function isLessonStep(value: unknown, requireSteps = false): value is LessonStep {
  if (!isRecord(value) || !hasString(value, "duracao") || !hasString(value, "descricao")) {
    return false
  }

  return !requireSteps || isStringArray(value.etapas)
}

function isInclusionContent(value: unknown): value is InclusionAccessibilityContent {
  if (!isRecord(value) || !hasString(value, "contexto") || !hasString(value, "participacao")) {
    return false
  }
  const dua = value.principiosDua
  return (
    isRecord(dua) &&
    isStringArray(dua.representacao) &&
    isStringArray(dua.acaoExpressao) &&
    isStringArray(dua.engajamento) &&
    isStringArray(value.estrategias) &&
    isStringArray(value.adaptacoes) &&
    isStringArray(value.recursos) &&
    isStringArray(value.avaliacaoAdaptada) &&
    isStringArray(value.criteriosAvaliacao)
  )
}

export function isLessonPlanContent(value: unknown): value is LessonPlanContent {
  if (!isRecord(value)) return false

  const identification = value.identificacao
  const objectives = value.objetivos
  const sequence = value.sequenciaDidatica
  const resources = value.recursosPedagogicos
  const assessment = value.avaliacao
  const nextSteps = value.encaminhamentos
  const inclusion = value.inclusaoAcessibilidade

  return (
    isRecord(identification) &&
    [
      "tema",
      "disciplina",
      "ano",
      "duracao",
      "nivel",
      "etapaEnsino",
      "tipoPlanejamento",
      "pedidoProfessor",
    ].every((key) => hasString(identification, key)) &&
    isRecord(objectives) &&
    hasString(objectives, "geral") &&
    isStringArray(objectives.especificos) &&
    Array.isArray(value.habilidadesBncc) &&
    Array.isArray(value.competenciasGerais) &&
    isRecord(sequence) &&
    isLessonStep(sequence.abertura) &&
    isLessonStep(sequence.desenvolvimento, true) &&
    isLessonStep(sequence.fechamento) &&
    Array.isArray(value.atividades) &&
    isRecord(resources) &&
    isStringArray(resources.materiais) &&
    isStringArray(resources.tecnologias) &&
    isStringArray(resources.referencias) &&
    isRecord(assessment) &&
    hasString(assessment, "descricao") &&
    isStringArray(assessment.criterios) &&
    isStringArray(assessment.instrumentos) &&
    isRecord(nextSteps) &&
    hasString(nextSteps, "proximasAulas") &&
    isStringArray(nextSteps.atividadesComplementares) &&
    (inclusion === undefined || isInclusionContent(inclusion))
  )
}
