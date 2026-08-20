export const INCLUSION_MODES = [
  {
    id: "REGULAR",
    label: "Turma regular",
    description: "Aplicar princípios gerais de acessibilidade e DUA para toda a turma.",
    icon: "Users",
  },
  {
    id: "INCLUSIVE_CLASS",
    label: "Turma com necessidades específicas",
    description: "Planejar estratégias para uma ou mais necessidades educacionais.",
    icon: "Accessibility",
  },
  {
    id: "INDIVIDUALIZED",
    label: "Planejamento individualizado",
    description: "Apoio pedagógico direcionado, sem coletar dados pessoais ou emitir diagnóstico.",
    icon: "UserRoundCheck",
  },
] as const

export const INCLUSION_NEEDS = [
  { id: "visual", label: "Deficiência Visual" },
  { id: "low-vision", label: "Baixa Visão" },
  { id: "hearing", label: "Deficiência Auditiva" },
  { id: "deafness", label: "Surdez" },
  { id: "physical", label: "Deficiência Física" },
  { id: "intellectual", label: "Deficiência Intelectual" },
  { id: "multiple", label: "Deficiência Múltipla" },
  { id: "autism", label: "Transtorno do Espectro Autista (TEA)" },
  { id: "gifted", label: "Altas Habilidades/Superdotação" },
  { id: "other", label: "Outras necessidades educacionais específicas" },
] as const

export const ACCESSIBILITY_RESOURCE_GROUPS = [
  {
    id: "visual",
    label: "Acesso visual e multissensorial",
    resources: [
      ["large-text", "Texto ampliado"],
      ["high-contrast", "Alto contraste"],
      ["braille", "Braille"],
      ["audio-description", "Audiodescrição"],
      ["screen-reader", "Leitor de tela"],
      ["tactile-materials", "Materiais táteis"],
      ["sound-resources", "Recursos sonoros"],
    ],
  },
  {
    id: "hearing",
    label: "Acesso auditivo e comunicação",
    resources: [
      ["libras", "Libras"],
      ["captions", "Legendas"],
      ["visual-resources", "Recursos visuais"],
      ["captioned-video", "Vídeos legendados"],
      ["written-instructions", "Instruções escritas"],
    ],
  },
  {
    id: "physical",
    label: "Acesso físico e motor",
    resources: [
      ["assistive-technology", "Tecnologia assistiva"],
      ["adapted-materials", "Adaptação de materiais"],
      ["space-adjustment", "Adequação do espaço"],
      ["motor-demand-reduction", "Redução de exigência motora"],
    ],
  },
  {
    id: "cognitive",
    label: "Apoio cognitivo",
    resources: [
      ["objective-language", "Linguagem objetiva"],
      ["step-by-step", "Divisão da atividade em etapas"],
      ["concrete-examples", "Exemplos concretos"],
      ["cognitive-visuals", "Recursos visuais"],
      ["repetition", "Repetição e reforço"],
    ],
  },
  {
    id: "autism",
    label: "Estrutura e previsibilidade",
    resources: [
      ["visual-routine", "Rotina visual"],
      ["direct-instructions", "Instruções objetivas"],
      ["anticipation", "Antecipação"],
      ["visual-support", "Apoio visual"],
      ["stimulus-reduction", "Redução de estímulos"],
      ["structured-activities", "Atividades estruturadas"],
    ],
  },
  {
    id: "gifted",
    label: "Enriquecimento",
    resources: [
      ["curricular-enrichment", "Enriquecimento curricular"],
      ["deepening", "Aprofundamento"],
      ["additional-challenges", "Desafios adicionais"],
      ["research-projects", "Projetos de pesquisa"],
    ],
  },
] as const

export const PEDAGOGICAL_PROFILE_FIELDS = [
  ["strengths", "Pontos fortes"],
  ["interests", "Interesses"],
  ["facilities", "Facilidades"],
  ["observedDifficulties", "Dificuldades observadas"],
  ["communication", "Forma de comunicação"],
  ["effectiveResources", "Recursos que funcionam melhor"],
  ["avoidStrategies", "Estratégias que devem ser evitadas"],
  ["observations", "Observações pedagógicas"],
] as const

export type InclusionModeId = (typeof INCLUSION_MODES)[number]["id"]
export type PedagogicalProfile = Partial<
  Record<(typeof PEDAGOGICAL_PROFILE_FIELDS)[number][0], string>
>

export function isInclusionMode(value: unknown): value is InclusionModeId {
  return INCLUSION_MODES.some((item) => item.id === value)
}

export function resolveNeedLabels(ids: string[]): string[] | null {
  const unique = [...new Set(ids)]
  const labels = unique.map((id) => INCLUSION_NEEDS.find((item) => item.id === id)?.label)
  return labels.every(Boolean) ? (labels as string[]) : null
}

export function allAccessibilityResources() {
  return ACCESSIBILITY_RESOURCE_GROUPS.flatMap((group) =>
    group.resources.map(([id, label]) => ({ id, label, group: group.label })),
  )
}

export function resolveResourceLabels(ids: string[]): string[] | null {
  const resources = allAccessibilityResources()
  const unique = [...new Set(ids)]
  const labels = unique.map((id) => resources.find((item) => item.id === id)?.label)
  return labels.every(Boolean) ? (labels as string[]) : null
}

export function sanitizePedagogicalProfile(value: unknown): PedagogicalProfile | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {}
  const record = value as Record<string, unknown>
  const result: PedagogicalProfile = {}

  for (const [key] of PEDAGOGICAL_PROFILE_FIELDS) {
    const field = record[key]
    if (typeof field === "string" && field.trim()) result[key] = field.trim().slice(0, 500)
  }

  return result
}
