"use client"

import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Accessibility,
  ArrowRight,
  BookOpen,
  CheckSquare,
  Clock,
  Layers3,
  List,
  Target,
  Wrench,
} from "lucide-react"
import type { LessonPlanContent } from "@/lib/bncc-plan"

interface PlanResultProps {
  content: LessonPlanContent
}

export function PlanResult({ content }: PlanResultProps) {
  if (!content) return null

  return (
    <div className="space-y-6 print:space-y-4">
      {/* Identificação */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <BookOpen className="h-5 w-5 text-primary" />
            Identificação
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div><p className="text-xs text-muted-foreground">Tipo</p><p className="font-medium">{content.identificacao?.tipoPlanejamento || "Planejamento"}</p></div>
            <div><p className="text-xs text-muted-foreground">Etapa</p><p className="font-medium">{content.identificacao?.etapaEnsino || content.identificacao?.nivel}</p></div>
            <div><p className="text-xs text-muted-foreground">Área</p><p className="font-medium">{content.identificacao?.disciplina}</p></div>
            <div><p className="text-xs text-muted-foreground">Série/Ano</p><p className="font-medium">{content.identificacao?.ano}</p></div>
            <div className="sm:col-span-2"><p className="text-xs text-muted-foreground">Tema</p><p className="font-medium">{content.identificacao?.tema}</p></div>
            <div><p className="text-xs text-muted-foreground">Duração</p><p className="font-medium">{content.identificacao?.duracao}</p></div>
          </div>
        </CardContent>
      </Card>

      {/* Objetivos */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Target className="h-5 w-5 text-primary" />
            Objetivos de Aprendizagem
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <p className="text-sm font-semibold text-muted-foreground mb-1">OBJETIVO GERAL</p>
            <p>{content.objetivos?.geral}</p>
          </div>
          <div>
            <p className="text-sm font-semibold text-muted-foreground mb-2">OBJETIVOS ESPECÍFICOS</p>
            <ul className="space-y-1">
              {content.objetivos?.especificos?.map((obj: string, i: number) => (
                <li key={i} className="flex items-start gap-2">
                  <span className="text-primary font-bold mt-0.5">•</span>
                  <span>{obj}</span>
                </li>
              ))}
            </ul>
          </div>
        </CardContent>
      </Card>

      {/* Habilidades BNCC */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <List className="h-5 w-5 text-primary" />
            Habilidades BNCC
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {content.habilidadesBncc?.map((h, i) => (
              <div key={i} className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
                <Badge variant="default" className="shrink-0 font-mono">{h.codigo}</Badge>
                <p className="text-sm">{h.descricao}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Sequência Didática */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Clock className="h-5 w-5 text-primary" />
            Sequência Didática
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {[
            { label: "ABERTURA", key: "abertura", color: "bg-green-50 border-green-200" },
            { label: "DESENVOLVIMENTO", key: "desenvolvimento", color: "bg-blue-50 border-blue-200" },
            { label: "FECHAMENTO", key: "fechamento", color: "bg-orange-50 border-orange-200" },
          ].map(({ label, key, color }) => {
            const step = content.sequenciaDidatica[
              key as keyof LessonPlanContent["sequenciaDidatica"]
            ]
            return (
              <div key={key} className={`p-4 rounded-lg border ${color}`}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-muted-foreground">{label}</span>
                  <span className="text-xs text-muted-foreground">{step?.duracao}</span>
                </div>
                <p className="text-sm">{step?.descricao}</p>
                {step?.etapas && (
                  <ul className="mt-2 space-y-1">
                    {step.etapas.map((e: string, i: number) => (
                      <li key={i} className="text-sm flex items-start gap-2">
                        <span className="font-bold text-primary">{i + 1}.</span> {e}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )
          })}
        </CardContent>
      </Card>

      {/* Atividades */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Wrench className="h-5 w-5 text-primary" />
            Atividades Sugeridas
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {content.atividades?.map((a, i) => (
              <div key={i} className="p-4 border rounded-lg">
                <div className="flex items-center justify-between mb-1">
                  <p className="font-semibold">{a.titulo}</p>
                  <div className="flex gap-2">
                    <Badge variant="secondary">{a.tipo}</Badge>
                    <Badge variant="outline">{a.duracao}</Badge>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground">{a.descricao}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Recursos Pedagógicos */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <BookOpen className="h-5 w-5 text-primary" />
            Recursos Pedagógicos
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-3 gap-4">
            {[
              { label: "Materiais", items: content.recursosPedagogicos?.materiais },
              { label: "Tecnologias", items: content.recursosPedagogicos?.tecnologias },
              { label: "Referências", items: content.recursosPedagogicos?.referencias },
            ].map(({ label, items }) => (
              <div key={label}>
                <p className="text-sm font-semibold text-muted-foreground mb-2">{label.toUpperCase()}</p>
                <ul className="space-y-1">
                  {items?.map((item: string, i: number) => (
                    <li key={i} className="text-sm flex items-start gap-2">
                      <span className="text-primary">•</span> {item}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Avaliação */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <CheckSquare className="h-5 w-5 text-primary" />
            Avaliação
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p>{content.avaliacao?.descricao}</p>
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <p className="text-sm font-semibold text-muted-foreground mb-2">CRITÉRIOS</p>
              <ul className="space-y-1">
                {content.avaliacao?.criterios?.map((c: string, i: number) => (
                  <li key={i} className="text-sm flex items-start gap-2"><span className="text-primary">•</span> {c}</li>
                ))}
              </ul>
            </div>
            <div>
              <p className="text-sm font-semibold text-muted-foreground mb-2">INSTRUMENTOS</p>
              <ul className="space-y-1">
                {content.avaliacao?.instrumentos?.map((ins: string) => (
                  <li key={ins} className="text-sm flex items-start gap-2"><span className="text-primary">•</span> {ins}</li>
                ))}
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      {content.inclusaoAcessibilidade && (
        <Card className="border-primary/25">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Accessibility className="h-5 w-5 text-primary" />
              Inclusão e Acessibilidade
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <p className="text-sm leading-relaxed">{content.inclusaoAcessibilidade.contexto}</p>

            <div>
              <p className="mb-3 flex items-center gap-2 text-sm font-semibold text-muted-foreground">
                <Layers3 className="h-4 w-4" /> PRINCÍPIOS DO DUA
              </p>
              <div className="grid gap-3 md:grid-cols-3">
                {[
                  ["Representação", content.inclusaoAcessibilidade.principiosDua.representacao],
                  ["Ação e expressão", content.inclusaoAcessibilidade.principiosDua.acaoExpressao],
                  ["Engajamento", content.inclusaoAcessibilidade.principiosDua.engajamento],
                ].map(([label, items]) => (
                  <div key={String(label)} className="border bg-muted/25 p-4">
                    <p className="mb-2 text-sm font-semibold">{String(label)}</p>
                    <ul className="space-y-1.5 text-sm">
                      {(items as string[]).map((item) => (
                        <li key={item} className="flex items-start gap-2">
                          <span className="mt-1 text-primary">•</span>{item}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid gap-5 md:grid-cols-2">
              {[
                ["Estratégias inclusivas", content.inclusaoAcessibilidade.estrategias],
                ["Adaptações", content.inclusaoAcessibilidade.adaptacoes],
                ["Recursos", content.inclusaoAcessibilidade.recursos],
                ["Avaliação adaptada", content.inclusaoAcessibilidade.avaliacaoAdaptada],
                ["Critérios de avaliação", content.inclusaoAcessibilidade.criteriosAvaliacao],
              ].map(([label, items]) => (
                <div key={String(label)}>
                  <p className="mb-2 text-sm font-semibold text-muted-foreground">
                    {String(label).toUpperCase()}
                  </p>
                  <ul className="space-y-1.5 text-sm">
                    {(items as string[]).map((item) => (
                      <li key={item} className="flex items-start gap-2">
                        <span className="text-primary">•</span>{item}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>

            <div className="border-l-4 border-primary bg-primary/5 p-4">
              <p className="text-xs font-semibold uppercase text-muted-foreground">Forma de participação</p>
              <p className="mt-1 text-sm">{content.inclusaoAcessibilidade.participacao}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Encaminhamentos */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <ArrowRight className="h-5 w-5 text-primary" />
            Encaminhamentos
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p>{content.encaminhamentos?.proximasAulas}</p>
          {content.encaminhamentos?.atividadesComplementares?.length > 0 && (
            <div>
              <p className="text-sm font-semibold text-muted-foreground mb-2">ATIVIDADES COMPLEMENTARES</p>
              <ul className="space-y-1">
                {content.encaminhamentos?.atividadesComplementares?.map((a: string, i: number) => (
                  <li key={i} className="text-sm flex items-start gap-2"><span className="text-primary">•</span> {a}</li>
                ))}
              </ul>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
