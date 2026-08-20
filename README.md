# + Educação — BNCC Planner

Plataforma profissional de planejamento pedagógico com BNCC, Inteligência Artificial, inclusão e acessibilidade.

## Tecnologias

- Next.js 16.2.1 (App Router), React 19 e TypeScript 5
- Node.js 20.9+ (Node.js 22 recomendado no Windows)
- Prisma 7 e PostgreSQL
- NextAuth.js com credenciais e Google OAuth
- Google Gemini via SDK oficial `@google/genai`
- Kiwify como única plataforma de checkout e assinatura
- Tailwind CSS 4, Word (`docx`) e impressão/PDF

## Planos

- **Teste Grátis:** 2 gerações no total por conta.
- **Professor:** assinatura recorrente Kiwify e limite mensal configurável.
- **Premium:** assinatura recorrente Kiwify e limite mensal obrigatoriamente superior ao Professor.

Os contadores ficam no PostgreSQL. Cookies, localStorage e sessionStorage não controlam acesso.

## Instalação

```bash
npm install
cp .env.example .env.local
npx prisma migrate dev
npm run dev
```

No PowerShell, copie o ambiente com:

```powershell
Copy-Item .env.example .env.local
```

## Variáveis principais

```env
DATABASE_URL=
NEXTAUTH_SECRET=
NEXTAUTH_URL=http://localhost:3000

GEMINI_API_KEY=
GEMINI_MODEL=gemini-flash-latest

PROFESSOR_MONTHLY_LIMIT=30
PREMIUM_MONTHLY_LIMIT=100

KIWIFY_PROFESSOR_CHECKOUT_URL=
KIWIFY_PREMIUM_CHECKOUT_URL=
KIWIFY_PROFESSOR_PRODUCT_ID=
KIWIFY_PREMIUM_PRODUCT_ID=
KIWIFY_WEBHOOK_TOKEN=
KIWIFY_CHECKOUT_STATE_SECRET=
KIWIFY_LATE_GRACE_DAYS=3
```

Nunca use `NEXT_PUBLIC_` em chaves, tokens ou segredos.

## Diagnóstico do ambiente e Google OAuth

Antes de testar cadastro/login, execute:

```bash
npm run check:env
```

O comando informa apenas se as variáveis existem e se o PostgreSQL responde; nenhum segredo é exibido.

No Google Cloud Console, configure um OAuth Client do tipo **Web application** com:

```text
Origem JavaScript autorizada: http://localhost:3000
URI de redirecionamento autorizada: http://localhost:3000/api/auth/callback/google
```

O `.env.local` precisa ficar na mesma pasta do `package.json`:

```env
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=SEGREDO_ALEATORIO
GOOGLE_CLIENT_ID=SEU_CLIENT_ID.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=SEU_CLIENT_SECRET
```

Depois de alterar o ambiente, pare e reinicie `npm run dev`. O projeto usa Webpack no Windows para evitar a falha nativa `qfilter`/BMI2 observada em CPUs sem essa instrução.

## Kiwify

Endpoint do webhook:

```text
POST https://SEU_DOMINIO/api/webhooks/kiwify
```

Eventos oficiais processados:

- `order_approved`
- `order_refunded`
- `chargeback`
- `subscription_canceled`
- `subscription_late`
- `subscription_renewed`

A assinatura é validada com HMAC-SHA1 usando o `signature` enviado na query string e o token configurado no webhook. O retorno do checkout nunca ativa uma assinatura; somente o webhook válido altera o banco.

Consulte o guia completo: **[docs/KIWIFY_SETUP.md](docs/KIWIFY_SETUP.md)**.

## Fluxo guiado de criação

O dashboard conduz o professor por seis etapas:

```text
Etapa → Área → Série → Tipo → Inclusão → Pedido → Resultado
```

As opções compatíveis ficam centralizadas em `lib/planning-options.ts`. O backend recebe IDs, valida cada relação e converte para os rótulos enviados à IA. O mesmo registro `LessonPlan` armazena etapa, área, série, tipo, pedido, preferências, habilidades BNCC, resultado e status.

No resultado, o usuário pode editar o pedido, duplicar, regenerar, melhorar, copiar, salvar automaticamente, exportar Word e imprimir/PDF. O histórico permite visualizar, editar, duplicar, adaptar, regenerar e excluir.

A etapa de Inclusão permite escolher contexto, necessidades educacionais, recursos de acessibilidade e um perfil estritamente pedagógico. Toda geração recebe princípios do DUA. O botão **Adaptar para Inclusão** preserva a versão original e salva uma segunda versão adaptada para comparação.

