"use client"

import { useSyncExternalStore } from "react"
import { Moon, Sun } from "lucide-react"
import { Button } from "@/components/ui/button"

type Theme = "light" | "dark"

const THEME_CHANGE_EVENT = "themechange"

function readStoredTheme(): Theme | null {
  try {
    const stored = window.localStorage.getItem("theme")
    if (stored === "dark" || stored === "light") return stored
  } catch {
    // localStorage indisponível — segue a preferência do sistema.
  }
  return null
}

function getSnapshot(): Theme {
  const stored = readStoredTheme()
  if (stored) return stored
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"
}

function getServerSnapshot(): Theme {
  return "light"
}

function subscribe(onChange: () => void) {
  const media = window.matchMedia("(prefers-color-scheme: dark)")
  media.addEventListener("change", onChange)
  window.addEventListener(THEME_CHANGE_EVENT, onChange)
  window.addEventListener("storage", onChange)
  return () => {
    media.removeEventListener("change", onChange)
    window.removeEventListener(THEME_CHANGE_EVENT, onChange)
    window.removeEventListener("storage", onChange)
  }
}

export function ThemeToggle({ className }: { className?: string }) {
  const theme = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)

  const toggle = () => {
    const next: Theme = theme === "dark" ? "light" : "dark"
    try {
      window.localStorage.setItem("theme", next)
    } catch {
      // sem persistência — mantém apenas na sessão.
    }
    document.documentElement.classList.toggle("dark", next === "dark")
    window.dispatchEvent(new Event(THEME_CHANGE_EVENT))
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      onClick={toggle}
      className={className}
      aria-label={theme === "dark" ? "Ativar tema claro" : "Ativar tema escuro"}
      title={theme === "dark" ? "Tema claro" : "Tema escuro"}
    >
      {theme === "dark" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
    </Button>
  )
}
