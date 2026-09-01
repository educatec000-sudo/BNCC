import {
  headerFieldMetrics,
  headerFieldRows,
  plainTextFromHtml,
  type EditorDocument,
  type EditorElement,
} from "@/lib/editor-document"

/** O documento usa duas colunas (modo simulado)? */
export function isTwoColumns(document: EditorDocument): boolean {
  return document.page.columns === "two"
}

/**
 * Geometria REAL da página A4/Carta — a FONTE ÚNICA DE VERDADE de medidas para
 * o Editor, Preview, Impressão e PDF. As margens fazem parte do modelo de página
 * e são descontadas ANTES de calcular a área útil e a largura das colunas:
 *
 *   usable = página − margem esquerda − margem direita
 *   coluna = (usable − espaçamento entre colunas) / 2
 */
export interface PageGeometry {
  pageWidthMm: number
  pageHeightMm: number
  pageWidthPx: number
  pageHeightPx: number
  marginTopMm: number
  marginRightMm: number
  marginBottomMm: number
  marginLeftMm: number
  marginTopPx: number
  marginRightPx: number
  marginBottomPx: number
  marginLeftPx: number
  /** Área útil (px): página menos as margens. */
  usableWidthPx: number
  usableHeightPx: number
  columnGapMm: number
  columnGapPx: number
  /** Largura de cada coluna no modo duas colunas (ou a área útil em uma coluna). */
  columnWidthPx: number
}

