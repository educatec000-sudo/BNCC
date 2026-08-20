import { isPlanningContent, type PlanningContent, type QuestionItem } from "@/lib/planning-content"
import { planningContentToText } from "@/lib/planning-text"

export interface DocumentImage {
  assetId?: string
  placementKey: string
  src: string
  altText: string
  widthPercent: number
  position: number
}

export type DocumentBlock =
  | { type: "paragraph"; text: string; bold?: boolean }
  | { type: "bullets"; items: string[] }
  | { type: "numbered"; items: string[] }
  | { type: "table"; headers: string[]; rows: string[][] }
  | { type: "image"; image: DocumentImage }
  | { type: "questions"; questions: QuestionItem[]; images: DocumentImage[] }

export interface DocumentSection {
  title: string
  blocks: DocumentBlock[]
  pageBreakBefore?: boolean
}

export interface PlanningDocumentModel {
  title: string
  subtitle: string
  topic: string
  cover: boolean
  recommendedOrientation: "portrait" | "landscape"
  identificationFields: { label: string; value: string }[]
  sections: DocumentSection[]
}

interface PlanRecordForDocument {
  title: string
  topic: string
  educationStage: string
  subject: string
  grade: string
  planningType: string
  request: string
  content: unknown
  images?: {
    id?: string
    placementKey: string
    position: number
    widthPercent: number
    mimeType: string | null
    imageData: Uint8Array | null
    altText: string | null
  }[]
}

function questionSection(
  title: string,
  questions: QuestionItem[],
  instructions: string,
  fields: string[],
  images: DocumentImage[],
): DocumentSection {
  return {
    title,
    blocks: [
      { type: "paragraph", text: fields.map((field) => `${field}: __________________________`).join("    ") },
      { type: "paragraph", text: instructions, bold: true },
      { type: "questions", questions, images },
    ],
  }
}

function answerRows(
  answers: { numero: number; resposta: string; explicacao?: string; criterio?: string }[],
) {
  return answers.map((answer) => [
    String(answer.numero),
    answer.resposta,
    answer.explicacao || answer.criterio || "",
  ])
}

function commonSections(content: PlanningContent): DocumentSection[] {
  return [
    {
      title: "Habilidades e competências BNCC",
      blocks: [
        {
          type: "table",
          headers: ["Código", "Descrição"],
          rows: content.habilidadesBncc.map((skill) => [skill.codigo, skill.descricao]),
        },
        {
          type: "numbered",
          items: content.competenciasGerais.map(
            (competency) => `${competency.numero}. ${competency.descricao}`,
          ),
        },
      ],
    },
    {
      title: "Inclusão, acessibilidade e DUA",
      blocks: [
        { type: "paragraph", text: content.inclusaoAcessibilidade.contexto },
        {
          type: "bullets",
          items: [
            ...content.inclusaoAcessibilidade.principiosDua.representacao.map(
              (item) => `Representação: ${item}`,
            ),
            ...content.inclusaoAcessibilidade.principiosDua.acaoExpressao.map(
              (item) => `Ação e expressão: ${item}`,
            ),
            ...content.inclusaoAcessibilidade.principiosDua.engajamento.map(
              (item) => `Engajamento: ${item}`,
            ),
          ],
        },
        { type: "bullets", items: content.inclusaoAcessibilidade.estrategias },
        {
          type: "paragraph",
          text: `Participação: ${content.inclusaoAcessibilidade.participacao}`,
        },
        {
          type: "bullets",
          items: content.inclusaoAcessibilidade.avaliacaoAdaptada.map(
            (item) => `Avaliação adaptada: ${item}`,
          ),
        },
      ],
    },
  ]
}

