# Geração real de imagens no + Educação

## Configuração

```env
AI_PROVIDER=gemini
GEMINI_API_KEY=SUA_CHAVE

IMAGE_PROVIDER=huggingface
HUGGINGFACE_API_KEY=hf_...
IMAGE_MODEL=black-forest-labs/FLUX.1-schnell
IMAGE_FALLBACK_ENABLED=true
IMAGE_FALLBACK_PROVIDER=gemini

FREE_IMAGE_TOTAL_LIMIT=2
PROFESSOR_MONTHLY_IMAGE_LIMIT=20
PREMIUM_MONTHLY_IMAGE_LIMIT=60
DAILY_IMAGE_LIMIT_PER_USER=10
```

A chave permanece no backend. O navegador recebe apenas URLs privadas como `/api/images/IMAGE_ID`.

## Teste direto dos providers

```powershell
npm run test:huggingface-image
npm run test:gemini-image
```

Em caso de sucesso, o script salva localmente a imagem de teste. Os arquivos estão no `.gitignore`.

Se retornar `IMAGE_QUOTA_UNAVAILABLE` com `limit: 0`, a integração está chegando à API, mas o projeto da chave não possui quota de imagens. Esse caso não pode ser corrigido no código: habilite faturamento/quota no Google AI Studio ou use outro projeto com acesso ao modelo.

## Fluxo

1. O provider textual gera o material e `visualResources` com posição, propósito, prompt e descrição alternativa.
2. A aplicação salva o material.
3. Cada slot visual reserva uma utilização de imagem.
4. Hugging Face/FLUX gera bytes reais; se configurado e necessário, Gemini Image atua como fallback.
5. Os bytes são armazenados em PostgreSQL (`MaterialImage.imageData`).
6. A imagem é servida somente após autenticação e verificação de propriedade.
7. Preview e PDF usam a mesma imagem persistida.

Falhar uma imagem não invalida o texto. Um registro `FAILED` é exibido com botão **Tentar novamente**.

## Posições

- `question:1` — vinculada à questão 1;
- `lesson:2` — vinculada à aula 2;
- `week:3` — vinculada à semana 3;
- `day:Segunda-feira` — vinculada ao dia;
- `section:desenvolvimento` — seção específica;
- `cover` — abertura/capa do material.

## Controles

Cada imagem permite:

- editar prompt;
- editar descrição alternativa;
- alterar estilo;
- gerar nova versão sem regenerar o texto;
- substituir por upload PNG/JPEG/WebP;
- excluir;
- ajustar largura em 50%, 75% ou 100%;
- alterar ordem.

## Cache

O cache usa SHA-256 de usuário, prompt final, estilo, acessibilidade, provider e modelo. Um resultado pronto do mesmo usuário pode ser copiado para outro material sem nova chamada à API e sem novo consumo de imagem.

## Produção

A implementação padrão armazena bytes no PostgreSQL, garantindo persistência e controle privado sem depender de arquivos temporários. Para volumes muito altos, a interface `ImageAIProvider` e o serviço em `lib/images/service.ts` permitem migrar o armazenamento para S3/Supabase Storage sem alterar o gerador textual ou o editor.