export function pageGeometry(document: EditorDocument): PageGeometry {
  const { width: pageWidthMm, height: pageHeightMm } = pageDimensionsMm(document)
  const pageWidthPx = mmToPx(pageWidthMm)
  const pageHeightPx = mmToPx(pageHeightMm)
  const marginTopMm = document.page.marginTop
  const marginRightMm = document.page.marginRight
  const marginBottomMm = document.page.marginBottom
  const marginLeftMm = document.page.marginLeft
  const marginTopPx = mmToPx(marginTopMm)
  const marginRightPx = mmToPx(marginRightMm)
  const marginBottomPx = mmToPx(marginBottomMm)
  const marginLeftPx = mmToPx(marginLeftMm)
  const usableWidthPx = Math.max(1, pageWidthPx - marginLeftPx - marginRightPx)
  const usableHeightPx = Math.max(1, pageHeightPx - marginTopPx - marginBottomPx)
  const columnGapMm = document.page.columnGap ?? 8
  const columnGapPx = mmToPx(columnGapMm)
  const columnWidthPx = isTwoColumns(document)
    ? Math.max(1, (usableWidthPx - columnGapPx) / 2)
    : usableWidthPx
  return {
    pageWidthMm,
    pageHeightMm,
    pageWidthPx,
    pageHeightPx,
    marginTopMm,
    marginRightMm,
    marginBottomMm,
    marginLeftMm,
    marginTopPx,
    marginRightPx,
    marginBottomPx,
    marginLeftPx,
    usableWidthPx,
    usableHeightPx,
    columnGapMm,
    columnGapPx,
    columnWidthPx,
  }
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

/** Página montada: blocos de largura total no topo, até 2 colunas de questões e
 *  blocos de largura total que CONTINUAM abaixo das colunas na mesma página. */
export interface FlowPage {
  full: FlowBlock[]
  columns: FlowBlock[][]
  after: FlowBlock[]
}

/**
 * Monta as páginas do documento no modo duas colunas. Blocos de largura total
 * (cabeçalho, título, instruções, tabelas, imagens avulsas…) são paginados
 * normalmente; trechos de questões consecutivas entram nas duas colunas com
 * fluxo vertical independente, começando logo abaixo do último bloco de largura
 * total (na mesma página, se houver espaço) e continuando nas páginas seguintes.
 * Blocos de largura total que vêm DEPOIS das colunas (ex.: tabela de habilidades
 * BNCC, gabarito) continuam na MESMA página, abaixo das colunas, se couberem —
 * a quebra só acontece quando o conteúdo atinge o fim da área útil.
 */
export function layoutFlow(blocks: FlowBlock[], pageHeight: number): FlowPage[] {
  const pages: FlowPage[] = []
  let current: FlowPage = { full: [], columns: [], after: [] }
  let currentUsed = 0

  const newPage = (): FlowPage => ({ full: [], columns: [], after: [] })
  const isEmpty = (page: FlowPage) => page.full.length === 0 && page.columns.length === 0 && page.after.length === 0
  const pushCurrent = () => {
    if (!isEmpty(current)) pages.push(current)
    current = newPage()
    currentUsed = 0
  }

  let index = 0
  while (index < blocks.length) {
    const block = blocks[index]
    if (block.kind === "full") {
      const height = Math.min(block.height, pageHeight)
      if (block.breakBefore && !isEmpty(current)) pushCurrent()
      if (current.columns.length > 0) {
        // Continua ABAIXO das colunas na mesma página, se couber.
        if (currentUsed + height <= pageHeight + 1e-6) {
          current.after.push(block)
          currentUsed += height
        } else {
          pushCurrent()
          current.full.push(block)
          currentUsed += height
        }
      } else {
        if (current.full.length > 0 && currentUsed + height > pageHeight + 1e-6) pushCurrent()
        current.full.push(block)
        currentUsed += height
      }
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

    // Se a página atual já tem uma região de colunas, novas questões começam em
    // nova página (uma única região de colunas por página).
    if (current.columns.length > 0) pushCurrent()

    let firstColumnHeight = pageHeight - currentUsed
    // Se a primeira questão não cabe na coluna restante da página atual (ex.: logo
    // após instruções), ela e o trecho inteiro vão para a página seguinte.
    const firstQuestionFits = Math.min(run[0].height, pageHeight) <= firstColumnHeight + 1e-6
    if ((current.full.length > 0 || current.after.length > 0) && (!firstQuestionFits || firstColumnHeight < 1)) {
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
    const columnsHeight = (columns: ColumnItem[][]) =>
      Math.max(
        columns[0]?.reduce((sum, item) => sum + item.height, 0) ?? 0,
        columns[1]?.reduce((sum, item) => sum + item.height, 0) ?? 0,
      )
    current.columns = toFlow(columnPages[0])
    currentUsed += columnsHeight(columnPages[0])

    if (columnPages.length > 1) {
      // Fecha a página atual (cabeçalho + primeira leva de colunas) ANTES das
      // páginas de continuação, preservando a ordem de leitura.
      pushCurrent()
      // Páginas intermediárias (fechadas).
      for (let page = 1; page < columnPages.length - 1; page++) {
        pages.push({ full: [], columns: toFlow(columnPages[page]), after: [] })
      }
      // A ÚLTIMA página de colunas fica ABERTA: blocos de largura total
      // posteriores (tabela BNCC, gabarito) entram em `after`, abaixo das colunas.
      const last = columnPages[columnPages.length - 1]
      current = { full: [], columns: toFlow(last), after: [] }
      currentUsed = columnsHeight(last)
    }
    // Se coube tudo em uma página, `current` permanece aberta para `after`.
  }
  pushCurrent()
  return pages
}

/**
 * Estimativa de altura (px) de uma questão para o PDF/Impressão (que não medem o
 * DOM). `linePx` é a altura de uma linha no documento (fonte × entrelinha), e
 * `charsPerLine` o número de caracteres por linha na largura da coluna.
 */
export function estimateQuestionHeight(element: EditorElement, charsPerLine = 42, linePx = 17): number {
  if (element.type !== "question") return 60
  const text = element.content.replace(/<[^>]+>/g, "").trim()
  const textLines = Math.max(1, Math.ceil(text.length / charsPerLine))
  const alternativeLines = element.alternatives.reduce((total, alternative) => {
    const length = alternative.content.replace(/<[^>]+>/g, "").trim().length
    return total + Math.max(1, Math.ceil(length / Math.max(12, charsPerLine - 3)))
  }, 0)
  const imageHeight = element.images.reduce((total, image) => total + 150 * (image.widthPercent / 100), 0)
  const responseLines = element.responseLines * linePx * 1.2
  return textLines * linePx + alternativeLines * linePx + imageHeight + responseLines + 34
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

/** Altura estimada (px) do bloco de cabeçalho visível (título + campos). */
function headerBlockHeightPx(document: EditorDocument): number {
  const fields = document.header.fields.filter((field) => field.visible)
  if (fields.length === 0) return 0
  const rows = headerFieldRows(fields)
  const total = rows.reduce((sum, row) => {
    const metrics = headerFieldMetrics(row[0], document.header.layout || "normal")
    return sum + metrics.minHeight + metrics.spacingAfter
  }, 0)
  // minHeight/spacingAfter estão em pt; converte para px (1pt = 4/3 px).
  return Math.round(total * (4 / 3)) + 18
}

/** Altura estimada (px) do gabarito derivado. */
function gabaritoBlockHeightPx(questions: QuestionElement[]): number {
  if (questions.length === 0) return 0
  const body = questions.reduce((sum, question) => {
    const justification = plainTextFromHtml(question.justification || "").trim()
    const lines = Math.max(1, Math.ceil(justification.length / 70))
    return sum + 18 + lines * 14
  }, 0)
  return body + 26
}

/** Bloco do fluxo com altura estimada (px) — a entrada comum de paginação. */
export interface FlowBlockSpec {
  kind: "full" | "question"
  id: string
  height: number
  breakBefore: boolean
}

/**
 * Constrói o fluxo paginável do documento (título → cabeçalho → seções →
 * gabarito) com alturas ESTIMADAS em px. É a FONTE ÚNICA DE VERDADE usada por
 * Preview, Impressão e PDF (o Editor usa o mesmo layoutFlow, mas com alturas
 * medidas no DOM). Aplica:
 *  - questão em uma coluna quando a seção é pedagógica;
 *  - ÚNICA quebra obrigatória antes da PRIMEIRA seção pedagógica;
 *  - gabarito derivado no mesmo fluxo pedagógico.
 */
export function buildFlowSpec(document: EditorDocument, geometry: PageGeometry = pageGeometry(document)): FlowBlockSpec[] {
  const twoColumns = isTwoColumns(document)
  const fontSize = document.page.defaultFontSize || 11
  const lineHeight = document.page.lineHeight || 1.5
  // Altura real de uma linha (px): fonte em pt → px (96 dpi) × entrelinha.
  const linePx = fontSize * (96 / 72) * lineHeight
  // Largura média de um caractere (~0,5em) na fonte do documento.
  const charPx = fontSize * 0.5 * (96 / 72)
  const columnContentWidth = twoColumns ? geometry.columnWidthPx : geometry.usableWidthPx
  const charsPerLine = Math.max(20, Math.floor(columnContentWidth / charPx))
  // Margem de segurança: as alturas estimadas são levemente infladas para que a
  // paginação nunca estoure a área útil (nunca corta questão nem desloca o fluxo).
  const SAFETY_FULL = 1.15
  const SAFETY_QUESTION = 1.12
  const cap = geometry.usableHeightPx
  const fullHeight = (height: number) => Math.min(cap, Math.round(height * SAFETY_FULL))
  const questionHeight = (question: EditorElement) =>
    Math.min(cap, Math.round(estimateQuestionHeight(question, charsPerLine, linePx) * SAFETY_QUESTION))
  const blocks: FlowBlockSpec[] = []

  blocks.push({ kind: "full", id: "__title__", height: fullHeight(40), breakBefore: false })
  if (document.subtitle) blocks.push({ kind: "full", id: "__subtitle__", height: fullHeight(30), breakBefore: false })
  const headerHeight = headerBlockHeightPx(document)
  if (headerHeight > 0) blocks.push({ kind: "full", id: "__header__", height: fullHeight(headerHeight), breakBefore: false })

  const pedagogicalBreakEnabled = document.page.pedagogicalPageBreakBefore !== false
  let pendingBreak = false
  let pedagogicalStarted = false

  for (const section of document.sections) {
    const isPedagogical = section.kind === "pedagogical"
    const isFirstPedagogical = isPedagogical && !pedagogicalStarted
    if (isPedagogical) pedagogicalStarted = true
    const forceBreak = isFirstPedagogical && pedagogicalBreakEnabled
    const titleVisible = plainTextFromHtml(section.title).trim().length > 0
    const sectionBreak: boolean = section.pageBreakBefore === true || pendingBreak || forceBreak
    if (titleVisible) {
      blocks.push({ kind: "full", id: `section-title-${section.id}`, height: fullHeight(32), breakBefore: sectionBreak })
      pendingBreak = false
    } else {
      pendingBreak = sectionBreak
    }
    for (const group of groupSectionElements(section.elements)) {
      if (group.kind === "full") {
        if (group.element.type === "pageBreak") {
          pendingBreak = true
          continue
        }
        blocks.push({
          kind: "full",
          id: group.element.id,
          height: fullHeight(estimateElementHeight(group.element, document)),
          breakBefore: pendingBreak,
        })
        pendingBreak = false
      } else if (twoColumns && !isPedagogical) {
        for (const question of group.questions) {
          blocks.push({
            kind: "question",
            id: question.id,
            height: questionHeight(question),
            breakBefore: pendingBreak,
          })
          pendingBreak = false
        }
      } else {
        for (const question of group.questions) {
          blocks.push({
            kind: "full",
            id: question.id,
            height: fullHeight(estimateQuestionHeight(question, charsPerLine, linePx)),
            breakBefore: pendingBreak,
          })
          pendingBreak = false
        }
      }
    }
  }

  const gabarito = document.sections.flatMap((section) =>
    section.elements.filter(
      (element): element is QuestionElement =>
        element.type === "question" && Boolean(element.answer || element.justification),
    ),
  )
  if (gabarito.length > 0) {
    const isFirstPedagogical = !pedagogicalStarted
    const forceBreak = isFirstPedagogical && pedagogicalBreakEnabled
    blocks.push({
      kind: "full",
      id: "__gabarito__",
      height: fullHeight(gabaritoBlockHeightPx(gabarito)),
      breakBefore: pendingBreak || forceBreak,
    })
  }

  return blocks
}
