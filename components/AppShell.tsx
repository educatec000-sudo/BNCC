"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { signOut, useSession } from "next-auth/react"
import {
  Accessibility,
  BarChart3,
  BookOpen,
  CreditCard,
  History,
  Home,
  LogOut,
  Settings,
  Sparkles,
  UserRound,
} from "lucide-react"
import { Brand } from "@/components/Brand"
import { ThemeToggle } from "@/components/ThemeToggle"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

const navigation = [
  { href: "/dashboard", label: "Início", icon: Home },
  { href: "/dashboard#criador", label: "Novo Planejamento", icon: Sparkles },
  { href: "/historico", label: "Meus Planejamentos", icon: History },
  { href: "/inclusao", label: "Inclusão", icon: Accessibility },
  { href: "/bncc", label: "BNCC", icon: BookOpen },
  { href: "/utilizacao", label: "Utilização", icon: BarChart3 },
  { href: "/assinatura", label: "Meu Plano", icon: CreditCard },
  { href: "/configuracoes", label: "Configurações", icon: Settings },
]

const mobileNavigation = navigation.slice(0, 4)

function isActive(pathname: string, href: string) {
  const path = href.split("#")[0]
  return pathname === path || (path !== "/dashboard" && pathname.startsWith(`${path}/`))
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const { data: session, status } = useSession()
  const authenticated = status === "authenticated" && Boolean(session)

  if (!authenticated) {
    return (
      <div className="min-h-screen bg-background">
        <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur">
          <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
            <Brand />
            <nav className="flex items-center gap-1" aria-label="Navegação pública">
              <ThemeToggle />
              <Button variant="ghost" size="sm" asChild>
                <Link href="/assinatura">Planos</Link>
              </Button>
              <Button variant="ghost" size="sm" asChild>
                <Link href="/login">Entrar</Link>
              </Button>
              <Button size="sm" asChild>
                <Link href="/register">Começar grátis</Link>
              </Button>
            </nav>
          </div>
        </header>
        <main id="conteudo" tabIndex={-1} className="min-h-[calc(100vh-4rem)]">{children}</main>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-muted/20">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 border-r bg-card lg:flex lg:flex-col print:hidden">
        <div className="flex h-20 items-center border-b px-6">
          <Brand />
        </div>
        <nav className="flex-1 space-y-1 overflow-y-auto p-4" aria-label="Navegação principal">
          {navigation.map(({ href, label, icon: Icon }) => {
            const active = isActive(pathname, href)
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex min-h-11 items-center gap-3 border-l-2 px-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                  active
                    ? "border-primary bg-primary/8 text-primary"
                    : "border-transparent text-muted-foreground hover:bg-muted/60 hover:text-foreground",
                )}
              >
                <Icon className="h-4.5 w-4.5 shrink-0" aria-hidden="true" />
                {label}
              </Link>
            )
          })}
        </nav>
        <div className="border-t p-4">
          <div className="mb-3 flex items-center gap-3 px-2">
            <span className="flex h-9 w-9 items-center justify-center bg-primary/10 text-primary">
              <UserRound className="h-4 w-4" aria-hidden="true" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">{session?.user?.name || "Professor"}</p>
              <p className="truncate text-xs text-muted-foreground">{session?.user?.email}</p>
            </div>
          </div>
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 px-2 text-sm text-muted-foreground">
              <ThemeToggle />
              <span className="text-xs">Tema</span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="text-muted-foreground"
              onClick={() => signOut({ callbackUrl: "/" })}
            >
              <LogOut className="mr-2 h-4 w-4" /> Sair
            </Button>
          </div>
        </div>
      </aside>

      <div className="lg:pl-64">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b bg-background/95 px-4 backdrop-blur lg:hidden print:hidden">
          <Brand />
          <div className="flex items-center gap-1">
            <ThemeToggle />
            <Button variant="ghost" size="icon" asChild>
              <Link href="/configuracoes" aria-label="Configurações">
                <Settings className="h-5 w-5" />
              </Link>
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => signOut({ callbackUrl: "/" })}
              aria-label="Sair"
            >
              <LogOut className="h-5 w-5" />
            </Button>
          </div>
        </header>

        <main id="conteudo" tabIndex={-1} className="min-h-screen pb-24 lg:pb-0">{children}</main>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t bg-background/98 px-1 pb-[env(safe-area-inset-bottom)] lg:hidden print:hidden" aria-label="Navegação móvel">
        {mobileNavigation.map(({ href, label, icon: Icon }) => {
          const active = isActive(pathname, href)
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex min-h-16 flex-col items-center justify-center gap-1 px-1 text-[10px] font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                active ? "text-primary" : "text-muted-foreground",
              )}
            >
              <Icon className="h-5 w-5" aria-hidden="true" />
              <span className="line-clamp-1">{label.replace("Meus ", "")}</span>
            </Link>
          )
        })}
        <Link
          href="/assinatura"
          aria-current={pathname === "/assinatura" ? "page" : undefined}
          className={cn(
            "flex min-h-16 flex-col items-center justify-center gap-1 px-1 text-[10px] font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
            pathname === "/assinatura" ? "text-primary" : "text-muted-foreground",
          )}
        >
          <CreditCard className="h-5 w-5" aria-hidden="true" />
          <span>Plano</span>
        </Link>
      </nav>
    </div>
  )
}
