import { imageStyleLabel, type ImageStyleId } from "@/lib/image-options"

export function buildEducationalImagePrompt(input: {
  basePrompt: string
  topic: string
  educationStage: string
  grade: string
  style: ImageStyleId
  coloringPage: boolean
  accessible: boolean
  inclusionNeeds: string[]
  pedagogicalPurpose: string
}) {
  const adultAudience = input.educationStage.toLowerCase().includes("eja")
  const style = imageStyleLabel(input.style)

  return `Crie uma imagem com função pedagógica clara.

ASSUNTO: ${input.topic}
PÚBLICO: ${input.educationStage} — ${input.grade}
FINALIDADE PEDAGÓGICA: ${input.pedagogicalPurpose}
ESTILO: ${style}
DESCRIÇÃO DA CENA: ${input.basePrompt}

REGRAS:
- Composição limpa, sem logotipos, marcas d'água ou texto pequeno ilegível.
- Não represente estudantes identificáveis nem dados pessoais.
- Mantenha conteúdo seguro, culturalmente respeitoso e adequado à idade.
${adultAudience ? "- Público EJA/adulto: aparência madura e contextualizada; não infantilizar." : "- Linguagem visual apropriada à faixa escolar informada."}
${input.accessible ? `- Acessibilidade visual: poucos elementos, separação clara, contraste alto, formas simples e leitura visual objetiva. Necessidades consideradas: ${input.inclusionNeeds.join(", ") || "acessibilidade geral"}.` : ""}
${input.coloringPage || input.style === "COLORING_PAGE" ? "- DESENHO PARA COLORIR: somente preto e branco, fundo branco, contornos grossos e bem definidos, sem sombras, sem cinza, poucos detalhes e áreas amplas para colorir." : ""}

Gere uma única imagem centralizada, pedagogicamente útil e pronta para ser inserida no material.`
}
