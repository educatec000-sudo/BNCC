"use client"

import { useState } from "react"
import { Check, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export function ProfileForm({ initialName, email }: { initialName: string; email: string }) {
  const [name, setName] = useState(initialName)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState("")
  const [error, setError] = useState("")

  const save = async (event: React.FormEvent) => {
    event.preventDefault()
    setLoading(true)
    setMessage("")
    setError("")

    const response = await fetch("/api/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    })
    const data: { error?: string } = await response.json().catch(() => ({}))
    setLoading(false)

    if (!response.ok) {
      setError(data.error || "Não foi possível salvar.")
      return
    }
    setMessage("Perfil atualizado.")
  }

  return (
    <form onSubmit={save} className="space-y-5">
      <div className="space-y-2">
        <Label htmlFor="profile-name">Nome de exibição</Label>
        <Input
          id="profile-name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          minLength={2}
          maxLength={100}
          required
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="profile-email">E-mail da conta</Label>
        <Input id="profile-email" value={email} disabled aria-describedby="email-help" />
        <p id="email-help" className="text-xs text-muted-foreground">
          O e-mail é gerenciado pelo método usado no cadastro.
        </p>
      </div>
      {message && <p className="flex items-center gap-2 text-sm text-emerald-700"><Check className="h-4 w-4" />{message}</p>}
      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button type="submit" disabled={loading}>
        {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        Salvar alterações
      </Button>
    </form>
  )
}
