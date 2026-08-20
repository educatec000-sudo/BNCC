# Hugging Face Inference Providers + FLUX

## Variáveis

```env
HUGGINGFACE_API_KEY=hf_...
IMAGE_PROVIDER=huggingface
IMAGE_MODEL=black-forest-labs/FLUX.1-schnell
HUGGINGFACE_INFERENCE_PROVIDER=auto

IMAGE_GENERATION_ENABLED=true
IMAGE_FALLBACK_ENABLED=true
IMAGE_FALLBACK_PROVIDER=gemini
DAILY_IMAGE_LIMIT_PER_USER=10

FREE_IMAGE_TOTAL_LIMIT=2
PROFESSOR_MONTHLY_IMAGE_LIMIT=20
PREMIUM_MONTHLY_IMAGE_LIMIT=60
```

O token deve possuir permissão para Inference Providers. Alguns modelos exigem aceitar termos/compartilhar dados de contato na página do modelo antes da primeira chamada.

## Teste real

```powershell
npm run test:huggingface-image
```

Sucesso esperado:

```json
{
  "success": true,
  "provider": "huggingface",
  "inferenceProvider": "auto",
  "model": "black-forest-labs/FLUX.1-schnell",
  "mimeType": "image/png",
  "bytes": 123456,
  "path": "image-test-output-hf.png"
}
```

Não presuma uso ilimitado ou gratuito. O Inference Provider escolhido pode exigir créditos, faturamento ou termos adicionais.

## Fallback

A ordem padrão é:

```text
Hugging Face/FLUX → Gemini Image
```

O fallback só é usado se estiver habilitado e a credencial correspondente existir. A falha de todos os providers cria um registro `FAILED`; o texto continua salvo e o usuário pode tentar novamente.

Para desabilitar:

```env
IMAGE_FALLBACK_ENABLED=false
```

Para trocar a ordem:

```env
IMAGE_PROVIDER=gemini
IMAGE_FALLBACK_PROVIDER=huggingface
```

## Administração

A configuração operacional é feita por variáveis de ambiente, sem exposição ao usuário comum:

- provider principal;
- modelo;
- roteador/provider do Hugging Face;
- ativação global;
- fallback;
- limite diário;
- limites por plano.

Alterações exigem reiniciar o servidor. Essa abordagem é apropriada para Vercel, Docker e outros ambientes de produção com secret manager.
