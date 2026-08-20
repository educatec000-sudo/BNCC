export const IMAGE_MODES = [
  { id: "NONE", label: "Não gerar imagens", description: "Material somente textual." },
  { id: "WHEN_NEEDED", label: "Gerar automaticamente quando necessário", description: "Somente quando a imagem for essencial à compreensão." },
  { id: "USEFUL", label: "Gerar imagens sempre que forem úteis", description: "Prioriza recursos visuais com função pedagógica." },
  { id: "WHEN_POSSIBLE", label: "Gerar imagens sempre que possível", description: "Inclui mais recursos visuais, respeitando o limite do plano." },
] as const

export const IMAGE_STYLES = [
  { id: "EDUCATIONAL", label: "Educacional" },
  { id: "CHILDREN_ILLUSTRATION", label: "Infantil" },
  { id: "ILLUSTRATION", label: "Ilustração" },
  { id: "REALISTIC", label: "Realista" },
  { id: "DRAWING", label: "Desenho" },
  { id: "INFOGRAPHIC", label: "Infográfico" },
  { id: "COLORING_PAGE", label: "Desenho para colorir" },
  { id: "ACCESSIBLE_INCLUSIVE", label: "Acessível/inclusivo" },
] as const

export type ImageModeId = (typeof IMAGE_MODES)[number]["id"]
export type ImageStyleId = (typeof IMAGE_STYLES)[number]["id"]

export function isImageMode(value: unknown): value is ImageModeId {
  return IMAGE_MODES.some((item) => item.id === value)
}

export function isImageStyle(value: unknown): value is ImageStyleId {
  return IMAGE_STYLES.some((item) => item.id === value)
}

export function imageModeLimit(mode: ImageModeId): number {
  if (mode === "NONE") return 0
  if (mode === "WHEN_NEEDED") return 2
  if (mode === "USEFUL") return 3
  return 4
}

export function imageStyleLabel(style: ImageStyleId): string {
  return IMAGE_STYLES.find((item) => item.id === style)?.label || "Educacional"
}