function sectionsFor(content: PlanningContent, images: DocumentImage[]): DocumentSection[] {
  let sections: DocumentSection[]

  switch (content.materialType) {
    case "lesson_plan":
      sections = [
        {
          title: "Objetivos",
          blocks: [
            { type: "paragraph", text: content.objetivos.geral, bold: true },
            { type: "bullets", items: content.objetivos.especificos },
          ],
        },
        { title: "Conteúdos", blocks: [{ type: "bullets", items: content.conteudos }] },
        { title: "Metodologia", blocks: [{ type: "bullets", items: content.metodologia }] },
        { title: "Recursos", blocks: [{ type: "bullets", items: content.recursos }] },
        {
          title: "Desenvolvimento",
          blocks: [
            { type: "paragraph", text: `Abertura: ${content.desenvolvimento.abertura}` },
            { type: "numbered", items: content.desenvolvimento.etapas },
            { type: "paragraph", text: `Fechamento: ${content.desenvolvimento.fechamento}` },
          ],
        },
        { title: "Atividades", blocks: [{ type: "bullets", items: content.atividades }] },
        {
          title: "Avaliação",
          blocks: [
            { type: "paragraph", text: content.avaliacao.descricao },
            { type: "bullets", items: content.avaliacao.criterios },
            { type: "bullets", items: content.avaliacao.instrumentos },
          ],
        },
        { title: "Referências", blocks: [{ type: "bullets", items: content.referencias }] },
      ]
      break
    case "didactic_sequence":
      sections = [
        {
          title: "Apresentação da sequência",
          blocks: [
            { type: "paragraph", text: `Tema: ${content.tema}` },
            { type: "paragraph", text: `Objetivo geral: ${content.objetivoGeral}` },
            { type: "paragraph", text: `Número de aulas: ${content.numeroAulas}` },
          ],
        },
        ...content.aulas.map((lesson) => ({
          title: `Aula ${lesson.numero} — ${lesson.titulo}`,
          blocks: [
            { type: "paragraph" as const, text: `Duração: ${lesson.duracao}` },
            { type: "bullets" as const, items: lesson.objetivos },
            { type: "bullets" as const, items: lesson.conteudos },
            { type: "numbered" as const, items: lesson.atividades },
            { type: "bullets" as const, items: lesson.recursos },
            { type: "paragraph" as const, text: `Avaliação: ${lesson.avaliacao}` },
          ],
        })),
        { title: "Avaliação final", blocks: [{ type: "paragraph", text: content.avaliacaoFinal }] },
      ]
      break
    case "weekly_plan":
      sections = [
        {
          title: "Organização semanal",
          blocks: [
            { type: "paragraph", text: `Objetivo semanal: ${content.objetivoSemanal}` },
            {
              type: "table",
              headers: ["Dia", "Objetivos", "Conteúdos", "Atividades", "Avaliação"],
              rows: content.dias.map((day) => [
                day.dia,
                day.objetivos.join("; "),
                day.conteudos.join("; "),
                day.atividades.join("; "),
                day.avaliacao,
              ]),
            },
          ],
        },
      ]
      break
    case "monthly_plan":
      sections = [
        { title: "Objetivos do mês", blocks: [{ type: "bullets", items: content.objetivosMes }] },
        { title: "Conteúdos", blocks: [{ type: "bullets", items: content.conteudos }] },
        ...content.semanas.map((week) => ({
          title: `Semana ${week.semana} — ${week.foco}`,
          blocks: [
            { type: "bullets" as const, items: week.objetivos },
            { type: "bullets" as const, items: week.conteudos },
            { type: "numbered" as const, items: week.atividades },
            { type: "paragraph" as const, text: `Avaliação: ${week.avaliacao}` },
          ],
        })),
        { title: "Projetos e recursos", blocks: [{ type: "bullets", items: [...content.projetos, ...content.recursos] }] },
        { title: "Avaliação mensal", blocks: [{ type: "paragraph", text: content.avaliacaoMensal }] },
      ]
      break
    case "pedagogical_project":
      sections = [
        { title: "Justificativa", blocks: [{ type: "paragraph", text: content.justificativa }] },
        { title: "Problema", blocks: [{ type: "paragraph", text: content.problema }] },
        {
          title: "Objetivos",
          blocks: [
            { type: "paragraph", text: content.objetivoGeral, bold: true },
            { type: "bullets", items: content.objetivosEspecificos },
          ],
        },
        { title: "Público-alvo e áreas", blocks: [{ type: "paragraph", text: content.publicoAlvo }, { type: "bullets", items: content.areasEnvolvidas }] },
        { title: "Metodologia", blocks: [{ type: "bullets", items: content.metodologia }] },
        { title: "Etapas", blocks: [{ type: "numbered", items: content.etapas.map((step) => `${step.titulo}: ${step.descricao}`) }] },
        {
          title: "Cronograma",
          blocks: [{ type: "table", headers: ["Período", "Ação"], rows: content.cronograma.map((item) => [item.periodo, item.acao]) }],
        },
        { title: "Recursos", blocks: [{ type: "bullets", items: content.recursos }] },
        { title: "Avaliação", blocks: [{ type: "paragraph", text: content.avaliacao }] },
        { title: "Produto final", blocks: [{ type: "paragraph", text: content.produtoFinal }] },
      ]
      break
    case "activity":
      sections = [
        questionSection(content.titulo, content.questoes, content.instrucoes, content.camposIdentificacao, images),
        {
          title: "Gabarito",
          pageBreakBefore: true,
          blocks: [
            {
              type: "table",
              headers: ["Questão", "Resposta", "Explicação"],
              rows: answerRows(content.gabarito),
            },
          ],
        },
      ]
      break
    case "assessment":
      sections = [
        questionSection(
          content.titulo,
          content.questoes,
          `${content.tipoAvaliacao}. ${content.instrucoes}`,
          content.camposIdentificacao,
          images,
        ),
        {
          title: "Gabarito e critérios",
          pageBreakBefore: true,
          blocks: [
            {
              type: "table",
              headers: ["Questão", "Resposta", "Critério"],
              rows: answerRows(content.gabarito),
            },
          ],
        },
        {
          title: "Rubrica",
          blocks: [
            {
              type: "table",
              headers: ["Critério", "Níveis"],
              rows: content.rubrica.map((item) => [item.criterio, item.niveis.join("; ")]),
            },
          ],
        },
      ]
      break
    case "teaching_plan":
      sections = [
        { title: "Ementa", blocks: [{ type: "paragraph", text: content.ementa }] },
        { title: "Objetivos gerais", blocks: [{ type: "bullets", items: content.objetivosGerais }] },
        ...content.unidades.map((unit) => ({
          title: `Unidade ${unit.unidade} — ${unit.titulo}`,
          blocks: [
            { type: "paragraph" as const, text: `Período: ${unit.periodo}` },
            { type: "bullets" as const, items: unit.objetivos },
            { type: "bullets" as const, items: unit.conteudos },
            { type: "bullets" as const, items: unit.metodologia },
            { type: "paragraph" as const, text: `Avaliação: ${unit.avaliacao}` },
          ],
        })),
        { title: "Metodologia e recursos", blocks: [{ type: "bullets", items: [...content.metodologiaGeral, ...content.recursos] }] },
        { title: "Avaliação", blocks: [{ type: "paragraph", text: content.avaliacao }] },
        { title: "Referências", blocks: [{ type: "bullets", items: content.referencias }] },
      ]
      break
    case "other":
      sections = content.secoes.map((section) => ({
        title: section.titulo,
        blocks: [
          { type: "paragraph" as const, text: section.conteudo },
          { type: "bullets" as const, items: section.itens },
        ],
      }))
      break
  }

  const questionLinked =
    content.materialType === "activity" || content.materialType === "assessment"
  const visualSections: DocumentSection[] = images
    .filter((image) => !(questionLinked && image.placementKey.startsWith("question:")))
    .map((image) => ({
      title: image.placementKey === "cover" ? "Recurso visual" : `Recurso visual — ${image.placementKey}`,
      blocks: [{ type: "image" as const, image }],
    }))

  return [...visualSections, ...sections, ...commonSections(content)].filter((section) =>
    section.blocks.some((block) => {
      if (block.type === "paragraph") return Boolean(block.text.trim())
      if (block.type === "bullets" || block.type === "numbered") return block.items.length > 0
      if (block.type === "table") return block.rows.length > 0
      if (block.type === "image") return Boolean(block.image.src)
      return block.questions.length > 0
    }),
  )
}

