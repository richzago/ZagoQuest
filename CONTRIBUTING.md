# Guia de Contribuição – ZagoQuest

Este projeto é privado e segue regras específicas de propriedade intelectual e organização de código.

---

## 📌 Antes de contribuir

* Você precisa ter sido **autorizado explicitamente** pelo proprietário para acessar o repositório.
* Ao contribuir, você concorda com os termos definidos em `LICENSE.md`, incluindo a cessão de direitos sobre qualquer contribuição feita ao projeto.

---

## 🔧 Padrões de código

* **Arquivos**: `camelCase.ts` (ex: `player.ts`, `combatSystem.ts`)
* **Classes**: `PascalCase`
* **Interfaces**: `PascalCase`
* **Enums**: `PascalCase`
* **Comentários**: Preferencialmente em português, explicando o motivo das decisões, não apenas o funcionamento
* **Imports**: Evitar extensões como `.js`

---

## 🧠 Estrutura do projeto

* Sistemas devem ser separados por responsabilidade
* Evitar lógica de jogo espalhada em entidades
* Priorizar sistemas desacoplados (CombatSystem, LootSystem, etc.)
* Dados devem ser preferencialmente data-driven (JSON)

---

## 🧪 Como rodar localmente

```bash
npm install
npm run dev
```

---

## 🧪 Testes

Sempre que possível, teste suas alterações antes de enviar:

* Verifique o comportamento no terminal
* Observe logs do sistema (`Logger`)
* Evite quebrar sistemas existentes

---

## 📦 Pull Requests

* Mantenha commits pequenos e organizados
* Explique mudanças complexas
* Evite misturar múltiplos sistemas em uma mesma alteração

---

## 🚫 Regras importantes

* Não reutilizar código do projeto fora dele
* Não expor partes do código sem autorização
* Não alterar sistemas centrais sem alinhamento

---

Obrigado por ajudar a evoluir o ZagoQuest.
