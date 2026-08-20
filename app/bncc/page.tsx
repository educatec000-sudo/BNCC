import { getServerSession } from "next-auth"
import { redirect } from "next/navigation"
import Link from "next/link"
import { ArrowRight, BookMarked, CheckCircle2 } from "lucide-react"
import { authOptions } from "@/lib/auth"
import { EDUCATION_STAGES } from "@/lib/planning-options"
import { Button } from "@/components/ui/button"

const generalCompetencies = [
  "Conhecimento",
  "Pensamento científico, crítico e criativo",
  "Repertório cultural",
  "Comunicação",
  "Cultura digital",
  "Trabalho e projeto de vida",
  "Argumentação",
  "Autoconhecimento e autocuidado",
  "Empatia e cooperação",
  "Responsabilidade e cidadania",
]

export default async function BnccPage() {
  const session = await getServerSession(authOptions)
  if (!session) redirect("/login")

  return (
    <div className="mx-auto max-w-7xl space-y-10 px-4 py-8 sm:px-6 lg:px-8">
      <header className="max-w-3xl">
        <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-primary">
          <BookMarked className="h-5 w-5" /> Base Nacional Comum Curricular
        </div>
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Explore a BNCC por contexto</h1>
        <p className="mt-4 leading-relaxed text-muted-foreground">
          Consulte a organização de etapas e áreas utilizada pelo assistente. A IA relaciona habilidades
          ao pedido, mas o professor deve revisar os códigos antes da aplicação oficial.
        </p>
      </header>

      <section>
        <h2 className="text-xl font-semibold">Etapas e áreas disponíveis</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {EDUCATION_STAGES.map((stage) => (
            <article key={stage.id} className="border bg-card p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-semibold">{stage.label}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{stage.description}</p>
                </div>
                <span className="bg-primary/10 px-2 py-1 text-xs font-semibold text-primary">
                  {stage.areas.length} áreas
                </span>
              </div>
              <div className="mt-4 flex flex-wrap gap-1.5">
                {stage.areas.slice(0, 6).map((area) => (
                  <span key={area.id} className="border bg-muted/30 px-2 py-1 text-xs text-muted-foreground">
                    {area.label}
                  </span>
                ))}
                {stage.areas.length > 6 && (
                  <span className="px-2 py-1 text-xs text-primary">+{stage.areas.length - 6}</span>
                )}
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="border bg-card p-6 sm:p-8">
        <h2 className="text-xl font-semibold">10 Competências Gerais</h2>
        <div className="mt-5 grid gap-3 md:grid-cols-2">
          {generalCompetencies.map((competency, index) => (
            <div key={competency} className="flex items-center gap-3 border-b pb-3 last:border-0">
              <span className="flex h-7 w-7 items-center justify-center bg-primary/10 text-xs font-bold text-primary">
                {index + 1}
              </span>
              <span className="text-sm font-medium">{competency}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="flex flex-col items-start justify-between gap-5 border-l-4 border-primary bg-primary/5 p-6 sm:flex-row sm:items-center">
        <div className="flex gap-3">
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
          <div>
            <h2 className="font-semibold">Use a BNCC dentro do fluxo guiado</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Etapa, área e série orientam a seleção das habilidades no planejamento.
            </p>
          </div>
        </div>
        <Button asChild>
          <Link href="/dashboard#criador">Novo planejamento <ArrowRight className="ml-2 h-4 w-4" /></Link>
        </Button>
      </section>
    </div>
  )
}
