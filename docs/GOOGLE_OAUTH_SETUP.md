# Google OAuth no Windows

## 1. Local correto do `.env.local`

O arquivo precisa ficar na mesma pasta de `package.json`.

Exemplo correto:

```text
BNCC-kiwify-completo/
└── BNCC/
    ├── package.json
    ├── .env.local   ← aqui
    └── app/
```

O projeto detecta um `.env.local` criado por engano na pasta-pai durante o desenvolvimento, mas mostra um aviso para que ele seja movido.

## 2. Variáveis obrigatórias

```env
DATABASE_URL=postgresql://...
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=SEU_SEGREDO
GOOGLE_CLIENT_ID=SEU_CLIENT_ID.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=SEU_CLIENT_SECRET
```

Gere o segredo:

```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Não use aspas tipográficas, espaços antes do nome da variável ou prefixo `NEXT_PUBLIC_`.

## 3. Google Cloud Console

1. Abra **APIs e serviços → Tela de consentimento OAuth**.
2. Configure o aplicativo e, se estiver em modo de teste, adicione seu e-mail em **Usuários de teste**.
3. Abra **Credenciais → Criar credenciais → ID do cliente OAuth**.
4. Escolha **Aplicativo da Web**.
5. Configure exatamente:

```text
Origens JavaScript autorizadas
http://localhost:3000

URIs de redirecionamento autorizados
http://localhost:3000/api/auth/callback/google
```

Em produção, adicione também:

```text
https://SEU_DOMINIO
https://SEU_DOMINIO/api/auth/callback/google
```

Não use barra final na origem e não troque `localhost` por `127.0.0.1` sem cadastrar também a URI correspondente.

## 4. Banco de dados

Google OAuth cria/consulta o usuário por meio do Prisma Adapter. Portanto, o login só funciona se o PostgreSQL estiver acessível e migrado:

```powershell
npx prisma migrate dev
```

Produção:

```powershell
npx prisma migrate deploy
```

### Supabase e erro `ENOTFOUND`

O host direto `db.PROJECT_REF.supabase.co` usa IPv6. Se seu Windows/rede não possui IPv6, abra **Supabase → Connect**, selecione **Session pooler** e copie a URI que termina na porta `5432`:

```env
DATABASE_URL="postgresql://postgres.PROJECT_REF:SENHA@aws-0-REGIAO.pooler.supabase.com:5432/postgres?sslmode=require"
```

Não copie a versão formatada como link e não inclua `[` `]` `(http://...)` dentro da variável.

## 5. Diagnóstico

```powershell
npm run check:env
```

O resultado precisa indicar:

```json
{
  "success": true,
  "configured": {
    "DATABASE_URL": true,
    "NEXTAUTH_SECRET": true,
    "NEXTAUTH_URL": true,
    "GOOGLE_CLIENT_ID": true,
    "GOOGLE_CLIENT_SECRET": true
  },
  "database": {
    "reachable": true,
    "schemaReady": true,
    "migrationApplied": true,
    "missingTables": []
  }
}
```

O comando não mostra o conteúdo das chaves.

## 6. Reiniciar sem Turbopack

Depois de alterar `.env.local`:

```powershell
Ctrl+C
Remove-Item -Recurse -Force .next -ErrorAction SilentlyContinue
npm run dev
```

O script usa `next dev --webpack`. Isso evita o panic do componente Rust `qfilter` em processadores Windows sem instruções BMI2.

## 7. Avisos do log

Se aparecer:

```text
client_id is required
NEXTAUTH_URL
NO_SECRET
```

as variáveis não foram carregadas. Execute `npm run check:env` e confira a localização do arquivo.

Se aparecer `ECONNREFUSED`, o PostgreSQL definido em `DATABASE_URL` não está aceitando conexões. Inicie o banco ou corrija host/porta.

O aviso de depreciação de `url.parse()` vem de uma dependência transitiva do NextAuth v4 e não é a causa da falha de autenticação.

## 8. Conta já cadastrada por e-mail e senha

O Google é configurado com vinculação automática por e-mail verificado. Assim, se a conta já foi criada com e-mail/senha e depois o usuário entrar com a mesma conta Google, o registro OAuth é vinculado ao mesmo usuário em vez de retornar `OAuthAccountNotLinked`.

A vinculação automática está habilitada somente para o Google e o callback rejeita perfis sem `email_verified=true`.
