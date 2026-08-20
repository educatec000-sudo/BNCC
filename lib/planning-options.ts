export interface PlanningOption {
  id: string
  label: string
  description?: string
  icon: string
}

export interface EducationStage extends PlanningOption {
  areas: PlanningOption[]
  grades: PlanningOption[]
}

const fundamentalAreas: PlanningOption[] = [
  { id: "lingua-portuguesa", label: "Língua Portuguesa", icon: "Languages" },
  { id: "matematica", label: "Matemática", icon: "Calculator" },
  { id: "ciencias", label: "Ciências", icon: "FlaskConical" },
  { id: "historia", label: "História", icon: "Landmark" },
  { id: "geografia", label: "Geografia", icon: "Globe2" },
  { id: "arte", label: "Arte", icon: "Palette" },
  { id: "educacao-fisica", label: "Educação Física", icon: "Activity" },
  { id: "ensino-religioso", label: "Ensino Religioso", icon: "HeartHandshake" },
]

export const EDUCATION_STAGES: EducationStage[] = [
  {
    id: "educacao-infantil",
    label: "Educação Infantil",
    description: "Bebês e crianças pequenas",
    icon: "Baby",
    areas: [
      { id: "eu-outro-nos", label: "O eu, o outro e o nós", icon: "Users" },
      { id: "corpo-gestos-movimentos", label: "Corpo, gestos e movimentos", icon: "PersonStanding" },
      { id: "tracos-sons-cores-formas", label: "Traços, sons, cores e formas", icon: "Palette" },
      { id: "escuta-fala-pensamento", label: "Escuta, fala, pensamento e imaginação", icon: "MessageCircle" },
      { id: "espacos-tempos-quantidades", label: "Espaços, tempos, quantidades, relações e transformações", icon: "Shapes" },
    ],
    grades: [
      { id: "bebes", label: "Bebês (0 a 1 ano e 6 meses)", icon: "Baby" },
      { id: "criancas-bem-pequenas", label: "Crianças bem pequenas (1 ano e 7 meses a 3 anos e 11 meses)", icon: "Blocks" },
      { id: "criancas-pequenas", label: "Crianças pequenas (4 anos a 5 anos e 11 meses)", icon: "Puzzle" },
    ],
  },
  {
    id: "fundamental-i",
    label: "Ensino Fundamental I",
    description: "Anos iniciais — 1º ao 5º ano",
    icon: "BookOpen",
    areas: fundamentalAreas,
    grades: [1, 2, 3, 4, 5].map((year) => ({
      id: `${year}-ano-fundamental`,
      label: `${year}º Ano`,
      icon: "GraduationCap",
    })),
  },
  {
    id: "fundamental-ii",
    label: "Ensino Fundamental II",
    description: "Anos finais — 6º ao 9º ano",
    icon: "Library",
    areas: [
      ...fundamentalAreas,
      { id: "lingua-inglesa", label: "Língua Inglesa", icon: "Languages" },
    ],
    grades: [6, 7, 8, 9].map((year) => ({
      id: `${year}-ano-fundamental`,
      label: `${year}º Ano`,
      icon: "GraduationCap",
    })),
  },
  {
    id: "ensino-medio",
    label: "Ensino Médio",
    description: "1ª à 3ª série",
    icon: "School",
    areas: [
      { id: "linguagens", label: "Linguagens e suas Tecnologias", icon: "Languages" },
      { id: "matematica", label: "Matemática e suas Tecnologias", icon: "Calculator" },
      { id: "ciencias-natureza", label: "Ciências da Natureza e suas Tecnologias", icon: "Atom" },
      { id: "ciencias-humanas", label: "Ciências Humanas e Sociais Aplicadas", icon: "Landmark" },
      { id: "biologia", label: "Biologia", icon: "Microscope" },
      { id: "fisica", label: "Física", icon: "Orbit" },
      { id: "quimica", label: "Química", icon: "FlaskConical" },
      { id: "filosofia", label: "Filosofia", icon: "Brain" },
      { id: "sociologia", label: "Sociologia", icon: "Users" },
    ],
    grades: [1, 2, 3].map((year) => ({
      id: `${year}-serie-medio`,
      label: `${year}ª Série`,
      icon: "GraduationCap",
    })),
  },
  {
    id: "bncc-computacao",
    label: "BNCC Computação",
    description: "Competências digitais e computacionais",
    icon: "Laptop",
    areas: [
      { id: "pensamento-computacional", label: "Pensamento Computacional", icon: "BrainCircuit" },
      { id: "mundo-digital", label: "Mundo Digital", icon: "MonitorSmartphone" },
      { id: "cultura-digital", label: "Cultura Digital", icon: "Network" },
    ],
    grades: [
      { id: "educacao-infantil-computacao", label: "Educação Infantil", icon: "Baby" },
      { id: "anos-iniciais-computacao", label: "Anos Iniciais", icon: "BookOpen" },
      { id: "anos-finais-computacao", label: "Anos Finais", icon: "Library" },
      { id: "ensino-medio-computacao", label: "Ensino Médio", icon: "School" },
    ],
  },
  {
    id: "eja",
    label: "EJA",
    description: "Educação de Jovens e Adultos",
    icon: "UserRoundCheck",
    areas: [
      { id: "linguagens-eja", label: "Linguagens", icon: "Languages" },
      { id: "matematica-eja", label: "Matemática", icon: "Calculator" },
      { id: "ciencias-natureza-eja", label: "Ciências da Natureza", icon: "FlaskConical" },
      { id: "ciencias-humanas-eja", label: "Ciências Humanas", icon: "Landmark" },
    ],
    grades: [
      { id: "eja-etapa-1", label: "EJA — Etapa 1", icon: "GraduationCap" },
      { id: "eja-etapa-2", label: "EJA — Etapa 2", icon: "GraduationCap" },
      { id: "eja-ensino-medio", label: "EJA — Ensino Médio", icon: "School" },
    ],
  },
  {
    id: "modalidades-complementares",
    label: "Modalidades Complementares",
    description: "Contextos e abordagens específicas",
    icon: "Sparkles",
    areas: [
      { id: "educacao-especial", label: "Educação Especial e Inclusiva", icon: "Accessibility" },
      { id: "educacao-campo", label: "Educação do Campo", icon: "Sprout" },
      { id: "educacao-indigena", label: "Educação Escolar Indígena", icon: "Trees" },
      { id: "educacao-quilombola", label: "Educação Escolar Quilombola", icon: "Users" },
      { id: "educacao-ambiental", label: "Educação Ambiental", icon: "Leaf" },
    ],
    grades: [
      { id: "infantil-complementar", label: "Educação Infantil", icon: "Baby" },
      { id: "fundamental-i-complementar", label: "Ensino Fundamental I", icon: "BookOpen" },
      { id: "fundamental-ii-complementar", label: "Ensino Fundamental II", icon: "Library" },
      { id: "medio-complementar", label: "Ensino Médio", icon: "School" },
      { id: "eja-complementar", label: "EJA", icon: "UserRoundCheck" },
    ],
  },
]

