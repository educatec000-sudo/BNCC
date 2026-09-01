import type { EditorDocument, EditorElement } from "@/lib/editor-document"

/** O documento usa duas colunas (modo simulado)? */
export function isTwoColumns(document: EditorDocument): boolean {
  return document.page.columns === "two"
}

/** Largura/altura de página em milímetros (A4 ou Carta). */
export function pageDimensionsMm(document: EditorDocument): { width: number; height: number } {
  if (document.page.orientation === "landscape") {
    return document.page.size === "LETTER" ? { width: 279, height: 216 } : { width: 297, height: 210 }
  }
  return document.page.size === "LETTER" ? { width: 216, height: 279 } : { width: 210, height: 297 }
}

/** Converte milímetros para pixels CSS (96 dpi). */
export function mmToPx(mm: number): number {
  return (mm * 96) / 25.4
}

export type QuestionElement = Extract<EditorElement, { type: "question" }>

/** Agrupa elementos em blocos de largura total e trechos de questões consecutivas. */
export type ColumnGroup =
  | { kind: "full"; element: EditorElement }
  | { kind: "questions"; questions: QuestionElement[] }

export function groupSectionElements(elements: EditorElement[]): ColumnGroup[] {
  const groups: ColumnGroup[] = []
  let questions: QuestionElement[] = []
  const flush = () => {
    if (questions.length > 0) {
      groups.push({ kind: "questions", questions })
      questions = []
    }
  }
  for (const element of elements) {
    if (element.type === "question") {
      questions.push(element)
    } else {
      flush()
      groups.push({ kind: "full", element })
    }
  }
  flush()
  return groups
}

/** Bloco mensurável para paginação (altura em px, dentro da área de conteúdo). */
export interface LayoutBlock {
  key: string
  height: number
  /** Força nova página antes deste bloco (ex.: quebra de página, seções). */
  breakBefore?: boolean
}

/** Distribui blocos em páginas de altura fixa sem quebrar um bloco no meio. */
export function paginateBlocks(blocks: LayoutBlock[], pageHeight: number): number[][] {
  const pages: number[][] = []
  let current: number[] = []
  let used = 0
  for (let index = 0; index < blocks.length; index++) {
    const block = blocks[index]
    const height = Math.min(block.height, pageHeight)
    if (current.length > 0 && (block.breakBefore || used + height > pageHeight)) {
      pages.push(current)
      current = []
      used = 0
    }
    current.push(index)
    used += height
    if (block.height > pageHeight) used = pageHeight
  }
  if (current.length > 0) pages.push(current)
  return pages
}

/** Item com altura estimada/medida, para o motor de colunas. */
export interface ColumnItem {
  id: string
  height: number
}

/**
 * Distribui itens em duas colunas com FLUXO VERTICAL INDEPENDENTE, preservando a
 * ordem numérica. A leitura segue o estilo jornal/prova: coluna esquerda de cima
 * para baixo e depois coluna direita — nunca intercala nem emparelha em linhas
 * fixas. A divisão é CONTÍGUA (o prefixo vai para a esquerda, o sufixo para a
 * direita) e BALANCEADA pela altura real de cada item, minimizando a diferença
 * entre as duas colunas para eliminar buracos e colunas subutilizadas.
 *
 * Um item mais alto que uma coluna inteira nunca é esmagado nem dividido: ocupa
 * uma coluna sozinho (e, se for maior que a página, a própria paginação o isola).
 *
 * @param columnHeight altura útil de uma coluna (px).
 * @param firstColumnHeight altura útil das colunas da PRIMEIRA página (quando as
 *   colunas começam abaixo de conteúdo de largura total, essa altura é menor).
 */
export function layoutQuestionColumns(
  items: ColumnItem[],
  columnHeight: number,
  firstColumnHeight: number = columnHeight,
): ColumnItem[][][] {
  const pages: ColumnItem[][][] = []
  let index = 0
  let cap = Math.max(1, Math.min(firstColumnHeight, columnHeight))
  while (index < items.length) {
    const pageCap = cap
    // Enche esta página (duas colunas) com o máximo de itens que couber.
    let end = index
    let sum = 0
    while (end < items.length) {
      const height = Math.min(items[end].height, columnHeight)
      if (end > index && sum + height > 2 * pageCap + 1e-6) break
      sum += height
      end++
    }
    // Divide itens[index..end) em duas colunas contíguas equilibradas por altura.
    const slice = items.slice(index, end)
    const prefix: number[] = [0]
    for (const item of slice) prefix.push(prefix[prefix.length - 1] + Math.min(item.height, columnHeight))
    const total = prefix[prefix.length - 1]
    let bestK = 0
    let bestDiff = Number.POSITIVE_INFINITY
    for (let k = 0; k <= slice.length; k++) {
      const leftSum = prefix[k]
      const rightSum = total - leftSum
      const leftOk = leftSum <= pageCap + 1e-6 || (k === 1 && leftSum <= columnHeight + 1e-6)
      const rightOk = rightSum <= pageCap + 1e-6 || (slice.length - k === 1 && rightSum <= columnHeight + 1e-6)
      if (!leftOk || !rightOk) continue
      const diff = Math.abs(leftSum - rightSum)
      // Em empate, prefere a esquerda mais cheia (ordem de leitura natural).
      if (diff < bestDiff - 1e-6 || (diff <= bestDiff + 1e-6 && k > bestK)) {
        bestDiff = diff
        bestK = k
      }
    }
    pages.push([slice.slice(0, bestK), slice.slice(bestK)])
    index = end
    cap = columnHeight
  }
  return pages
}

