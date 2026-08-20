"use client"

import {
  Accessibility,
  BookOpen,
  CalendarDays,
  CheckSquare,
  ClipboardList,
  Clock,
  FileText,
  FolderKanban,
  GraduationCap,
  Layers3,
  ListChecks,
  Target,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { MaterialImageCard } from "@/components/MaterialImageCard"
import type { MaterialImageView } from "@/lib/images/types"
import type {
  CommonPlanningContent,
  PlanningContent,
  QuestionItem,
} from "@/lib/planning-content"

function BulletList({ items }: { items: string[] }) {
  return (
    <ul className="space-y-1.5 text-sm leading-relaxed">
      {items.map((item, index) => (
        <li key={`${item}-${index}`} className="flex items-start gap-2">
          <span className="mt-1 text-primary">•</span>
          <span>{item}</span>
        </li>
      ))}
    </ul>
  )
}

function Section({ title, items }: { title: string; items: string[] }) {
  return (
    <div>
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </p>
      <BulletList items={items} />
    </div>
  )
}

function MaterialHeader({ content }: { content: CommonPlanningContent }) {
  return (
    <Card>
      <CardContent className="p-5 sm:p-6">
        <div className="flex flex-wrap gap-2">
          <Badge>{content.metadata.tipoPlanejamento}</Badge>
          <Badge variant="secondary">{content.metadata.etapaEnsino}</Badge>
          <Badge variant="outline">{content.metadata.area}</Badge>
          <Badge variant="outline">{content.metadata.serieAno}</Badge>
        </div>
        <h2 className="mt-4 text-2xl font-bold leading-tight">{content.metadata.titulo}</h2>
        <p className="mt-2 text-sm"><strong>Assunto:</strong> {content.metadata.assunto}</p>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          {content.metadata.pedidoProfessor}
        </p>
      </CardContent>
    </Card>
  )
}

function BnccSection({ content }: { content: CommonPlanningContent }) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <BookOpen className="h-5 w-5 text-primary" /> Habilidades e competências BNCC
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="space-y-3">
          {content.habilidadesBncc.map((skill, index) => (
            <div key={`${skill.codigo}-${index}`} className="flex items-start gap-3 border bg-muted/20 p-3">
              <Badge className="shrink-0 font-mono">{skill.codigo}</Badge>
              <p className="text-sm leading-relaxed">{skill.descricao}</p>
            </div>
          ))}
        </div>
        {content.competenciasGerais.length > 0 && (
          <div>
            <p className="mb-2 text-xs font-semibold uppercase text-muted-foreground">Competências gerais</p>
            <ul className="space-y-2 text-sm">
              {content.competenciasGerais.map((item) => (
                <li key={`${item.numero}-${item.descricao}`}>
                  <strong>{item.numero}.</strong> {item.descricao}
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function InclusionSection({ content }: { content: CommonPlanningContent }) {
  const inclusion = content.inclusaoAcessibilidade
  return (
    <Card className="border-primary/25">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Accessibility className="h-5 w-5 text-primary" /> Inclusão e Acessibilidade
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <p className="text-sm leading-relaxed">{inclusion.contexto}</p>
        <div className="grid gap-3 md:grid-cols-3">
          {[
            ["Representação", inclusion.principiosDua.representacao],
            ["Ação e expressão", inclusion.principiosDua.acaoExpressao],
            ["Engajamento", inclusion.principiosDua.engajamento],
          ].map(([label, items]) => (
            <div key={String(label)} className="border bg-muted/20 p-4">
              <p className="mb-2 flex items-center gap-2 text-sm font-semibold">
                <Layers3 className="h-4 w-4 text-primary" /> {String(label)}
              </p>
              <BulletList items={items as string[]} />
            </div>
          ))}
        </div>
        <div className="grid gap-5 md:grid-cols-2">
          <Section title="Estratégias" items={inclusion.estrategias} />
          <Section title="Adaptações" items={inclusion.adaptacoes} />
          <Section title="Recursos" items={inclusion.recursos} />
          <Section title="Avaliação adaptada" items={inclusion.avaliacaoAdaptada} />
          <Section title="Critérios de avaliação" items={inclusion.criteriosAvaliacao} />
        </div>
        <div className="border-l-4 border-primary bg-primary/5 p-4 text-sm">
          <strong>Participação:</strong> {inclusion.participacao}
        </div>
      </CardContent>
    </Card>
  )
}

function InlineImages({
  images,
  placementKey,
  onChanged,
}: {
  images: MaterialImageView[]
  placementKey: string
  onChanged: () => void
}) {
  const matches = images
    .filter((image) => image.placementKey === placementKey)
    .sort((a, b) => a.position - b.position)
  if (matches.length === 0) return null
  return (
    <div className="my-4">
      {matches.map((image) => (
        <MaterialImageCard key={image.id} image={image} onChanged={onChanged} />
      ))}
    </div>
  )
}

function QuestionSheet({
  title,
  instructions,
  fields,
  questions,
  answerKey,
  images,
  onImagesChanged,
}: {
  title: string
  instructions: string
  fields: string[]
  questions: QuestionItem[]
  answerKey: { numero: number; resposta: string; detail: string }[]
  images: MaterialImageView[]
  onImagesChanged: () => void
}) {
  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-xl">
            <ClipboardList className="h-5 w-5 text-primary" /> {title}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-3 border-y py-4 sm:grid-cols-3">
            {fields.map((field) => (
              <p key={field} className="text-sm">{field}: __________________________</p>
            ))}
          </div>
          <p className="text-sm font-medium">{instructions}</p>
          <ol className="space-y-6">
            {questions.map((question) => (
              <li key={question.numero} className="break-inside-avoid">
                <p className="font-medium leading-relaxed">
                  {question.numero}. {question.enunciado}
                </p>
                <InlineImages
                  images={images}
                  placementKey={`question:${question.numero}`}
                  onChanged={onImagesChanged}
                />
                {question.alternativas.length > 0 && (
                  <ol className="ml-5 mt-2 space-y-1 text-sm" type="a">
                    {question.alternativas.map((alternative) => (
                      <li key={alternative}>{alternative}</li>
                    ))}
                  </ol>
                )}
                {question.alternativas.length === 0 && (
                  <div className="mt-4 space-y-3" aria-hidden="true">
                    <div className="border-b" /><div className="border-b" />
                  </div>
                )}
              </li>
            ))}
          </ol>
        </CardContent>
      </Card>
      <Card className="print:break-before-page">
        <CardHeader><CardTitle className="text-lg">Gabarito</CardTitle></CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2">
            {answerKey.map((answer) => (
              <div key={answer.numero} className="border p-3 text-sm">
                <p><strong>{answer.numero}.</strong> {answer.resposta}</p>
                <p className="mt-1 text-muted-foreground">{answer.detail}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </>
  )
}

export function MaterialResult({
  content,
  images,
  onImagesChanged,
}: {
  content: PlanningContent
  images: MaterialImageView[]
  onImagesChanged: () => void
}) {
  let specific: React.ReactNode

  switch (content.materialType) {
    case "lesson_plan":
      specific = (
        <>
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2 text-lg"><Target className="h-5 w-5 text-primary" /> Objetivos e conteúdo</CardTitle></CardHeader>
            <CardContent className="grid gap-6 md:grid-cols-2">
              <div><p className="font-medium">{content.objetivos.geral}</p><div className="mt-3"><BulletList items={content.objetivos.especificos} /></div></div>
              <Section title="Conteúdos" items={content.conteudos} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2 text-lg"><Clock className="h-5 w-5 text-primary" /> Metodologia e desenvolvimento</CardTitle></CardHeader>
            <CardContent className="space-y-5">
              <div className="flex items-center gap-2 text-sm"><Badge variant="outline">Duração</Badge>{content.duracao}</div>
              <Section title="Metodologia" items={content.metodologia} />
              <div className="grid gap-3 md:grid-cols-3">
                <div className="border p-4"><strong>Abertura</strong><p className="mt-2 text-sm">{content.desenvolvimento.abertura}</p></div>
                <div className="border p-4"><strong>Desenvolvimento</strong><div className="mt-2"><BulletList items={content.desenvolvimento.etapas} /></div></div>
                <div className="border p-4"><strong>Fechamento</strong><p className="mt-2 text-sm">{content.desenvolvimento.fechamento}</p></div>
              </div>
              <div className="grid gap-5 md:grid-cols-2"><Section title="Atividades" items={content.atividades} /><Section title="Recursos" items={content.recursos} /></div>
            </CardContent>
          </Card>
          <Card><CardHeader><CardTitle className="flex items-center gap-2 text-lg"><CheckSquare className="h-5 w-5 text-primary" /> Avaliação</CardTitle></CardHeader><CardContent><p>{content.avaliacao.descricao}</p><div className="mt-4 grid gap-5 md:grid-cols-2"><Section title="Critérios" items={content.avaliacao.criterios} /><Section title="Instrumentos" items={content.avaliacao.instrumentos} /></div></CardContent></Card>
        </>
      )
      break
    case "didactic_sequence":
      specific = (
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><ListChecks className="h-5 w-5 text-primary" /> Sequência de {content.numeroAulas} aulas</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm"><strong>Objetivo geral:</strong> {content.objetivoGeral}</p>
            {content.aulas.map((lesson) => (
              <article key={lesson.numero} className="border-l-4 border-primary bg-muted/20 p-5">
                <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="font-semibold">Aula {lesson.numero} — {lesson.titulo}</h3><Badge variant="outline">{lesson.duracao}</Badge></div>
                <div className="mt-4 grid gap-4 md:grid-cols-2"><Section title="Objetivos" items={lesson.objetivos} /><Section title="Conteúdos" items={lesson.conteudos} /><Section title="Atividades" items={lesson.atividades} /><Section title="Recursos" items={lesson.recursos} /></div>
                <p className="mt-4 text-sm"><strong>Avaliação:</strong> {lesson.avaliacao}</p>
              </article>
            ))}
            <p className="border-t pt-4"><strong>Avaliação final:</strong> {content.avaliacaoFinal}</p>
          </CardContent>
        </Card>
      )
      break
    case "weekly_plan":
      specific = (
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><CalendarDays className="h-5 w-5 text-primary" /> Planejamento de segunda a sexta</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <p><strong>Objetivo semanal:</strong> {content.objetivoSemanal}</p>
            <div className="grid gap-3">
              {content.dias.map((day) => (
                <article key={day.dia} className="grid gap-4 border p-4 lg:grid-cols-4">
                  <h3 className="font-semibold text-primary">{day.dia}</h3>
                  <Section title="Objetivos e conteúdos" items={[...day.objetivos, ...day.conteudos]} />
                  <Section title="Atividades" items={day.atividades} />
                  <div><Section title="Recursos" items={day.recursos} /><p className="mt-3 text-sm"><strong>Avaliação:</strong> {day.avaliacao}</p></div>
                </article>
              ))}
            </div>
          </CardContent>
        </Card>
      )
      break
    case "monthly_plan":
      specific = (
        <>
          <Card><CardHeader><CardTitle>Objetivos do mês</CardTitle></CardHeader><CardContent className="grid gap-6 md:grid-cols-2"><BulletList items={content.objetivosMes} /><Section title="Conteúdos" items={content.conteudos} /></CardContent></Card>
          <Card><CardHeader><CardTitle>Organização por semanas</CardTitle></CardHeader><CardContent className="grid gap-4 md:grid-cols-2">{content.semanas.map((week) => <article key={week.semana} className="border p-5"><Badge>Semana {week.semana}</Badge><h3 className="mt-3 font-semibold">{week.foco}</h3><div className="mt-4 space-y-4"><Section title="Objetivos" items={week.objetivos} /><Section title="Conteúdos" items={week.conteudos} /><Section title="Atividades" items={week.atividades} /><p className="text-sm"><strong>Avaliação:</strong> {week.avaliacao}</p></div></article>)}</CardContent></Card>
        </>
      )
      break
    case "pedagogical_project":
      specific = (
        <>
          <Card><CardHeader><CardTitle className="flex items-center gap-2"><FolderKanban className="h-5 w-5 text-primary" /> Projeto pedagógico</CardTitle></CardHeader><CardContent className="space-y-5"><div><strong>Justificativa</strong><p className="mt-2">{content.justificativa}</p></div><div><strong>Problema</strong><p className="mt-2">{content.problema}</p></div><div><strong>Objetivo geral</strong><p className="mt-2">{content.objetivoGeral}</p></div><div className="grid gap-5 md:grid-cols-2"><Section title="Objetivos específicos" items={content.objetivosEspecificos} /><Section title="Áreas envolvidas" items={content.areasEnvolvidas} /><Section title="Metodologia" items={content.metodologia} /><Section title="Recursos" items={content.recursos} /></div></CardContent></Card>
          <Card><CardHeader><CardTitle>Etapas e cronograma</CardTitle></CardHeader><CardContent className="space-y-3">{content.etapas.map((step) => <div key={step.numero} className="border-l-4 border-primary p-4"><strong>{step.numero}. {step.titulo}</strong><p className="mt-1 text-sm">{step.descricao}</p></div>)}<div className="mt-5 grid gap-2 sm:grid-cols-2">{content.cronograma.map((item) => <div key={`${item.periodo}-${item.acao}`} className="border p-3 text-sm"><strong>{item.periodo}</strong><p>{item.acao}</p></div>)}</div><p className="pt-3"><strong>Produto final:</strong> {content.produtoFinal}</p></CardContent></Card>
        </>
      )
      break
    case "activity":
      specific = <QuestionSheet title={content.titulo} instructions={content.instrucoes} fields={content.camposIdentificacao} questions={content.questoes} answerKey={content.gabarito.map((item) => ({ ...item, detail: item.explicacao }))} images={images} onImagesChanged={onImagesChanged} />
      break
    case "assessment":
      specific = (
        <>
          <QuestionSheet title={content.titulo} instructions={`${content.tipoAvaliacao}. ${content.instrucoes}`} fields={content.camposIdentificacao} questions={content.questoes} answerKey={content.gabarito.map((item) => ({ numero: item.numero, resposta: item.resposta, detail: item.criterio }))} images={images} onImagesChanged={onImagesChanged} />
          {content.rubrica.length > 0 && <Card><CardHeader><CardTitle>Rubrica de avaliação</CardTitle></CardHeader><CardContent className="grid gap-3 md:grid-cols-2">{content.rubrica.map((item) => <div key={item.criterio} className="border p-4"><p className="font-semibold">{item.criterio}</p><div className="mt-2"><BulletList items={item.niveis} /></div></div>)}</CardContent></Card>}
        </>
      )
      break
    case "teaching_plan":
      specific = (
        <>
          <Card><CardHeader><CardTitle className="flex items-center gap-2"><GraduationCap className="h-5 w-5 text-primary" /> Plano de ensino — {content.periodoLetivo}</CardTitle></CardHeader><CardContent><p><strong>Ementa:</strong> {content.ementa}</p><div className="mt-5 grid gap-5 md:grid-cols-2"><Section title="Objetivos gerais" items={content.objetivosGerais} /><Section title="Metodologia geral" items={content.metodologiaGeral} /><Section title="Recursos" items={content.recursos} /><Section title="Referências" items={content.referencias} /></div></CardContent></Card>
          <Card><CardHeader><CardTitle>Unidades do período</CardTitle></CardHeader><CardContent className="space-y-4">{content.unidades.map((unit) => <article key={unit.unidade} className="border p-5"><div className="flex justify-between gap-3"><h3 className="font-semibold">Unidade {unit.unidade} — {unit.titulo}</h3><Badge variant="outline">{unit.periodo}</Badge></div><div className="mt-4 grid gap-4 md:grid-cols-3"><Section title="Objetivos" items={unit.objetivos} /><Section title="Conteúdos" items={unit.conteudos} /><Section title="Metodologia" items={unit.metodologia} /></div><p className="mt-4 text-sm"><strong>Avaliação:</strong> {unit.avaliacao}</p></article>)}</CardContent></Card>
        </>
      )
      break
    case "other":
      specific = (
        <Card><CardHeader><CardTitle className="flex items-center gap-2"><FileText className="h-5 w-5 text-primary" /> {content.formatoIdentificado}</CardTitle></CardHeader><CardContent className="space-y-6">{content.secoes.map((section) => <section key={section.titulo}><h3 className="font-semibold">{section.titulo}</h3><p className="mt-2 whitespace-pre-line leading-relaxed">{section.conteudo}</p>{section.itens.length > 0 && <div className="mt-3"><BulletList items={section.itens} /></div>}</section>)}</CardContent></Card>
      )
      break
  }

  const linkedInlineIds = new Set(
    images
      .filter(
        (image) =>
          image.placementKey === "cover" ||
          ((content.materialType === "activity" || content.materialType === "assessment") &&
            image.placementKey.startsWith("question:")),
      )
      .map((image) => image.id),
  )
  const remainingImages = images.filter((image) => !linkedInlineIds.has(image.id))

  return (
    <div className="reading-surface space-y-6">
      <MaterialHeader content={content} />
      <InlineImages images={images} placementKey="cover" onChanged={onImagesChanged} />
      {specific}
      {remainingImages.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-lg">Recursos visuais vinculados</CardTitle></CardHeader>
          <CardContent>
            {remainingImages.map((image) => (
              <div key={image.id}>
                <p className="text-xs font-semibold uppercase text-muted-foreground">
                  Posição: {image.placementKey}
                </p>
                <MaterialImageCard image={image} onChanged={onImagesChanged} />
              </div>
            ))}
          </CardContent>
        </Card>
      )}
      <BnccSection content={content} />
      <InclusionSection content={content} />
    </div>
  )
}
