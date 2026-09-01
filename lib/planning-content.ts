import type {
  BnccSkill,
  GeneralCompetency,
  InclusionAccessibilityContent,
} from "@/lib/bncc-plan"
import { normalizeAlternativeList, normalizeAnswerLetter } from "@/lib/alternatives"
import { stripIdentificationLines } from "@/lib/identification"

export type MaterialType =
  | "lesson_plan"
  | "didactic_sequence"
  | "weekly_plan"
  | "monthly_plan"
  | "pedagogical_project"
  | "activity"
  | "assessment"
  | "teaching_plan"
  | "other"

export interface MaterialMetadata {
  titulo: string
  etapaEnsino: string
  area: string
  serieAno: string
  tipoPlanejamento: string
  assunto: string
  pedidoProfessor: string
}

export interface VisualResourceSpec {
  placementKey: string
  pedagogicalPurpose: string
  prompt: string
  altText: string
  required: boolean
}

export interface CommonPlanningContent {
  materialType: MaterialType
  metadata: MaterialMetadata
  habilidadesBncc: BnccSkill[]
  competenciasGerais: GeneralCompetency[]
  visualResources: VisualResourceSpec[]
  inclusaoAcessibilidade: InclusionAccessibilityContent
}

export interface LessonPlanMaterial extends CommonPlanningContent {
  materialType: "lesson_plan"
  tema: string
  duracao: string
  objetivos: { geral: string; especificos: string[] }
  conteudos: string[]
  metodologia: string[]
  recursos: string[]
  desenvolvimento: {
    abertura: string
    etapas: string[]
    fechamento: string
  }
  atividades: string[]
  avaliacao: { descricao: string; criterios: string[]; instrumentos: string[] }
  referencias: string[]
}

export interface SequenceLesson {
  numero: number
  titulo: string
  objetivos: string[]
  conteudos: string[]
  atividades: string[]
  recursos: string[]
  avaliacao: string
  duracao: string
}

export interface DidacticSequenceMaterial extends CommonPlanningContent {
  materialType: "didactic_sequence"
  tema: string
  objetivoGeral: string
  numeroAulas: number
  aulas: SequenceLesson[]
  recursosGerais: string[]
  avaliacaoFinal: string
}

export interface DayPlan {
  dia: "Segunda-feira" | "Terça-feira" | "Quarta-feira" | "Quinta-feira" | "Sexta-feira"
  objetivos: string[]
  conteudos: string[]
  atividades: string[]
  recursos: string[]
  avaliacao: string
}

export interface WeeklyPlanMaterial extends CommonPlanningContent {
  materialType: "weekly_plan"
  temaSemana: string
  objetivoSemanal: string
  dias: DayPlan[]
  observacoes: string
}

export interface MonthWeek {
  semana: number
  foco: string
  objetivos: string[]
  conteudos: string[]
  atividades: string[]
  avaliacao: string
}

export interface MonthlyPlanMaterial extends CommonPlanningContent {
  materialType: "monthly_plan"
  mesReferencia: string
  objetivosMes: string[]
  conteudos: string[]
  semanas: MonthWeek[]
  projetos: string[]
  recursos: string[]
  avaliacaoMensal: string
}

export interface PedagogicalProjectMaterial extends CommonPlanningContent {
  materialType: "pedagogical_project"
  titulo: string
  justificativa: string
  problema: string
  objetivoGeral: string
  objetivosEspecificos: string[]
  publicoAlvo: string
  areasEnvolvidas: string[]
  metodologia: string[]
  etapas: { numero: number; titulo: string; descricao: string }[]
  cronograma: { periodo: string; acao: string }[]
  recursos: string[]
  avaliacao: string
  produtoFinal: string
}

export interface QuestionItem {
  numero: number
  enunciado: string
  tipo: string
  alternativas: string[]
  resposta: string
  explicacao: string
}

export interface ActivityMaterial extends CommonPlanningContent {
  materialType: "activity"
  titulo: string
  instrucoes: string
  camposIdentificacao: string[]
  quantidadeQuestoes: number
  questoes: QuestionItem[]
  gabarito: { numero: number; resposta: string; explicacao: string }[]
}

export interface AssessmentMaterial extends CommonPlanningContent {
  materialType: "assessment"
  titulo: string
  tipoAvaliacao: string
  instrucoes: string
  camposIdentificacao: string[]
  criteriosGerais: string[]
  quantidadeQuestoes: number
  questoes: QuestionItem[]
  gabarito: { numero: number; resposta: string; criterio: string }[]
  rubrica: { criterio: string; niveis: string[] }[]
}

