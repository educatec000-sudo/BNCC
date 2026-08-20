# Configuração da Kiwify no BNCC Planner

A Kiwify é a única responsável por checkout, pagamento, cobrança recorrente, renovação, atraso, cancelamento, reembolso e chargeback. O BNCC Planner nunca cria cobranças; ele apenas redireciona para os checkouts e reage aos webhooks autenticados.

Documentação oficial utilizada:

- [Webhooks da Kiwify](https://www.notion.so/kiwify/Webhooks-pt-br-c77eb84be10c42e6bb97cd391bca9dce)
- [Criar webhook pela API](https://docs.kiwify.com.br/api-reference/webhooks/create)
- [Como funcionam os webhooks](https://ajuda.kiwify.com.br/pt-br/article/como-funcionam-os-webhooks-2ydtgl/)
- [Preencher checkout por URL](https://ajuda.kiwify.com.br/pt-br/article/como-preencher-os-campos-do-checkout-pela-url-de7ezo/)
- [Parâmetros de rastreamento](https://ajuda.kiwify.com.br/pt-br/article/como-passar-parametros-de-rastreamento-na-url-do-checkout-src-utm-tags-entre-outros-1spiptc/)

## 1. Criar os produtos

Crie exatamente dois produtos de assinatura recorrente mensal no painel da Kiwify:

1. **BNCC Planner Professor**
2. **BNCC Planner Premium**

O Premium deve ter preço e limite superiores aos do Professor. A cobrança recorrente, número de tentativas, meios de pagamento e regras comerciais são configurados na Kiwify.

Para cada produto, copie:

- ID do produto;
- URL do checkout recorrente.

Configure no `.env.local`:

```env
KIWIFY_PROFESSOR_PRODUCT_ID=ID_REAL_DO_PRODUTO_PROFESSOR
KIWIFY_PREMIUM_PRODUCT_ID=ID_REAL_DO_PRODUTO_PREMIUM
KIWIFY_PROFESSOR_CHECKOUT_URL=https://pay.kiwify.com.br/SEU_CHECKOUT_PROFESSOR
KIWIFY_PREMIUM_CHECKOUT_URL=https://pay.kiwify.com.br/SEU_CHECKOUT_PREMIUM
```

O endpoint autenticado `POST /api/checkout` acrescenta os parâmetros oficiais `name`, `email` e `s1`. O `s1` contém um vínculo assinado e temporário com o usuário logado. Alterar manualmente esse vínculo invalida sua assinatura criptográfica.

## 2. Configurar limites

```env
PROFESSOR_MONTHLY_LIMIT=30
PREMIUM_MONTHLY_LIMIT=100
KIWIFY_LATE_GRACE_DAYS=3
```

`PREMIUM_MONTHLY_LIMIT` deve ser maior que `PROFESSOR_MONTHLY_LIMIT`; o servidor rejeita configuração inválida.

Os valores mostrados na página de preços são configuráveis separadamente:

```env
PROFESSOR_PRICE_LABEL=R$ 29,90/mês
PREMIUM_PRICE_LABEL=R$ 49,90/mês
```

## 3. Gerar os segredos

No PowerShell:

```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Use um resultado para o estado do checkout:

```env
KIWIFY_CHECKOUT_STATE_SECRET=SEGREDO_ALEATORIO_EXCLUSIVO
```

Ao criar o webhook, defina um token forte e salve exatamente o mesmo valor:

```env
KIWIFY_WEBHOOK_TOKEN=TOKEN_DEFINIDO_NO_WEBHOOK_KIWIFY
```

Nunca use prefixo `NEXT_PUBLIC_` nesses valores.

## 4. Aplicar a migração

Desenvolvimento:

```powershell
npx prisma migrate dev
```

Produção:

```powershell
npx prisma migrate deploy
```

A migração preserva usuários existentes, converte o antigo PRO em Professor, converte o antigo School em Premium, remove os campos Stripe, cria os contadores persistentes e cria o histórico idempotente de webhooks.

## 5. Criar o webhook

URL de produção:

```text
https://SEU_DOMINIO/api/webhooks/kiwify
```

No painel Kiwify, acesse **Apps → Webhooks → Criar Webhook** e selecione os dois produtos. Ative exatamente estes gatilhos oficiais:

- `compra_aprovada`
- `compra_reembolsada`
- `chargeback`
- `subscription_canceled`
- `subscription_late`
- `subscription_renewed`

No JSON recebido, os valores oficiais de `webhook_event_type` correspondentes são:

- `order_approved`
- `order_refunded`
- `chargeback`
- `subscription_canceled`
- `subscription_late`
- `subscription_renewed`

A Kiwify envia `signature` na query string. O endpoint valida conforme a documentação oficial:

```text
signature = hmac_sha1(JSON.stringify(request.body), token_do_webhook)
```

Uma assinatura inválida recebe HTTP 401 e não altera o banco.

## 6. Retorno do checkout

Configure a página de obrigado/retorno da Kiwify para:

```text
https://SEU_DOMINIO/dashboard?payment=processing
```

Esse retorno mostra apenas “aguardando confirmação”. Ele **não libera acesso**. O acesso é ativado somente por:

```text
Kiwify → webhook assinado → banco → assinatura ACTIVE
```

## 7. Eventos e efeitos

| Evento | Efeito no BNCC Planner |
|---|---|
| `order_approved` com `order_status=paid` | Ativa Professor/Premium e inicia o período |
| `subscription_renewed` com `order_status=paid` | Mantém ACTIVE, atualiza o período e zera o contador mensal |
| `subscription_late` | Define LATE e inicia tolerância configurável |
| `subscription_canceled` | Define CANCELLED e mantém acesso até `customer_access.access_until`/`next_payment` |
| `order_refunded` | Define REFUNDED e bloqueia imediatamente |
| `chargeback` | Define CHARGEBACK e bloqueia imediatamente |

Após o fim do período cancelado ou da tolerância do atraso, a verificação central converte o estado para EXPIRED.

## 8. Identificação do usuário

Ordem segura de associação do webhook:

1. `Subscription.subscription_id` já vinculado;
2. parâmetro oficial `TrackingParameters.s1`, assinado pelo backend;
3. `Customer.email` correspondente a uma conta existente.

O usuário precisa criar a conta no BNCC Planner antes de comprar. O checkout recebe o e-mail da conta automaticamente.

## 9. Idempotência e auditoria

Cada entrega é registrada em `WebhookEvent`. A chave idempotente usa o tipo oficial do evento, `order_id`/`subscription_id` e a versão temporal do payload. O processamento usa uma trava transacional PostgreSQL e reconsulta `processed` antes de atualizar a assinatura.

Reenvios do mesmo webhook retornam sucesso com `duplicate: true`, sem duplicar assinatura ou consumo.

## 10. Testes

Testes locais de assinatura, eventos e regras de período:

```powershell
npm run test:kiwify
```

Teste do checkout:

1. entre com um usuário;
2. abra `/assinatura`;
3. clique em Professor ou Premium;
4. confirme que o checkout correto da Kiwify abre com o e-mail preenchido.

Teste do ciclo real:

1. use o modo de teste disponível na sua conta Kiwify ou faça uma compra controlada;
2. confira **Apps → Webhooks → Ver logs**;
3. confirme HTTP 200 no endpoint;
4. confira `Subscription`, `Usage` e `WebhookEvent` no Prisma Studio:

```powershell
npx prisma studio
```

### Teste gratuito

1. crie uma conta nova;
2. primeira geração: deve mostrar `1/2`;
3. segunda geração: deve mostrar `2/2` e os dois botões de assinatura;
4. terceira tentativa: deve ser bloqueada antes de chamar a IA;
5. sair, limpar cookies ou trocar de navegador não deve alterar o contador, pois ele está em `Usage`.

### Professor e Premium

- Compra aprovada deve ativar o produto correspondente.
- Renovação deve atualizar o período e zerar apenas o contador mensal.
- Upgrade Professor → Premium deve trocar o plano após o webhook Premium.
- Um webhook atrasado da assinatura Professor antiga não pode rebaixar um Premium já ativo.
- Ao atingir o limite mensal, `/api/generate` deve bloquear antes da Gemini.

### Segurança

Envie uma requisição sem `signature` ou com assinatura incorreta. O resultado esperado é HTTP 401 e nenhuma alteração em `Subscription`/`Usage`.
