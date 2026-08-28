import { existsSync, readdirSync } from "fs";
import { join } from "path";

console.log("=== Verificação Local de Drift Fix ===\n");

const migrationsDir = "prisma/migrations";
const migrations = readdirSync(migrationsDir).filter(f => !f.endsWith(".toml")).sort();
console.log("Migrations locais:");
migrations.forEach(m => console.log(" -", m));

const required = ["20260820130000_image_cost_controls", "20260820135828", "20260820150000_visual_document_editor"];
console.log("\nChecando ordem cronológica:");
required.forEach(r => {
  const found = migrations.some(m => m.startsWith(r.split('_')[0]));
  console.log(` ${found ? "✓" : "✗"} ${r} ${found ? "presente" : "FALTANDO"}`);
});

const missingPath = join(migrationsDir, "20260820135828", "migration.sql");
if (existsSync(missingPath)) {
  const { readFileSync } = await import("fs");
  console.log("\n✓ Migration reconciliada existe:");
  console.log(readFileSync(missingPath, "utf8"));
} else {
  console.log("\n✗ Migration 20260820135828/migration.sql NÃO existe");
}

console.log("\n=== Schema Check ===");
const schema = (await import("fs")).readFileSync("prisma/schema.prisma","utf8");
const match = schema.match(/model MaterialImage \{[^}]+\}/s);
if (match) {
  console.log(match[0].split("\n").slice(0,15).join("\n"));
  if (match[0].includes('planCode') && !match[0].includes('planCode') ) {}
  const hasDefault = /planCode.*@default/.test(match[0]);
  console.log(`\nplanCode tem @default? ${hasDefault ? "SIM (drift esperado)" : "NÃO (correto, sem default)"}`);
}

console.log("\n=== Próximos passos ===");
console.log("1. Configure DATABASE_URL em .env.local");
console.log("2. npx prisma migrate status");
console.log("3. Se migration_name exato no banco tiver sufixo, renomeie a pasta");
console.log("4. npx prisma migrate dev (não deve pedir reset)");

if (!process.env.DATABASE_URL) {
  console.log("\n⚠️ DATABASE_URL não definida - não foi possível checar Supabase");
  console.log("Para checar Supabase, defina DATABASE_URL e rode:");
  console.log("  node scripts/check-supabase-drift.mjs");
}
