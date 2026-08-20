# Editor visual, assets persistentes e impressão

## Arquitetura

O material final possui um documento canônico salvo em `LessonPlan.editorDocument`.

- `editorDocument`: título, seções, elementos, questões, tabelas, cabeçalho, rodapé e configuração de página.
- `MaterialImage`: asset privado persistido em PostgreSQL (`BYTEA`).
- Elementos de imagem e questões guardam apenas `assetId`, largura e alinhamento.
- `DocumentRevision`: snapshots JSON do documento. Os snapshots mantêm IDs de assets e não duplicam bytes de imagem.
- `MaterialImageVersion`: original e versões explicitamente regeneradas/substituídas.
- `MaterialOperation`: separa operações com IA das edições manuais.

O editor, o preview limpo, o HTML de impressão e o PDF leem o mesmo `editorDocument` e os mesmos IDs de `MaterialImage`.

## Pipeline de imagem no PDF

1. O backend recebe os bytes reais do provedor ou upload.
2. `sharp` valida, corrige orientação, limita dimensões e normaliza para PNG.
3. Os bytes são persistidos no banco.
4. O preview usa a rota privada `/api/images/[id]`.
5. O PDF não depende de cookie, URL temporária ou navegador: lê os mesmos bytes do banco e os entrega ao `@react-pdf/renderer` como buffer PNG/JPEG.
6. Imagens antigas em WebP são convertidas em memória no momento do PDF.

A descrição alternativa permanece no atributo `alt` do HTML. Ela nunca é impressa como legenda. Prompt, provedor, modelo, estilo e versão aparecem apenas em **Configurações avançadas da imagem**, ocultas na impressão.

## Custos

Não chamam IA:

- texto, fonte, tamanho, cor e alinhamento;
- adicionar/duplicar/excluir/mover questão;
- cabeçalho, rodapé, margens e orientação;
- mover/redimensionar/alinha imagem;
- inserir arquivo local;
- salvamento automático.

Chamam IA e estão identificadas na interface:

- `✨ Gerar nova versão com IA`;
- `✨ Melhorar com IA`;
- `🖼️ Gerar nova imagem com IA`;
- `🖼️ Regenerar com IA`.

## Salvamento e concorrência

O editor usa debounce de 1,8 segundo e controle otimista por `editorVersion`. Uma segunda janela com versão antiga recebe HTTP `409 VERSION_CONFLICT`, em vez de sobrescrever silenciosamente o documento novo.

## Teste automatizado da imagem

```powershell
npm run test:editor
npm run test:pdf
```

`test:editor` usa a questão:

> Qual das figuras geométricas abaixo possui exatamente 3 lados?

O asset de teste contém círculo, quadrado, triângulo e retângulo. O teste confirma:

- mesma URL privada no preview;
- objeto de imagem incorporado ao PDF;
- referência persistente após edição manual;
- redimensionamento sem IA;
- ausência de prompt, estilo e descrição alternativa como texto visível.

## Migração

```powershell
npx prisma migrate dev
npx prisma generate
```

Em produção:

```powershell
npx prisma migrate deploy
```
