// ---------------------------------------------------------------------------
// FONTE ÚNICA para detectar campos de identificação (cabeçalho/formulário)
// que a IA possa gerar DENTRO do conteúdo pedagógico.
//
// A aplicação já possui um cabeçalho principal gerenciado pelo editor
// (Nome da Escola, Aluno(a), Data, Turma, Professor(a), Disciplina, Série/Ano,
// Assunto). A IA NÃO deve gerar outro cabeçalho no conteúdo.
//
// A detecção é conservadora: só remove linhas que sejam claramente
// "rótulo: preenchimento" (underscores/espacos/traços) ou "rótulo:" vazio.
// Texto pedagógico legítimo permanece intacto:
//   - "Em 15 de agosto de 2026, ocorreu..."          → MANTIDO
//   - "Data: 15/08/2026"                              → MANTIDO (tem valor real)
//   - "Nome do Estudante: ______"                     → REMOVIDO
//   - "Turma: ________"                               → REMOVIDO
// ---------------------------------------------------------------------------

const IDENTIFICATION_LABELS = new Set([
  "nome do estudante",
  "nome da estudante",
  "nome do aluno",
  "nome da aluna",
  "nome do(a) aluno(a)",
  "nome do (a) aluno (a)",
  "nome do educando",
  "aluno",
  "aluna",
  "aluno(a)",
  "aluno (a)",
  "nome",
  "turma",
  "série",
  "serie",
  "ano",
  "série/ano",
  "serie/ano",
  "data",
  "professor",
  "professora",
  "professor(a)",
  "professor (a)",
  "nome da escola",
  "escola",
  "disciplina",
  "matéria",
  "materia",
  "assunto",
])

function normalizeLabel(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/\s*\(\s*/g, "(")
    .replace(/\s*\)\s*/g, ")")
    .trim()
}

/** Só caracteres de "preenchimento" (traço/underline/espaco/ponto) ou vazio. */
const FILL_ONLY = /^[\s_.\-–—]*$/

function fillPart(value: string): boolean {
  return FILL_ONLY.test(value)
}

/** "Nome do Estudante: ______", "Turma:", "Professor(a): ________" etc. */
export function isIdentificationFieldSegment(segment: string): boolean {
  const cleaned = segment.trim()
  if (!cleaned) return false

  const colonIndex = cleaned.indexOf(":")
  let label: string
  let rest: string

  if (colonIndex >= 0) {
    label = cleaned.slice(0, colonIndex)
    rest = cleaned.slice(colonIndex + 1)
  } else {
    // Sem dois-pontos: "Nome do Estudante ________"
    const match = cleaned.match(/^([^_\-–—.\d][^_\-–—.]{0,40}?)\s+([_\-–—.\s]+)$/)
    if (!match) return false
    label = match[1]
    rest = match[2]
  }

  if (!IDENTIFICATION_LABELS.has(normalizeLabel(label))) return false
  return fillPart(rest)
}

/** Uma linha inteira que seja um campo de identificação (ou vários separados por espaços). */
export function isIdentificationFillLine(line: string): boolean {
  const cleaned = line.trim()
  if (!cleaned) return false
  if (isIdentificationFieldSegment(cleaned)) return true

  // Vários campos na mesma linha: "Nome: ____    Turma: ____    Data: ____"
  const segments = cleaned.split(/\s{2,}/).filter(Boolean)
  return segments.length > 1 && segments.every(isIdentificationFieldSegment)
}

/** Remove linhas de identificação de um texto simples (antes de salvar). */
export function stripIdentificationLines(text: string): string {
  if (typeof text !== "string") return ""
  return text
    .split(/\r?\n/)
    .filter((line) => !isIdentificationFillLine(line))
    .join("\n")
}

/** Remove linhas de identificação de HTML sanitizado (migração de documentos antigos). */
export function stripIdentificationLinesFromHtml(html: string): string {
  if (typeof html !== "string") return ""
  return html
    .split(/<br\s*\/?\s*>/i)
    .filter((part) => {
      const text = part
        .replace(/<[^>]*>/g, " ")
        .replace(/&nbsp;/gi, " ")
        .replace(/&amp;/gi, "&")
      return !isIdentificationFillLine(text)
    })
    .join("<br>")
}
