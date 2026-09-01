// ---------------------------------------------------------------------------
// FONTE ÚNICA DE VERDADE para alternativas de questões.
//
// A letra da alternativa (A, B, C, ...) é SEMPRE derivada da posição e nunca
// fica embutida no texto. Qualquer formato vindo da IA é normalizado para
// "texto puro" ao entrar no sistema:
//
//   "A) texto"      -> texto
//   "A. texto"      -> texto
//   "(A) texto"     -> texto
//   "A - texto"     -> texto
//   "A: texto"      -> texto
//   "A)texto"       -> texto
//   "texto"         -> texto (sem letra, mantido como está)
//
// Nenhum componente deve usar String.fromCharCode(65 + i) diretamente: use
// alternativeLetter(i) e alternativeMark(i).
// ---------------------------------------------------------------------------

export interface NormalizedAlternative {
  letter: string
  text: string
}

const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ"

export function alternativeLetter(index: number): string {
  if (index < 0) return ""
  let value = index
  let result = ""
  do {
    result = LETTERS[value % 26] + result
    value = Math.floor(value / 26) - 1
  } while (value >= 0)
  return result
}

export function alternativeMark(letter: string): string {
  return `${letter})`
}

/** Remove o marcador de letra do início do texto ("A) ", "A. ", "(A) ", "A - ", "A: ", "A-)…"). */
export function normalizeAlternativeText(raw: unknown): string {
  if (typeof raw !== "string") return ""
  const value = raw.trim()
  if (!value) return ""

  const paren = value.match(/^\(\s*([A-Za-z])\s*\)\s*(.*)$/)
  if (paren) return paren[2].trim()

  const closers = value.match(/^([A-Za-z])\s*[.)]\s*(.*)$/)
  if (closers) return closers[2].trim()

  const dash = value.match(/^([A-Za-z])\s*[-–:]\s*(.*)$/)
  if (dash) return dash[2].trim()

  return value
}

/** Separa letra e texto quando o texto começa com um marcador de letra. */
export function splitAlternativeLetter(raw: unknown): NormalizedAlternative {
  if (typeof raw !== "string") return { letter: "", text: "" }
  const value = raw.trim()
  if (!value) return { letter: "", text: "" }

  const paren = value.match(/^\(\s*([A-Za-z])\s*\)\s*(.*)$/)
  if (paren) return { letter: paren[1].toUpperCase(), text: paren[2].trim() }

  const closers = value.match(/^([A-Za-z])\s*[.)]\s*(.*)$/)
  if (closers) return { letter: closers[1].toUpperCase(), text: closers[2].trim() }

  const dash = value.match(/^([A-Za-z])\s*[-–:]\s*(.*)$/)
  if (dash) return { letter: dash[1].toUpperCase(), text: dash[2].trim() }

  return { letter: "", text: value }
}

/** Normaliza uma lista de alternativas (texto puro) para [{ letter, text }]. */
export function normalizeAlternativeList(items: unknown): NormalizedAlternative[] {
  if (!Array.isArray(items)) return []
  return items.slice(0, 12).map((item, index) => ({
    letter: alternativeLetter(index),
    text: normalizeAlternativeText(typeof item === "string" ? item : ""),
  }))
}

/**
 * Normaliza o valor de "resposta correta" do gabarito.
 * - "A", "a", "A)", "A.", "(A)" -> "A" (letra pura, usada no seletor);
 * - qualquer outro texto (respostas abertas) é mantido intacto.
 */
export function normalizeAnswerLetter(raw: unknown): string {
  if (typeof raw !== "string") return ""
  const value = raw.trim()
  if (!value) return ""

  const letterOnly = value.match(/^\(\s*([A-Za-z])\s*\)\s*[.)\-–:]?\s*$/)
  if (letterOnly) return letterOnly[1].toUpperCase()
  const plain = value.match(/^([A-Za-z])\s*[.)\-–:]?\s*$/)
  if (plain) return plain[1].toUpperCase()

  return value
}