export const PLANNING_TYPES: PlanningOption[] = [
  { id: "plano-aula", label: "Plano de aula", description: "Uma aula completa e objetiva", icon: "FileText" },
  { id: "sequencia-didatica", label: "Sequência didática", description: "Conjunto articulado de aulas", icon: "ListOrdered" },
  { id: "planejamento-semanal", label: "Planejamento semanal", description: "Organização para uma semana", icon: "CalendarDays" },
  { id: "planejamento-mensal", label: "Planejamento mensal", description: "Visão pedagógica do mês", icon: "CalendarRange" },
  { id: "projeto-pedagogico", label: "Projeto pedagógico", description: "Projeto interdisciplinar", icon: "FolderKanban" },
  { id: "atividade", label: "Atividade", description: "Atividade pronta para aplicar", icon: "ClipboardList" },
  { id: "avaliacao", label: "Avaliação", description: "Instrumento e critérios avaliativos", icon: "ClipboardCheck" },
  { id: "plano-ensino", label: "Plano de ensino", description: "Organização de longo prazo", icon: "NotebookTabs" },
  { id: "outro", label: "Outro", description: "Material personalizado", icon: "PanelsTopLeft" },
]

export interface PlanningSelectionInput {
  stageId: string
  areaId: string
  gradeId: string
  planningTypeId: string
}

export interface ResolvedPlanningSelection extends PlanningSelectionInput {
  stageLabel: string
  areaLabel: string
  gradeLabel: string
  planningTypeLabel: string
}

export function resolvePlanningSelection(
  input: PlanningSelectionInput,
): ResolvedPlanningSelection | null {
  const stage = EDUCATION_STAGES.find((item) => item.id === input.stageId)
  const area = stage?.areas.find((item) => item.id === input.areaId)
  const grade = stage?.grades.find((item) => item.id === input.gradeId)
  const planningType = PLANNING_TYPES.find((item) => item.id === input.planningTypeId)

  if (!stage || !area || !grade || !planningType) return null

  return {
    ...input,
    stageLabel: stage.label,
    areaLabel: area.label,
    gradeLabel: grade.label,
    planningTypeLabel: planningType.label,
  }
}

function normalizeLabel(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
}

function inferLegacyStage(grade: string): EducationStage | undefined {
  const normalizedGrade = normalizeLabel(grade)
  const year = Number(normalizedGrade.match(/^([1-9])/)?.[1])

  if (normalizedGrade.includes("ensino medio") || normalizedGrade.includes("serie")) {
    return EDUCATION_STAGES.find((item) => item.id === "ensino-medio")
  }
  if (normalizedGrade.includes("ensino fundamental")) {
    return EDUCATION_STAGES.find((item) =>
      item.id === (year >= 6 ? "fundamental-ii" : "fundamental-i"),
    )
  }
  return undefined
}

export function findPlanningSelectionIds(values: {
  stage: string
  area: string
  grade: string
  planningType: string
}): PlanningSelectionInput | null {
  const normalizedStage = normalizeLabel(values.stage)
  const stage =
    EDUCATION_STAGES.find((item) => normalizeLabel(item.label) === normalizedStage) ||
    inferLegacyStage(values.grade)
  const area = stage?.areas.find(
    (item) => normalizeLabel(item.label) === normalizeLabel(values.area),
  )
  const normalizedGrade = normalizeLabel(values.grade)
  const grade = stage?.grades.find((item) => {
    const option = normalizeLabel(item.label)
    return option === normalizedGrade || normalizedGrade.startsWith(option)
  })
  const planningType = PLANNING_TYPES.find(
    (item) => normalizeLabel(item.label) === normalizeLabel(values.planningType),
  )

  if (!stage || !area || !grade || !planningType) return null
  return {
    stageId: stage.id,
    areaId: area.id,
    gradeId: grade.id,
    planningTypeId: planningType.id,
  }
}