Aplique as migrações mais recentes:

```bash
npx prisma migrate dev
```

## IA textual e imagens

A seleção de providers é feita por ambiente:

```env
AI_PROVIDER=gemini
IMAGE_PROVIDER=huggingface
HUGGINGFACE_API_KEY=hf_...
IMAGE_MODEL=black-forest-labs/FLUX.1-schnell
IMAGE_FALLBACK_PROVIDER=gemini
```

A camada `lib/ai/providers` mantém Gemini como cérebro textual e permite trocar o provider visual entre Hugging Face/FLUX, Gemini Image e, futuramente, OpenAI. Imagens são persistidas de forma privada no PostgreSQL, possuem cache, limite diário/por plano, descrição alternativa, posição e controles individuais. Consulte [docs/HUGGINGFACE_FLUX.md](docs/HUGGINGFACE_FLUX.md) e [docs/AI_IMAGES.md](docs/AI_IMAGES.md).

## Campo Assunto

O Wizard possui um campo **Assunto** separado da disciplina e do pedido. Ele é obrigatório para todos os materiais pedagógicos, exceto “Outro”, é validado no backend, salvo em `LessonPlan.topic`, enviado como eixo principal do prompt e exibido no histórico, resultado e documento.

## PDF e impressão profissional

O PDF é gerado no backend com `@react-pdf/renderer`, em A4, separado da interface web. A camada em `lib/document-model.ts` transforma o conteúdo em um modelo de documento e `lib/pdf/PlanningPdfDocument.tsx` aplica margens, tipografia, capa, seções, tabelas, quebras, cabeçalho, rodapé e paginação.

Fluxo:

```text
Revisar → Editar conteúdo → Visualizar impressão → Imprimir / Baixar PDF
```

O endpoint autenticado é:

```text
GET /api/plans/[id]/pdf
```

## Geradores especializados

Cada tipo possui prompt, schema JSON, renderizador e validação próprios:

- Plano de aula;
- Sequência didática;
- Planejamento semanal;
- Planejamento mensal;
- Projeto pedagógico;
- Atividade com questões e gabarito;
- Avaliação com questões, critérios, gabarito e rubrica;
- Plano de ensino;
- Outro material interpretado conforme o pedido.

A camada `lib/planning-templates.ts` identifica quantidade, dificuldade, formato e tema. Quantidades de questões, aulas, semanas, etapas e unidades são validadas após a geração. Uma resposta divergente é corrigida automaticamente uma vez antes de ser rejeitada.

## Controle de acesso

Antes de chamar a IA, `POST /api/generate`:

1. valida a sessão;
2. expira assinaturas vencidas;
3. verifica plano/status/período;
4. reserva atomicamente uma geração no banco;
5. chama a Gemini somente se houver acesso;
6. libera a reserva se a IA ou a persistência falhar.

Isso impede chamadas simultâneas de ultrapassarem o limite.

## Testes

```bash
npm run test:kiwify
npm run test:planning
npm run test:materials
npm run test:images
npm run test:gemini-image
npm run test:huggingface-image
npm run test:pdf
npm run test:inclusion
npm run list:gemini
npm run test:gemini
npm run lint
npx tsc --noEmit
npm run build
```

O teste Kiwify cobre assinatura HMAC, adulteração do vínculo de checkout, eventos suportados, idempotência determinística, períodos, tolerância, cancelamento, reembolso, chargeback e proximidade de limite.

## Segurança

- `.env.local` é ignorado pelo Git.
- Nenhum segredo da Kiwify, banco ou Gemini é enviado ao frontend.
- Webhooks inválidos são rejeitados antes de qualquer escrita no banco.
- Payloads válidos são registrados para auditoria e processados de forma idempotente.
- Qualquer chave anteriormente exposta deve ser revogada e substituída.

## Editor visual e documento canônico

O editor em `/planos/[id]/editar-conteudo` salva automaticamente um documento estruturado, sem chamar IA. Preview, PDF e impressão limpa usam esse mesmo documento e os mesmos assets privados persistidos no PostgreSQL.

Após atualizar esta versão, aplique a migração:

```powershell
npx prisma migrate dev
npx prisma generate
```

Validação específica do editor e da imagem incorporada ao PDF:

```powershell
npm run test:editor
npm run test:pdf
```

Detalhes técnicos e regras de custo: [`docs/VISUAL_EDITOR.md`](docs/VISUAL_EDITOR.md).
