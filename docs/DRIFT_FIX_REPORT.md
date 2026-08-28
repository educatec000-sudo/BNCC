# Relatório de Correção de Drift Prisma - Supabase

**Data:** 2026-08-20
**Banco:** PostgreSQL Supabase (preservação total de dados)
**Problema:** `npx prisma migrate dev` retornava drift

```
Drift detected: Your database schema is not in sync with your migration history.
[*] Changed the `MaterialImage` table
[*] Altered column `planCode` (default changed from Some(Value(String("FREE"))) to None)

Migrations applied to the database but absent from the migrations directory are:
20260820135828

Last common migration:
20260820130000_image_cost_controls
```

---

## 1. Investigação da Migration Ausente

### Migrations locais antes da correção:
```
20260330142937_init
20260818150000_kiwify_subscriptions
20260818170000_planning_wizard
20260818200000_inclusive_education
20260819160000_specialized_material_generation
20260819180000_planning_topic
20260820120000_material_images
20260820130000_image_cost_controls   <-- última comum com o banco
20260820150000_visual_document_editor <- local apenas
```

### Faltando localmente, mas presente no banco:
```
20260820135828
```

### O que faz a migration `20260820130000_image_cost_controls`?
```sql
ALTER TABLE "MaterialImage"
  ADD COLUMN "planCode" TEXT NOT NULL DEFAULT 'FREE',
  ADD COLUMN "usageUnits" INTEGER NOT NULL DEFAULT 1;
```

Ela criou `planCode` **com** DEFAULT 'FREE'.

### Schema atual em `prisma/schema.prisma`:
```prisma
model MaterialImage {
  planCode     String   // sem @default
  usageUnits   Int      @default(1)
}
```

Conclusão lógica: a migration ausente `20260820135828` removeu o DEFAULT, mantendo a coluna NOT NULL.

### Verificação no Git
- `git log --all --full-history -- prisma/migrations/` mostra apenas o commit `efab0de primeiro commit`
- Nenhum histórico de arquivo deletado encontrado
- O `.git` confirma que `20260820135828` nunca foi versionada localmente - foi criada em outro ambiente (provavelmente produção/staging) e aplicada diretamente no Supabase sem push para o repo.

---

## 2. Análise de MaterialImage.planCode

**Regra de negócio atual (lib/images/service.ts):**
```ts
const planCode = subscription?.plan || "FREE" // linha 97
...
planCode: reservation.plan, // linha 139, 250, 265, 438
```

O código **sempre define planCode explicitamente** a partir da assinatura do usuário. Não deve depender de DEFAULT no banco.

- Cache reuse: `usageUnits: 0` mas `planCode` explícito
- Geração nova: `planCode: reservation.plan`
- Upload: `planCode: subscription?.plan || "FREE"`

Portanto **o comportamento correto é SEM default no banco**, forçando o código a sempre informar o plano. Isso preserva controle de custos e auditoria.

- Se mantivesse DEFAULT 'FREE', imagens criadas sem planCode explícito seriam contabilizadas como FREE incorretamente.
- Sem DEFAULT, o banco rejeita inserções sem planCode, protegendo integridade.

---

## 3. Solução Aplicada (sem perda de dados)

### NÃO foi executado:
- ❌ `migrate reset`
- ❌ DROP TABLE
- ❌ DELETE FROM _prisma_migrations
- ❌ Qualquer truncamento

### Foi executado:

**Criado:** `prisma/migrations/20260820135828/migration.sql`

```sql
-- Migration reconciled: remove default from MaterialImage.planCode
-- This migration was previously applied to Supabase but missing locally.
-- Original intent: enforce explicit planCode assignment in application code,
-- preserving cost control and plan logic.
-- Drift detected was: default changed from Some(Value(String("FREE"))) to None
ALTER TABLE "MaterialImage" ALTER COLUMN "planCode" DROP DEFAULT;
```

**Por que essa SQL?**
- É exatamente a operação inversa da criação com DEFAULT
- É idempotente e segura: não apaga dados, apenas remove o default
- Foi inferida do drift message: `Some(Value(String("FREE"))) -> None`
- Mantém coluna NOT NULL, apenas sem valor padrão

### Ordem cronológica corrigida:
```
20260820130000_image_cost_controls
20260820135828  <-- RECONCILIADO (agora existe localmente)
20260820150000_visual_document_editor
```

---

## 4. Validação Local

```bash
npx prisma generate
# ✔ Generated Prisma Client v7.6.0
```

`npx prisma migrate status` sem DATABASE_URL retorna:
```
Error: datasource.url property is required
```
Isso é esperado - confirma que pasta existe, mas não pode checar Supabase sem env.

---

## 5. Como Validar no Supabase (preservando dados)

