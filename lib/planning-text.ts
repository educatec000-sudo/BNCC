const LABELS: Record<string, string> = {
  materialType: "Tipo interno",
  metadata: "Identificação",
  assunto: "Assunto",
  habilidadesBncc: "Habilidades BNCC",
  competenciasGerais: "Competências Gerais",
  inclusaoAcessibilidade: "Inclusão e Acessibilidade",
  principiosDua: "Princípios do DUA",
  acaoExpressao: "Ação e expressão",
  avaliacaoAdaptada: "Avaliação adaptada",
  criteriosAvaliacao: "Critérios de avaliação",
  camposIdentificacao: "Campos de identificação",
  quantidadeQuestoes: "Quantidade de questões",
  tipoAvaliacao: "Tipo de avaliação",
  numeroAulas: "Número de aulas",
  objetivoGeral: "Objetivo geral",
  objetivosEspecificos: "Objetivos específicos",
  recursosGerais: "Recursos gerais",
  avaliacaoFinal: "Avaliação final",
  temaSemana: "Tema da semana",
  objetivoSemanal: "Objetivo semanal",
  objetivosMes: "Objetivos do mês",
  mesReferencia: "Mês de referência",
  avaliacaoMensal: "Avaliação mensal",
  publicoAlvo: "Público-alvo",
  areasEnvolvidas: "Áreas envolvidas",
  produtoFinal: "Produto final",
  periodoLetivo: "Período letivo",
  metodologiaGeral: "Metodologia geral",
  formatoIdentificado: "Formato identificado",
}

function labelFor(key: string): string {
  if (LABELS[key]) return LABELS[key]
  return key
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/^./, (letter) => letter.toUpperCase())
}

function walk(value: unknown, lines: string[], depth = 0, key?: string) {
  const prefix = "  ".repeat(depth)
  if (value === null || value === undefined || value === "") return

  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    lines.push(`${prefix}${key ? `${labelFor(key)}: ` : ""}${String(value)}`)
    return
  }

  if (Array.isArray(value)) {
    if (key) lines.push(`${prefix}${labelFor(key)}:`)
    value.forEach((item, index) => {
      if (typeof item === "object" && item !== null) {
        lines.push(`${prefix}${index + 1}.`)
        walk(item, lines, depth + 1)
      } else {
        lines.push(`${prefix}• ${String(item)}`)
      }
    })
    return
  }

  if (typeof value === "object") {
    if (key) lines.push(`${prefix}${labelFor(key)}:`)
    for (const [childKey, childValue] of Object.entries(value as Record<string, unknown>)) {
      if (childKey === "materialType") continue
      walk(childValue, lines, key ? depth + 1 : depth, childKey)
    }
  }
}

export function planningContentToText(content: unknown): string {
  const lines: string[] = []
  walk(content, lines)
  return lines.join("\n")
}
