import assert from "node:assert/strict"
import test from "node:test"
import React from "react"
import { renderToBuffer } from "@react-pdf/renderer"
import { buildPlanningDocumentModel } from "../lib/document-model"
import { PlanningPdfDocument } from "../lib/pdf/PlanningPdfDocument"
import type { MaterialType, PlanningContent, QuestionItem } from "../lib/planning-content"

const inclusion = {
  contexto: "Aplicar princípios do DUA para ampliar participação.",
  principiosDua: {
    representacao: ["Texto e material concreto"],
    acaoExpressao: ["Resposta escrita ou demonstração prática"],
    engajamento: ["Escolhas e colaboração"],
  },
  estrategias: ["Instruções objetivas"],
  adaptacoes: ["Tempo adicional quando necessário"],
  recursos: ["Recursos visuais"],
  participacao: "Participação por diferentes formas de expressão.",
  avaliacaoAdaptada: ["Avaliação por etapas"],
  criteriosAvaliacao: ["Compreensão do objetivo pedagógico"],
}

function common(materialType: MaterialType) {
  return {
    materialType,
    metadata: {
      titulo: "Frações e números decimais",
      etapaEnsino: "Ensino Fundamental I",
      area: "Matemática",
      serieAno: "5º Ano",
      tipoPlanejamento: "Material pedagógico",
      assunto: "Frações e números decimais",
      pedidoProfessor: "Criar material pedagógico completo.",
    },
    habilidadesBncc: [{ codigo: "EF05MA03", descricao: "Identificar e representar frações." }],
    competenciasGerais: [{ numero: 2, descricao: "Pensamento científico, crítico e criativo." }],
    visualResources: [],
    inclusaoAcessibilidade: inclusion,
  }
}

function questions(count: number): QuestionItem[] {
  return Array.from({ length: count }, (_, index) => ({
    numero: index + 1,
    enunciado: `Resolva a situação-problema ${index + 1} envolvendo frações e números decimais, apresentando os cálculos e justificando a resposta.`,
    tipo: "aberta",
    alternativas: [],
    resposta: `Resposta esperada da questão ${index + 1}`,
    explicacao: "Considerar estratégia, cálculo e justificativa.",
  }))
}

