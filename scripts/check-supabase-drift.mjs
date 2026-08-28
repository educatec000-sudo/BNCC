import { config } from "dotenv";
import { existsSync } from "fs";
import { join } from "path";
if (existsSync(".env.local")) config({ path: ".env.local" });
config({ path: ".env" });

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL não encontrada em .env.local ou .env");
  process.exit(1);
}
const { default: pg } = await import("pg");
const client = new pg.Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
await client.connect();
console.log("Conectado ao Supabase");

const migrations = await client.query(`SELECT migration_name, finished_at, checksum FROM "_prisma_migrations" ORDER BY finished_at`);
console.log("\n=== _prisma_migrations no banco ===");
migrations.rows.forEach(r => console.log(r.migration_name, "-", r.finished_at));

const target = migrations.rows.find(r => r.migration_name.startsWith("20260820135828"));
if (target) {
  console.log("\n✓ Encontrada migration alvo no banco:", target.migration_name);
  console.log("Checksum banco:", target.checksum);
} else {
  console.log("\n✗ Migration 20260820135828 NÃO encontrada no banco - talvez já foi marcada como rolled back?");
}

const col = await client.query(`
  SELECT column_name, column_default, is_nullable, data_type
  FROM information_schema.columns
  WHERE table_name = 'MaterialImage' AND column_name = 'planCode'
`);
console.log("\n=== Coluna MaterialImage.planCode no banco ===");
console.log(col.rows[0]);

const counts = await client.query(`
  SELECT 
    (SELECT COUNT(*) FROM "MaterialImage") as images,
    (SELECT COUNT(*) FROM "LessonPlan") as plans,
    (SELECT COUNT(*) FROM "User") as users
`);
console.log("\n=== Contagem de dados (não deve ser 0 se havia dados) ===");
console.log(counts.rows[0]);

await client.end();