export interface TeachingUnit {
  unidade: number
  titulo: string
  periodo: string
  objetivos: string[]
  conteudos: string[]
  metodologia: string[]
  avaliacao: string
}

export interface TeachingPlanMaterial extends CommonPlanningContent {
  materialType: "teaching_plan"
  periodoLetivo: string
  ementa: string
  objetivosGerais: string[]
  unidades: TeachingUnit[]
  metodologiaGeral: string[]
  recursos: string[]
  avaliacao: string
  referencias: string[]
}

export interface OtherMaterial extends CommonPlanningContent {
  materialType: "other"
  titulo: string
  formatoIdentificado: string
  secoes: { titulo: string; conteudo: string; itens: string[] }[]
}

export type PlanningContent =
  | LessonPlanMaterial
  | DidacticSequenceMaterial
  | WeeklyPlanMaterial
  | MonthlyPlanMaterial
  | PedagogicalProjectMaterial
  | ActivityMaterial
  | AssessmentMaterial
  | TeachingPlanMaterial
  | OtherMaterial

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function isString(value: unknown): value is string {
  return typeof value === "string"
}

function isArray(value: unknown): value is unknown[] {
  return Array.isArray(value)
}

function hasCommonContent(value: Record<string, unknown>): boolean {
  return (
    isRecord(value.metadata) &&
    isString(value.metadata.titulo) &&
    isString(value.metadata.etapaEnsino) &&
    isString(value.metadata.area) &&
    isString(value.metadata.serieAno) &&
    isString(value.metadata.tipoPlanejamento) &&
    isString(value.metadata.assunto) &&
    isString(value.metadata.pedidoProfessor) &&
    isArray(value.habilidadesBncc) &&
    isArray(value.competenciasGerais) &&
    isArray(value.visualResources) &&
    isRecord(value.inclusaoAcessibilidade)
  )
}

export function isPlanningContent(value: unknown): value is PlanningContent {
  if (!isRecord(value) || !isString(value.materialType) || !hasCommonContent(value)) return false

  switch (value.materialType) {
    case "lesson_plan":
      return isString(value.tema) && isRecord(value.objetivos) && isArray(value.conteudos) && isArray(value.metodologia)
    case "didactic_sequence":
      return typeof value.numeroAulas === "number" && isArray(value.aulas)
    case "weekly_plan":
      return isString(value.temaSemana) && isArray(value.dias)
    case "monthly_plan":
      return isArray(value.objetivosMes) && isArray(value.semanas)
    case "pedagogical_project":
      return isString(value.justificativa) && isString(value.problema) && isArray(value.etapas)
    case "activity":
      return typeof value.quantidadeQuestoes === "number" && isArray(value.questoes) && isArray(value.gabarito)
    case "assessment":
      return typeof value.quantidadeQuestoes === "number" && isArray(value.questoes) && isArray(value.gabarito)
    case "teaching_plan":
      return isString(value.periodoLetivo) && isArray(value.unidades)
    case "other":
      return isString(value.formatoIdentificado) && isArray(value.secoes)
    default:
      return false
  }
}

export function getPlanningContentTitle(content: PlanningContent): string {
  return content.metadata.titulo
}

/**
 * Remove marcadores de letra das alternativas ("A) texto" → "texto") e
 * normaliza a resposta do gabarito ("A)", "A.", "(A)" → "A") logo na entrada,
 * garantindo que o conteúdo salvo nunca carregue a letra embutida no texto.
 * Respostas abertas (texto livre) permanecem intactas.
 *
 * Também remove qualquer cabeçalho/formulário de identificação que a IA tenha
 * gerado dentro do conteúdo (Nome do Estudante, Turma, Data, Escola, Professor,
 * campos de preenchimento). Essas informações pertencem exclusivamente ao
 * cabeçalho da aplicação.
 */
export function normalizePlanningContent(value: PlanningContent): PlanningContent {
  if (value.materialType === "activity" || value.materialType === "assessment") {
    const questoes = value.questoes.map((question) => ({
      ...question,
      enunciado: stripIdentificationLines(question.enunciado),
      alternativas: normalizeAlternativeList(question.alternativas).map((alternative) => alternative.text),
    }))
    const gabarito = value.gabarito.map((answer) => ({
      ...answer,
      resposta: normalizeAnswerLetter(answer.resposta),
    }))
    return {
      ...value,
      instrucoes: stripIdentificationLines(value.instrucoes),
      camposIdentificacao: [],
      questoes,
      gabarito,
    } as PlanningContent
  }

  if (value.materialType === "other") {
    return {
      ...value,
      secoes: value.secoes.map((section) => ({
        ...section,
        conteudo: stripIdentificationLines(section.conteudo),
      })),
    } as PlanningContent
  }

  return value
}
