import "server-only"

import { existsSync } from "node:fs"
import { dirname, join } from "node:path"
import { config as loadDotenv } from "dotenv"

const globalForEnv = globalThis as typeof globalThis & {
  bnccEnvLoaded?: boolean
}

function loadFile(path: string): boolean {
  if (!existsSync(path)) return false
  loadDotenv({ path, quiet: true, override: false })
  return true
}

if (!globalForEnv.bnccEnvLoaded) {
  const projectRoot = process.cwd()
  const localEnv = join(projectRoot, ".env.local")
  const defaultEnv = join(projectRoot, ".env")
  const loadedLocal = loadFile(localEnv)
  loadFile(defaultEnv)

  // Ajuda no Windows quando o ZIP é extraído como pasta-pai/BNCC e o
  // .env.local é criado por engano na pasta-pai. Em produção só aceitamos
  // variáveis injetadas ou arquivos na raiz real do projeto.
  if (!loadedLocal && process.env.NODE_ENV !== "production") {
    const parentEnv = join(dirname(projectRoot), ".env.local")
    if (loadFile(parentEnv)) {
      console.warn(
        "[config] .env.local carregado da pasta-pai. Mova-o para a pasta que contém package.json.",
      )
    }
  }

  globalForEnv.bnccEnvLoaded = true
}

export function getGoogleOAuthConfig() {
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim()
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim()

  return {
    clientId,
    clientSecret,
    configured: Boolean(clientId && clientSecret),
  }
}
