import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import dotenv from 'dotenv'
import pg from 'pg'

const { Client } = pg
const cwd = process.cwd()
const rootLocal = join(cwd, '.env.local')
const rootDefault = join(cwd, '.env')
const parentLocal = join(dirname(cwd), '.env.local')
let envFile = null
let warning = null

if (existsSync(rootLocal)) {
  dotenv.config({ path: rootLocal, quiet: true })
  envFile = rootLocal
} else if (existsSync(parentLocal)) {
  dotenv.config({ path: parentLocal, quiet: true })
  envFile = parentLocal
  warning = '.env.local está na pasta-pai. Mova-o para a pasta que contém package.json.'
}

if (existsSync(rootDefault)) {
  dotenv.config({ path: rootDefault, quiet: true })
  envFile ??= rootDefault
}

const imageGenerationEnabled =
  process.env.IMAGE_GENERATION_ENABLED?.trim().toLowerCase() !== 'false'
const imageProvider =
  process.env.IMAGE_PROVIDER?.trim().toLowerCase() ||
  process.env.AI_IMAGE_PROVIDER?.trim().toLowerCase() ||
  'huggingface'
const required = [
  'DATABASE_URL',
  'NEXTAUTH_SECRET',
  'NEXTAUTH_URL',
  'GOOGLE_CLIENT_ID',
  'GOOGLE_CLIENT_SECRET',
  'GEMINI_API_KEY',
]
if (imageGenerationEnabled && imageProvider === 'huggingface') required.push('HUGGINGFACE_API_KEY')
const configured = Object.fromEntries(required.map((name) => [name, Boolean(process.env[name]?.trim())]))
const missing = required.filter((name) => !configured[name])
const nextAuthUrl = process.env.NEXTAUTH_URL?.trim()
const callbackUrl = nextAuthUrl
  ? `${nextAuthUrl.replace(/\/$/, '')}/api/auth/callback/google`
  : null

const database = {
  configured: configured.DATABASE_URL,
  reachable: false,
  schemaReady: false,
  migrationApplied: false,
  missingMigrations: [],
  missingTables: [],
  host: null,
  errorCode: null,
  hint: null,
}

if (process.env.DATABASE_URL) {
  let client = null
  try {
    const parsed = new URL(process.env.DATABASE_URL)
    database.host = parsed.hostname
    client = new Client({
      connectionString: process.env.DATABASE_URL,
      connectionTimeoutMillis: 5_000,
    })
    await client.connect()
    await client.query('SELECT 1')
    database.reachable = true

    const requiredTables = [
      'User',
      'Account',
      'Subscription',
      'Usage',
      'LessonPlan',
      'MaterialImage',
      'MaterialImageVersion',
      'DocumentRevision',
      'MaterialOperation',
    ]
    const tableResult = await client.query(
      `SELECT table_name FROM information_schema.tables
       WHERE table_schema = 'public' AND table_name = ANY($1::text[])`,
      [requiredTables],
    )
    const existingTables = new Set(tableResult.rows.map((row) => row.table_name))
    database.missingTables = requiredTables.filter((table) => !existingTables.has(table))
    database.schemaReady = database.missingTables.length === 0

    const migrationTable = await client.query(
      `SELECT to_regclass('public."_prisma_migrations"') IS NOT NULL AS exists`,
    )
    if (database.schemaReady && migrationTable.rows[0]?.exists) {
      const requiredMigrations = [
        '20260818150000_kiwify_subscriptions',
        '20260818170000_planning_wizard',
        '20260818200000_inclusive_education',
        '20260819160000_specialized_material_generation',
        '20260819180000_planning_topic',
        '20260820120000_material_images',
        '20260820130000_image_cost_controls',
        '20260820150000_visual_document_editor',
      ]
      const migrationResult = await client.query(
        `SELECT migration_name FROM "_prisma_migrations"
         WHERE migration_name = ANY($1::text[]) AND finished_at IS NOT NULL`,
        [requiredMigrations],
      )
      const appliedMigrations = new Set(migrationResult.rows.map((row) => row.migration_name))
      database.missingMigrations = requiredMigrations.filter(
        (migration) => !appliedMigrations.has(migration),
      )
      database.migrationApplied = database.missingMigrations.length === 0
    }
  } catch (error) {
    database.errorCode = error?.code || error?.name || 'DATABASE_ERROR'
  } finally {
    if (client) await client.end().catch(() => undefined)
  }

  if (process.env.DATABASE_URL.includes('](')) {
    database.hint =
      'A DATABASE_URL contém marcação de link. Copie somente a URI PostgreSQL, sem [ ], ( ) ou http://.'
  } else if (
    database.errorCode === 'ENOTFOUND' &&
    database.host?.startsWith('db.') &&
    database.host.endsWith('.supabase.co')
  ) {
    database.hint =
      'O host direto do Supabase usa IPv6. Em uma rede IPv4, copie no painel Connect a URI do Supavisor Session pooler (porta 5432).'
  }
}

const report = {
  success:
    missing.length === 0 &&
    database.reachable &&
    database.schemaReady &&
    database.migrationApplied,
  projectRoot: cwd,
  envFileFound: envFile,
  warning,
  configured,
  missing,
  database,
  googleOAuth: {
    providerEnabled: configured.GOOGLE_CLIENT_ID && configured.GOOGLE_CLIENT_SECRET,
    authorizedJavaScriptOrigin: nextAuthUrl,
    authorizedRedirectUri: callbackUrl,
  },
  imageAI: {
    enabled: imageGenerationEnabled,
    provider: imageProvider,
    model:
      imageProvider === 'huggingface'
        ? process.env.IMAGE_MODEL?.trim() || 'black-forest-labs/FLUX.1-schnell'
        : process.env.GEMINI_IMAGE_MODEL?.trim() || 'gemini-2.5-flash-image',
    credentialConfigured:
      imageProvider === 'huggingface'
        ? Boolean(process.env.HUGGINGFACE_API_KEY?.trim())
        : Boolean(process.env.GEMINI_API_KEY?.trim()),
    fallbackEnabled:
      process.env.IMAGE_FALLBACK_ENABLED?.trim().toLowerCase() !== 'false',
    dailyLimit: Number(process.env.DAILY_IMAGE_LIMIT_PER_USER || 10),
  },
  nextSteps:
    missing.length > 0
      ? ['Preencha as variáveis ausentes e reinicie o npm run dev.']
      : !database.reachable
        ? [
            database.hint ||
              'Corrija DATABASE_URL ou inicie o PostgreSQL antes de testar login/cadastro.',
          ]
        : !database.schemaReady || !database.migrationApplied
          ? ['Execute npx prisma migrate dev e rode este diagnóstico novamente.']
          : ['Cadastre no Google Cloud exatamente a origem e a URI de redirecionamento acima.'],
}

console.log(JSON.stringify(report, null, 2))
if (!report.success) process.exitCode = 1
