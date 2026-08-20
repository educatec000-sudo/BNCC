import { getServerSession } from "next-auth"
import { redirect } from "next/navigation"
import Link from "next/link"
import {
  Accessibility,
  ArrowRight,
  Ear,
  Eye,
  Layers3,
  Move,
  Sparkles,
  UserRoundCheck,
} from "lucide-react"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { Button } from "@/components/ui/button"

export default async function InclusionPage() {
  const session = await getServerSession(authOptions)
  if (!session) redirect("/login")

  const recent = await prisma.lessonPlan.findMany({
    where: { userId: session.user.id },
    orderBy: { updatedAt: "desc" },
    take: 4,
    select: { id: true, title: true, subject: true, grade: true, adaptedContent: true },
  })

  return (
    <div className="mx-auto max-w-7xl space-y-10 px-4 py-8 sm:px-6 lg:px-8">
      <section className="grid gap-8 border bg-card p-6 sm:p-8 lg:grid-cols-[1fr_auto] lg:items-center">
        <div>
          <div className="mb-4 inline-flex items-center gap-2 text-sm font-semibold text-primary">
            <Accessibility className="h-5 w-5" /> Educação Inclusiva
          </div>
          <h1 className="max-w-3xl text-3xl font-bold tracking-tight sm:text-4xl">
            Planejar para a participação de todos
          </h1>
          <p className="mt-4 max-w-3xl leading-relaxed text-muted-foreground">
            Crie materiais com DUA, recursos acessíveis e diferentes formas de participação e avaliação.
            O + Educação oferece apoio pedagógico e não realiza diagnóstico.
          </p>
        </div>
        <Button size="lg" asChild>
          <Link href="/dashboard?inclusive=true#criador">
            <Sparkles className="mr-2 h-4 w-4" /> Novo planejamento inclusivo
          </Link>
        </Button>
      </section>

      <section>
        <p className="text-sm font-semibold uppercase tracking-[0.16em] text-primary">Princípios do DUA</p>
        <h2 className="mt-2 text-2xl font-bold">Múltiplos caminhos para aprender</h2>
        <div className="mt-5 grid gap-4 md:grid-cols-3">
          {[
            { icon: Eye, title: "Representação", text: "Texto, imagem, áudio, vídeo e material concreto para apresentar o conteúdo." },
            { icon: Move, title: "Ação e expressão", text: "Diferentes formas para o estudante demonstrar o que aprendeu." },
            { icon: Layers3, title: "Engajamento", text: "Interesses, escolhas, colaboração e atividades práticas para participar." },
          ].map(({ icon: Icon, title, text }) => (
            <article key={title} className="border bg-card p-6">
              <Icon className="h-6 w-6 text-primary" />
              <h3 className="mt-4 font-semibold">{title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="grid gap-px overflow-hidden border bg-border sm:grid-cols-2 lg:grid-cols-4">
        {[
          [Eye, "Acesso visual", "Contraste, ampliação, audiodescrição e materiais táteis."],
          [Ear, "Acesso auditivo", "Libras, legendas, instruções escritas e recursos visuais."],
          [Move, "Acesso físico", "Tecnologia assistiva, espaço e materiais adaptados."],
          [UserRoundCheck, "Apoio cognitivo", "Linguagem objetiva, etapas, rotina visual e reforço."],
        ].map(([Icon, title, text]) => {
          const Component = Icon as typeof Eye
          return (
            <article key={String(title)} className="bg-card p-5">
              <Component className="h-5 w-5 text-primary" />
              <h3 className="mt-3 text-sm font-semibold">{String(title)}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{String(text)}</p>
            </article>
          )
        })}
      </section>

      {recent.length > 0 && (
        <section>
          <div className="mb-4 flex items-end justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold">Adaptar um planejamento existente</h2>
              <p className="text-sm text-muted-foreground">Abra o resultado e use “Adaptar para Inclusão”.</p>
            </div>
            <Link href="/historico" className="text-sm font-medium text-primary hover:underline">Ver todos</Link>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            {recent.map((plan) => (
              <Link
                key={plan.id}
                href={`/planos/${plan.id}#adaptar`}
                className="group flex items-center justify-between gap-4 border bg-card p-4 hover:border-primary/40"
              >
                <div>
                  <p className="font-medium">{plan.title}</p>
                  <p className="text-sm text-muted-foreground">{plan.subject} · {plan.grade}</p>
                </div>
                <span className="flex items-center gap-2 text-xs font-medium text-primary">
                  {plan.adaptedContent ? "Ver adaptação" : "Adaptar"}
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