export function buildPlanningDocumentModel(
  plan: PlanRecordForDocument,
): PlanningDocumentModel {
  const content = plan.content
  const images: DocumentImage[] = (plan.images || [])
    .filter((image) => image.imageData && image.mimeType)
    .map((image) => ({
      assetId: image.id,
      placementKey: image.placementKey,
      position: image.position,
      widthPercent: image.widthPercent,
      altText: image.altText || "Imagem educacional",
      src: `data:${image.mimeType};base64,${Buffer.from(image.imageData!).toString("base64")}`,
    }))
    .sort((a, b) => a.position - b.position)
  const cover = !isPlanningContent(content)
    ? true
    : !["activity", "assessment"].includes(content.materialType)
  const recommendedOrientation =
    isPlanningContent(content) && content.materialType === "weekly_plan" ? "landscape" : "portrait"
  const sections = isPlanningContent(content)
    ? sectionsFor(content, images)
    : [
        {
          title: "Conteúdo pedagógico",
          blocks: [{ type: "paragraph" as const, text: planningContentToText(content) }],
        },
      ]

  return {
    title: isPlanningContent(content) ? content.metadata.titulo : plan.title,
    subtitle: `${plan.planningType} · ${plan.subject} · ${plan.grade}`,
    topic: plan.topic,
    cover,
    recommendedOrientation,
    identificationFields: [
      { label: "Etapa", value: plan.educationStage },
      { label: "Área/Disciplina", value: plan.subject },
      { label: "Ano/Série", value: plan.grade },
      { label: "Assunto", value: plan.topic },
      { label: "Tipo de material", value: plan.planningType },
    ].filter((field) => field.value && field.value !== "Não informado"),
    sections,
  }
}
