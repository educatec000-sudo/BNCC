import { Accessibility, BookOpenCheck, BrainCircuit, Check } from "lucide-react"

export function AuthShell({ children, title }: { children: React.ReactNode; title: string }) {
  return (
    <div className="grid min-h-[calc(100vh-4rem)] lg:grid-cols-[0.9fr_1.1fr]">
      <aside className="relative hidden overflow-hidden border-r bg-slate-950 p-10 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="education-grid absolute inset-0 opacity-10" />
        <div className="relative">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-emerald-300">+ Educação</p>
          <h1 className="mt-5 max-w-md text-4xl font-bold leading-tight">{title}</h1>
          <p className="mt-4 max-w-md leading-relaxed text-slate-300">
            Planejamento pedagógico com BNCC, Inteligência Artificial e atenção real à inclusão.
          </p>
        </div>
        <div className="relative space-y-4">
          {[
            [BookOpenCheck, "Fluxo guiado e organizado"],
            [BrainCircuit, "IA contextualizada para a prática"],
            [Accessibility, "DUA e estratégias de acessibilidade"],
          ].map(([Icon, label]) => {
            const Component = Icon as typeof Check
            return (
              <div key={String(label)} className="flex items-center gap-3 text-sm text-slate-200">
                <span className="flex h-9 w-9 items-center justify-center border border-white/15 bg-white/5">
                  <Component className="h-4 w-4 text-emerald-300" />
                </span>
                {String(label)}
              </div>
            )
          })}
        </div>
      </aside>
      <main className="flex items-center justify-center bg-muted/25 p-4 sm:p-8">{children}</main>
    </div>
  )
}
