# ZagoQuest — frontend

Site de apresentação responsivo em português, com Vite e JavaScript. Inclui ilustrações SVG locais, vocações interativas, FAQ, menu móvel e diálogos acessíveis. Não depende do servidor do jogo.

## Executar

Requer Node.js 22 ou superior (validado com Node.js 24).

```bash
cd /workspace/ZagoQuest/web
npm ci --cache /workspace/.cache/npm
npm run dev
```

O Vite usa a porta 5173 por padrão. Para produção:

```bash
npm run build
npm run preview
```

Publique o conteúdo de `web/dist` em uma hospedagem estática. Ainda não há hospedagem pública configurada. A execução local no ambiente não publica o site na internet.

## Escopo

As vocações, ilustrações e recursos apresentados são conceitos criativos. O frontend não oferece login, cadastro, pagamentos, lista de espera ou cliente jogável. O botão de acompanhar copia o endereço atual; o GitHub exige permissão para o repositório privado. A tipografia usa Google Fonts com fallback local em Georgia/Arial.