const materials: Record<string, PlanningContent> = {
  "plano-aula-curto": {
    ...common("lesson_plan"), materialType: "lesson_plan", tema: "Frações", duracao: "50 minutos",
    objetivos: { geral: "Compreender frações.", especificos: ["Representar frações"] },
    conteudos: ["Frações equivalentes"], metodologia: ["Resolução de problemas"], recursos: ["Quadro"],
    desenvolvimento: { abertura: "Problematização", etapas: ["Exemplo", "Prática"], fechamento: "Síntese" },
    atividades: ["Exercícios"], avaliacao: { descricao: "Formativa", criterios: ["Compreensão"], instrumentos: ["Observação"] }, referencias: ["BNCC"],
  },
  "plano-aula-longo": {
    ...common("lesson_plan"), materialType: "lesson_plan", tema: "Frações", duracao: "4 aulas",
    objetivos: { geral: "Compreender frações.", especificos: Array.from({ length: 25 }, (_, i) => `Objetivo específico detalhado ${i + 1}`) },
    conteudos: Array.from({ length: 30 }, (_, i) => `Conteúdo detalhado ${i + 1}`),
    metodologia: Array.from({ length: 30 }, (_, i) => `Estratégia metodológica ${i + 1}`), recursos: ["Materiais concretos"],
    desenvolvimento: { abertura: "Problematização", etapas: Array.from({ length: 40 }, (_, i) => `Etapa longa ${i + 1}`), fechamento: "Síntese" },
    atividades: Array.from({ length: 20 }, (_, i) => `Atividade ${i + 1}`), avaliacao: { descricao: "Formativa", criterios: ["Compreensão"], instrumentos: ["Rubrica"] }, referencias: ["BNCC"],
  },
  "sequencia-didatica": {
    ...common("didactic_sequence"), materialType: "didactic_sequence", tema: "Frações", objetivoGeral: "Avançar progressivamente.", numeroAulas: 5,
    aulas: Array.from({ length: 5 }, (_, i) => ({ numero: i + 1, titulo: `Aula ${i + 1}`, objetivos: ["Objetivo"], conteudos: ["Conteúdo"], atividades: ["Atividade"], recursos: ["Recurso"], avaliacao: "Avaliação", duracao: "50 min" })),
    recursosGerais: ["Material concreto"], avaliacaoFinal: "Síntese avaliativa",
  },
  "planejamento-mensal": {
    ...common("monthly_plan"), materialType: "monthly_plan", mesReferencia: "Agosto", objetivosMes: ["Objetivo"], conteudos: ["Conteúdo"],
    semanas: Array.from({ length: 4 }, (_, i) => ({ semana: i + 1, foco: `Foco ${i + 1}`, objetivos: ["Objetivo"], conteudos: ["Conteúdo"], atividades: ["Atividade"], avaliacao: "Avaliação" })),
    projetos: ["Projeto"], recursos: ["Recurso"], avaliacaoMensal: "Avaliação mensal",
  },
  "projeto-pedagogico": {
    ...common("pedagogical_project"), materialType: "pedagogical_project", titulo: "Projeto Frações", justificativa: "Justificativa", problema: "Problema", objetivoGeral: "Objetivo", objetivosEspecificos: ["Objetivo específico"], publicoAlvo: "5º Ano", areasEnvolvidas: ["Matemática", "Arte"], metodologia: ["Investigação"],
    etapas: Array.from({ length: 4 }, (_, i) => ({ numero: i + 1, titulo: `Etapa ${i + 1}`, descricao: "Descrição" })),
    cronograma: Array.from({ length: 8 }, (_, i) => ({ periodo: `Semana ${i + 1}`, acao: "Ação pedagógica" })), recursos: ["Recurso"], avaliacao: "Avaliação", produtoFinal: "Mostra",
  },
  "atividade-questoes": {
    ...common("activity"), materialType: "activity", titulo: "Atividade – Frações", instrucoes: "Resolva as questões.", camposIdentificacao: ["Nome", "Turma", "Data"], quantidadeQuestoes: 10,
    questoes: questions(10), gabarito: questions(10).map((q) => ({ numero: q.numero, resposta: q.resposta, explicacao: q.explicacao })),
  },
  "avaliacao-tabela": {
    ...common("assessment"), materialType: "assessment", titulo: "Avaliação de Matemática", tipoAvaliacao: "Avaliação formativa", instrucoes: "Responda com atenção.", camposIdentificacao: ["Nome", "Turma", "Data"], criteriosGerais: ["Raciocínio"], quantidadeQuestoes: 10,
    questoes: questions(10), gabarito: questions(10).map((q) => ({ numero: q.numero, resposta: q.resposta, criterio: "Resposta e justificativa" })),
    rubrica: Array.from({ length: 12 }, (_, i) => ({ criterio: `Critério detalhado ${i + 1}`, niveis: ["Iniciante", "Em desenvolvimento", "Consolidado"] })),
  },
  "tabela-grande-semanal": {
    ...common("weekly_plan"), materialType: "weekly_plan", temaSemana: "Frações", objetivoSemanal: "Compreender representações.",
    dias: ["Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira"].map((dia) => ({ dia: dia as "Segunda-feira", objetivos: ["Objetivo extenso e contextualizado"], conteudos: ["Conteúdo detalhado"], atividades: ["Atividade prática com descrição longa"], recursos: ["Recursos"], avaliacao: "Avaliação formativa por observação e registro" })), observacoes: "Observações",
  },
}

for (const [name, content] of Object.entries(materials)) {
  test(`gera PDF A4 válido para ${name}`, async () => {
    const model = buildPlanningDocumentModel({
      title: content.metadata.titulo,
      topic: content.metadata.assunto,
      educationStage: content.metadata.etapaEnsino,
      subject: content.metadata.area,
      grade: content.metadata.serieAno,
      planningType: content.metadata.tipoPlanejamento,
      request: content.metadata.pedidoProfessor,
      content,
      images:
        name === "atividade-questoes"
          ? [
              {
                placementKey: "question:1",
                position: 0,
                widthPercent: 75,
                mimeType: "image/png",
                imageData: Buffer.from(
                  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
                  "base64",
                ),
                altText: "Imagem vinculada à questão 1.",
              },
            ]
          : [],
    })
    const buffer = await renderToBuffer(
      <PlanningPdfDocument
        model={model}
        school="Escola de Teste"
        teacher="Professor de Teste"
        orientation={model.recommendedOrientation}
      />,
    )
    assert.equal(buffer.subarray(0, 4).toString(), "%PDF")
    assert.ok(buffer.length > 1_500)
  })
}
