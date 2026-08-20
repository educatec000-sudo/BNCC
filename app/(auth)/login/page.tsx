"use client"

import { useEffect, useState } from "react"
import { getProviders, signIn } from "next-auth/react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { BookOpen, Loader2 } from "lucide-react"
import { AuthShell } from "@/components/AuthShell"

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [googleAvailable, setGoogleAvailable] = useState<boolean | null>(null)

  useEffect(() => {
    getProviders()
      .then((providers) => setGoogleAvailable(Boolean(providers?.google)))
      .catch(() => setGoogleAvailable(false))

    const authError = new URLSearchParams(window.location.search).get("error")
    if (!authError) return

    const messages: Record<string, string> = {
      OAuthAccountNotLinked:
        "Este e-mail já possuía uma conta. Tente entrar novamente com Google para vinculá-la.",
      OAuthSignin: "Não foi possível iniciar o login com Google. Verifique a configuração OAuth.",
      OAuthCallback:
        "O Google retornou, mas não foi possível concluir o login. Verifique o banco e as migrações.",
      AccessDenied: "O Google não confirmou um e-mail verificado para esta conta.",
      Configuration: "A autenticação do servidor está incompleta. Execute npm run check:env.",
    }
    queueMicrotask(() => {
      setError(messages[authError] || `Falha na autenticação: ${authError}.`)
    })
  }, [])

  const handleGoogleSignIn = async () => {
    if (!googleAvailable) {
      setError("Login com Google não configurado. Execute npm run check:env no servidor.")
      return
    }
    setError("")
    await signIn("google", { callbackUrl: "/dashboard" })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError("")
    const res = await signIn("credentials", { email, password, redirect: false })
    if (res?.error) {
      setError("Email ou senha incorretos")
      setLoading(false)
    } else {
      router.push("/dashboard")
    }
  }

  return (
    <AuthShell title="Mais tempo para ensinar. Mais clareza para planejar.">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-2">
            <div className="p-3 bg-primary/10 rounded-full">
              <BookOpen className="h-8 w-8 text-primary" />
            </div>
          </div>
          <CardTitle className="text-2xl">Entrar no BNCC Planner</CardTitle>
          <CardDescription>Acesse sua conta para criar planejamentos com IA</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button
            variant="outline"
            className="w-full h-11"
            onClick={handleGoogleSignIn}
            disabled={googleAvailable === null}
          >
            <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            {googleAvailable === false ? "Google não configurado" : "Entrar com Google"}
          </Button>

          <div className="relative">
            <div className="absolute inset-0 flex items-center"><span className="w-full border-t" /></div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">ou</span>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" placeholder="professor@escola.com" value={email} onChange={e => setEmail(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Senha</Label>
              <Input id="password" type="password" value={password} onChange={e => setPassword(e.target.value)} required />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button type="submit" className="w-full h-11" disabled={loading}>
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Entrar
            </Button>
          </form>
        </CardContent>
        <CardFooter className="justify-center">
          <p className="text-sm text-muted-foreground">
            Não tem conta?{" "}
            <Link href="/register" className="text-primary font-medium hover:underline">Cadastre-se grátis</Link>
          </p>
        </CardFooter>
      </Card>
    </AuthShell>
  )
}