### Passo 1 - Verificar nome exato da migration no banco

No Supabase SQL Editor ou psql:

```sql
SELECT migration_name, finished_at, applied_steps_count, checksum, logs
FROM "_prisma_migrations"
WHERE migration_name LIKE '20260820135828%'
ORDER BY finished_at DESC;
```

Guarde o `migration_name` exato. Se for `20260820135828` exato, nossa pasta já corrige.

Se for `20260820135828_algum_sufixo`, renomeie:

```bash
mv prisma/migrations/20260820135828 prisma/migrations/20260820135828_algum_sufixo
```

### Passo 2 - Verificar schema real

```sql
SELECT column_name, column_default, is_nullable, data_type
FROM information_schema.columns
WHERE table_name = 'MaterialImage' AND column_name = 'planCode';
```

Esperado após correção:
- `column_default = NULL`
- `is_nullable = NO`
- `data_type = TEXT`

### Passo 3 - Verificar dados preservados

```sql
SELECT COUNT(*) FROM "MaterialImage";
SELECT COUNT(*) FROM "LessonPlan";
SELECT COUNT(*) FROM "User";
SELECT planCode, COUNT(*) FROM "MaterialImage" GROUP BY planCode;
```

Nenhum COUNT deve ser zero se já havia dados antes (exceto tabelas vazias).

### Passo 4 - Testar migrate status

Com `.env.local` contendo `DATABASE_URL` do Supabase (Session Pooler porta 5432):

```bash
npx prisma migrate status
```

Resultado esperado **se o Supabase ainda não tem 20260820150000**:
```
Following migration have not yet been applied:
20260820150000_visual_document_editor
```

Isso NÃO é drift, é apenas pendente. Então aplique:

```bash
npx prisma migrate dev
# NÃO vai pedir reset, apenas aplica 20260820150000
```

Resultado esperado **se Supabase já tem 20260820150000 também**:
```
Database schema is up to date!
```

### Passo 5 - Testar migrate dev novamente

```bash
npx prisma migrate dev
```

Deve retornar sem pedir reset e sem drift.

### Passo 6 - Confirmar funcionalidades

```bash
npx prisma generate
npm run test:images
npm run test:planning
npm run check:env
```

---

## 6. O que foi alterado no schema?

**NADA no `schema.prisma` foi alterado manualmente.**

O schema já estava correto:
```prisma
planCode String
```

Nossa correção apenas adicionou o histórico que faltava para que `schema.prisma` e banco fiquem em sync.

Se você comparar:
- Antes: `schema.prisma` sem default vs migration `20260820130000` com default = DRIFT
- Depois: `schema.prisma` sem default vs `20260820130000` (com default) + `20260820135828` (drop default) = SYNC

---

## 7. Resumo Final para Resposta Obrigatória

1. **Qual migration estava faltando?**
   `20260820135828` aplicada no Supabase mas ausente em `prisma/migrations/`

2. **Qual alteração ela fazia?**
   `ALTER TABLE "MaterialImage" ALTER COLUMN "planCode" DROP DEFAULT;`
   Remove o DEFAULT 'FREE' criado em `20260820130000_image_cost_controls`, forçando definição explícita de plano no código.

3. **Como o histórico foi reconciliado?**
   - Verificado git: migration nunca versionada
   - Analisado drift message: `Some(FREE) -> None`
   - Analisada regra de negócio em `lib/images/service.ts` e `lib/plans-core.ts`
   - Criada pasta `prisma/migrations/20260820135828/` com SQL idêntico ao provável original
   - Mantida ordem cronológica: 13:00 → 13:58 → 15:00

4. **O que foi alterado no schema?**
   Nada em `schema.prisma`. Apenas adicionado histórico. Coluna continua `String` sem default, compatível com controle de custos.

5. **Confirmação de não perda de dados:**
   - SQL usado é `DROP DEFAULT` apenas, não toca em linhas
   - Nenhum `DROP TABLE`, `TRUNCATE`, `DELETE`, `RESET`
   - Instruções de verificação com `COUNT(*)` documentadas
   - `prisma generate` validado localmente

---

## 8. Próximos Passos para Você

1. Copie seu `.env.local` real com `DATABASE_URL` do Supabase para a raiz do projeto
2. Rode:
   ```bash
   npx prisma migrate status
   ```
   Se o nome exato da migration no banco tiver sufixo, me informe para renomear a pasta.
3. Se status mostrar `20260820150000_visual_document_editor` pendente, rode:
   ```bash
   npx prisma migrate dev
   ```
4. Nunca rode `migrate reset` em produção.

Se quiser, posso criar um script automatizado que, ao receber sua DATABASE_URL, faz backup lógico do schema, verifica `_prisma_migrations` e ajusta automaticamente o nome da pasta.
