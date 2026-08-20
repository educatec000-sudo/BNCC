import { getServerSession } from "next-auth"
import { redirect } from "next/navigation"
import Link from "next/link"
import { Accessibility, CreditCard, Settings, ShieldCheck } from "lucide-react"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { getAccessSnapshot } from "@/lib/access"
import { ProfileForm } from "@/components/ProfileForm"
import { Button } from "@/components/ui/button"

const planLabels = { FREE: "Teste Grátis", PROFESSOR: "Professor", PREMIUM: "Premium" }

export default async function SettingsPage() {
  const session = await getServerSession(authOptions)
  if (!session) redirect("/login")

  const [user, access] = await Promise.all([
    prisma.user.findUnique({
      where: { id: session.user.id },
      select: { name: true, email: true, createdAt: true },
    }),
    getAccessSnapshot(session.user.id),
  ])
  if (!user) redirect("/login")

  return (
    <div className="mx-auto max-w-5xl space-y-8 px-4 py-8 sm:px-6 lg:px-8">
      <header>
        <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-primary">
          <Settings className="h-5 w-5" /> Configurações
        </div>
        <h1 className="text-3xl font-bold tracking-tight">Perfil e preferências da conta</h1>
        <p className="mt-2 text-muted-foreground">Gerencie apenas os dados necessários para utilizar a plataforma.</p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <section className="border bg-card p-6 sm:p-8">
          <h2 className="text-lg font-semibold">Perfil</h2>
          <p className="mb-6 mt-1 text-sm text-muted-foreground">Essas informações aparecem na saudação e na conta.</p>
          <ProfileForm initialName={user.name || "Professor"} email={user.email} />
        </section>

        <div className="space-y-4">
          <section className="border bg-card p-5">
            <CreditCard className="h-5 w-5 text-primary" />
            <p className="mt-3 text-sm text-muted-foreground">Plano atual</p>
            <p className="text-lg font-semibold">{planLabels[access.plan]}</p>
            <p className="mt-1 text-sm text-muted-foreground">{access.remaining} utilizações disponíveis</p>
            <Button variant="outline" className="mt-4 w-full" asChild>
              <Link href="/assinatura">Gerenciar plano</Link>
            </Button>
          </section>

          <section className="border bg-card p-5">
            <Accessibility className="h-5 w-5 text-primary" />
            <h2 className="mt-3 font-semibold">Privacidade pedagógica</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              Não informe nomes de estudantes, CPF, endereço ou dados médicos nos pedidos e perfis pedagógicos.
            </p>
          </section>

          <section className="border bg-card p-5">
            <ShieldCheck className="h-5 w-5 text-primary" />
            <h2 className="mt-3 font-semibold">Conta protegida</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Conta criada em {new Date(user.createdAt).toLocaleDateString("pt-BR")}.
            </p>
          </section>
        </div>
      </div>
    </div>
  )
}
