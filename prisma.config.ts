import { existsSync } from "node:fs"
import { dirname, join } from "node:path"
import { config as loadEnv } from "dotenv"
import { defineConfig } from "prisma/config"

const root = process.cwd()
const localEnv = join(root, ".env.local")

if (existsSync(localEnv)) {
  loadEnv({ path: localEnv, quiet: true })
} else {
  const parentEnv = join(dirname(root), ".env.local")
  if (existsSync(parentEnv)) {
    loadEnv({ path: parentEnv, quiet: true })
    console.warn("[prisma] .env.local encontrado na pasta-pai; mova-o para a raiz do projeto.")
  }
}

loadEnv({ path: join(root, ".env"), quiet: true })

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: process.env.DATABASE_URL as string,
  },
})
