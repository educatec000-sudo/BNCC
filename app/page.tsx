import Link from "next/link"
import {
  Accessibility,
  ArrowRight,
  BookOpenCheck,
  BrainCircuit,
  Check,
  FileDown,
  ShieldCheck,
  Sparkles,
} from "lucide-react"
import { Button } from "@/components/ui/button"

export default function HomePage() {
  return (
    <div className="flex flex-col">
      <section className="relative overflow-hidden border-b bg-background px-4 py-20 sm:py-28">
        <div className="education-grid pointer-events-none absolute inset-0 opacity-55" />
        <div className="relative mx-auto grid max-w-7xl items-center gap-12 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="max-w-3xl">
            <div className="mb-6 inline-flex items-center gap-2 border bg-card px-3 py-2 text-sm font-medium text-primary shadow-sm">
              <Sparkles className="h-4 w-4" /> Planejamento pedagógico com Inteligência Artificial
            </div>
            <h1 className="text-4xl font-bold leading-[1.08] tracking-tight sm:text-5xl lg:text-6xl">
              Mais clareza para planejar.
              <span className="mt-2 block text-primary">Mais possibilidades para ensinar.</span>
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-relaxed text-muted-foreground sm:text-xl">
              O <strong className="text-foreground">+ Educação</strong> orienta cada escolha e transforma
              seu contexto em planejamentos alinhados à BNCC, acessíveis e prontos para a prática docente.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Button size="lg" asChild>
                <Link href="/register">
                  Criar planejamento grátis <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button size="lg" variant="outline" asChild>
                <Link href="/assinatura">Conhecer os planos</Link>
              </Button>
            </div>
            <div className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground">
              {["2 gerações gratuitas", "Sem cartão", "Resultado salvo automaticamente"].map((item) => (
                <span key={item} className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-primary" /> {item}
                </span>
              ))}
            </div>
          </div>

          <div className="relative mx-auto w-full max-w-lg">
            <div className="border bg-card p-6 shadow-xl shadow-slate-900/5">
              <div className="mb-6 flex items-center justify-between border-b pb-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Assistente + Educação</p>
                  <p className="mt-1 font-semibold">Novo planejamento</p>
                </div>
                <BrainCircuit className="h-6 w-6 text-primary" />
              </div>
              <div className="space-y-4">
                {[
                  ["01", "Etapa e área", "Ensino Fundamental I · Ciências"],
                  ["02", "Série e material", "3º Ano · Sequência didática"],
                  ["03", "Inclusão", "DUA · recursos visuais e atividade prática"],
                  ["04", "Resultado", "BNCC, metodologia, avaliação e adaptações"],
                ].map(([number, title, detail], index) => (
                  <div key={number} className="flex gap-4">
                    <span className={`flex h-8 w-8 shrink-0 items-center justify-center text-xs font-bold ${index < 3 ? "bg-primary text-primary-foreground" : "border-2 border-primary text-primary"}`}>
                      {number}
                    </span>
                    <div>
                      <p className="text-sm font-semibold">{title}</p>
                      <p className="text-sm text-muted-foreground">{detail}</p>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-6 border-l-4 border-primary bg-primary/5 p-4 text-sm">
                “Eu entro, escolho o que preciso e o + Educação me ajuda a construir.”
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="px-4 py-20">
        <div className="mx-auto max-w-7xl">
          <div className="mb-12 max-w-2xl">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-primary">Um produto para a rotina docente</p>
            <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
              Educação, tecnologia e inclusão na mesma experiência
            </h2>
            <p className="mt-4 text-muted-foreground">
              Uma plataforma organizada para reduzir o trabalho repetitivo sem tirar do professor as decisões pedagógicas.
            </p>
          </div>
          <div className="grid gap-px overflow-hidden border bg-border md:grid-cols-2 lg:grid-cols-4">
            {[
              { icon: BookOpenCheck, title: "BNCC contextualizada", text: "Objetivos, habilidades e competências relacionados ao contexto selecionado." },
              { icon: Accessibility, title: "Educação inclusiva", text: "DUA, participação, recursos e avaliação adaptada sem realizar diagnóstico." },
              { icon: BrainCircuit, title: "IA com contexto", text: "A IA recebe etapa, área, série, tipo, pedido e preferências pedagógicas." },
              { icon: FileDown, title: "Pronto para usar", text: "Edite, compare, copie, salve, exporte em Word ou imprima em PDF." },
            ].map(({ icon: Icon, title, text }) => (
              <article key={title} className="bg-card p-6 sm:p-8">
                <Icon className="h-6 w-6 text-primary" />
                <h3 className="mt-5 font-semibold">{title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="border-y bg-slate-950 px-4 py-16 text-white">
        <div className="mx-auto flex max-w-5xl flex-col items-start justify-between gap-8 md:flex-row md:items-center">
          <div>
            <div className="flex items-center gap-3">
              <ShieldCheck className="h-6 w-6 text-emerald-400" />
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-emerald-300">Tecnologia a serviço do professor</p>
            </div>
            <h2 className="mt-4 max-w-2xl text-3xl font-bold">Comece com duas gerações gratuitas.</h2>
            <p className="mt-2 text-slate-300">Sem cartão e sem compromisso. Seus planejamentos permanecem associados à sua conta.</p>
          </div>
          <Button size="lg" variant="secondary" asChild>
            <Link href="/register">Criar minha conta</Link>
          </Button>
        </div>
      </section>
    </div>
  )
}
