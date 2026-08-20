import { getServerSession } from "next-auth"
import { redirect } from "next/navigation"
import Link from "next/link"
import { BookOpen, Plus } from "lucide-react"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { HistoryActions } from "@/components/HistoryActions"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"

export default async function HistoricoPage() {
  const session = await getServerSession(authOptions)
  if (!session) redirect("/login")

  const plans = await prisma.lessonPlan.findMany({
    where: { userId: session.user.id },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      title: true,
      topic: true,
      educationStage: true,
      planningType: true,
      subject: true,
      grade: true,
      inclusionMode: true,
      adaptedContent: true,
      status: true,
      updatedAt: true,
    },
  })

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-3xl font-bold">Meus Planejamentos</h1>
          <p className="text-muted-foreground">
            {plans.length} planejamento{plans.length !== 1 ? "s" : ""} salvo{plans.length !== 1 ? "s" : ""}
          </p>
        </div>
        <Button asChild>
          <Link href="/dashboard" className="gap-2">
            <Plus className="h-4 w-4" /> Novo planejamento
          </Link>
        </Button>
      </div>

      {plans.length === 0 ? (
        <div className="text-center py-20 space-y-4 rounded-xl border bg-muted/20">
          <div className="p-4 bg-muted rounded-full w-fit mx-auto">
            <BookOpen className="h-10 w-10 text-muted-foreground" />
          </div>
          <h2 className="text-xl font-semibold">Nenhum planejamento ainda</h2>
          <p className="text-muted-foreground">Use o fluxo guiado para criar seu primeiro material.</p>
          <Button asChild>
            <Link href="/dashboard">Criar agora</Link>
          </Button>
        </div>
      ) : (
        <>
          <div className="hidden overflow-hidden rounded-xl border md:block">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left">
                <tr>
                  <th className="px-4 py-3 font-medium">Data</th>
                  <th className="px-4 py-3 font-medium">Tipo</th>
                  <th className="px-4 py-3 font-medium">Assunto</th>
                  <th className="px-4 py-3 font-medium">Área</th>
                  <th className="px-4 py-3 font-medium">Série</th>
                  <th className="px-4 py-3 font-medium">Inclusão</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 text-right font-medium">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {plans.map((plan) => (
                  <tr key={plan.id} className="hover:bg-muted/30">
                    <td className="px-4 py-3 whitespace-nowrap">
                      {new Date(plan.updatedAt).toLocaleDateString("pt-BR")}
                    </td>
                    <td className="px-4 py-3">
                      <Link href={`/planos/${plan.id}`} className="font-medium hover:text-primary">
                        {plan.planningType}
                      </Link>
                    </td>
                    <td className="max-w-48 truncate px-4 py-3" title={plan.topic}>{plan.topic}</td>
                    <td className="px-4 py-3">{plan.subject}</td>
                    <td className="px-4 py-3">{plan.grade}</td>
                    <td className="px-4 py-3">
                      <Badge variant={plan.adaptedContent || plan.inclusionMode !== "REGULAR" ? "default" : "outline"}>
                        {plan.adaptedContent
                          ? "Adaptado"
                          : plan.inclusionMode === "REGULAR"
                            ? "DUA"
                            : "Inclusivo"}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={plan.status === "COMPLETED" ? "secondary" : "outline"}>
                        {plan.status === "COMPLETED" ? "Concluído" : plan.status}
                      </Badge>
                    </td>
                    <td className="px-3 py-2"><HistoryActions planId={plan.id} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="space-y-3 md:hidden">
            {plans.map((plan) => (
              <div key={plan.id} className="rounded-xl border bg-card p-4 space-y-3">
                <div>
                  <p className="font-semibold">{plan.title}</p>
                  <p className="mt-1 text-sm"><strong>Assunto:</strong> {plan.topic}</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {plan.educationStage} · {plan.subject} · {plan.grade}
                  </p>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="secondary">{plan.planningType}</Badge>
                    <Badge variant={plan.adaptedContent || plan.inclusionMode !== "REGULAR" ? "default" : "outline"}>
                      {plan.adaptedContent
                        ? "Adaptado"
                        : plan.inclusionMode === "REGULAR"
                          ? "DUA"
                          : "Inclusivo"}
                    </Badge>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {new Date(plan.updatedAt).toLocaleDateString("pt-BR")}
                  </span>
                </div>
                <HistoryActions planId={plan.id} />
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