/** Bloco do fluxo do documento: largura total ou questão (entra nas colunas). */
export interface FlowBlock {
  kind: "full" | "question"
  id: string
  height: number
  breakBefore?: boolean
}

/** Página montada: blocos de largura total no topo e até 2 colunas de questões. */
export interface FlowPage {
  full: FlowBlock[]
  columns: FlowBlock[][]
}

/**
 * Monta as páginas do documento no modo duas colunas. Blocos de largura total
 * (cabeçalho, título, instruções, tabelas, imagens avulsas…) são paginados
 * normalmente; trechos de questões consecutivas entram nas duas colunas com
 * fluxo vertical independente, começando logo abaixo do último bloco de largura
 * total (na mesma página, se houver espaço) e continuando nas páginas seguintes.
 */
export function layoutFlow(blocks: FlowBlock[], pageHeight: number): FlowPage[] {
  const pages: FlowPage[] = []
  let current: FlowPage = { full: [], columns: [] }
  let currentUsed = 0

  const newPage = (): FlowPage => ({ full: [], columns: [] })
  const pushCurrent = () => {
    if (current.full.length > 0 || current.columns.length > 0) pages.push(current)
    current = newPage()
    currentUsed = 0
  }

  let index = 0
  while (index < blocks.length) {
    const block = blocks[index]
    if (block.kind === "full") {
      const height = Math.min(block.height, pageHeight)
      if (current.columns.length > 0) pushCurrent()
      if (block.breakBefore && (current.full.length > 0 || currentUsed > 0)) pushCurrent()
      if (current.full.length > 0 && currentUsed + height > pageHeight + 1e-6) pushCurrent()
      current.full.push(block)
      currentUsed += height
      index++
      continue
    }

    // Trecho de questões consecutivas.
    const run: FlowBlock[] = []
    while (index < blocks.length && blocks[index].kind === "question") {
      run.push(blocks[index])
      index++
    }
    if (run.length === 0) continue

    let firstColumnHeight = pageHeight - currentUsed
    // Se a primeira questão não cabe na coluna restante da página atual (ex.: logo
    // após instruções), ela e o trecho inteiro vão para a página seguinte.
    const firstQuestionFits = Math.min(run[0].height, pageHeight) <= firstColumnHeight + 1e-6
    if (current.full.length > 0 && (!firstQuestionFits || firstColumnHeight < 1)) {
      pushCurrent()
      firstColumnHeight = pageHeight
    }
    const runById = new Map(run.map((item) => [item.id, item]))
    const toFlow = (columns: ColumnItem[][]): FlowBlock[][] =>
      columns.map((column) => column.map((item) => runById.get(item.id)!))
    const columnPages = layoutQuestionColumns(
      run.map((item) => ({ id: item.id, height: item.height })),
      pageHeight,
      Math.max(1, firstColumnHeight),
    )
    current.columns = toFlow(columnPages[0])
    pushCurrent()
    for (let page = 1; page < columnPages.length; page++) {
      pages.push({ full: [], columns: toFlow(columnPages[page]) })
    }
  }
  pushCurrent()
  return pages
}

/** Estimativa de altura (px) de uma questão para o PDF (que não mede o DOM). */
export function estimateQuestionHeight(element: EditorElement): number {
  if (element.type !== "question") return 60
  const text = element.content.replace(/<[^>]+>/g, "").trim()
  const charsPerLine = 42
  const textLines = Math.max(1, Math.ceil(text.length / charsPerLine))
  const alternativeLines = element.alternatives.reduce((total, alternative) => {
    const length = alternative.content.replace(/<[^>]+>/g, "").trim().length
    return total + Math.max(1, Math.ceil(length / (charsPerLine - 3)))
  }, 0)
  const imageHeight = element.images.reduce((total, image) => total + 150 * (image.widthPercent / 100), 0)
  const responseLines = element.responseLines * 18
  return textLines * 17 + alternativeLines * 17 + imageHeight + responseLines + 34
}

/** Estimativa de altura (px) de qualquer elemento para o PDF. */
export function estimateElementHeight(element: EditorElement, document: EditorDocument): number {
  const lineHeight = document.page.lineHeight
  const fontPx = document.page.defaultFontSize * 1.35
  switch (element.type) {
    case "question":
      return estimateQuestionHeight(element)
    case "heading":
      return (element.level === 1 ? 26 : element.level === 2 ? 22 : 18) + 10
    case "paragraph":
    case "instruction":
    case "textBox": {
      const text = element.content.replace(/<[^>]+>/g, "").trim()
      const lines = Math.max(1, Math.ceil(text.length / 90))
      const padding = element.type === "paragraph" ? 0 : 16
      return lines * fontPx * lineHeight + padding + 10
    }
    case "list":
      return element.items.reduce((total, item) => {
        const lines = Math.max(1, Math.ceil(item.replace(/<[^>]+>/g, "").length / 80))
        return total + lines * fontPx * lineHeight + 4
      }, 0) + 8
    case "table":
      return (element.rows.length + (element.headers.length > 0 ? 1 : 0)) * 20 + 12
    case "image":
      return 180 * (element.widthPercent / 100) + 12
    case "responseSpace":
      return element.lines * 20 + 8
    case "separator":
      return 16
    case "pageBreak":
      return 0
  }
}
