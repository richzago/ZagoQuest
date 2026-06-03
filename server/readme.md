# 🎮 ZagoQuest

MMORPG 2D inspirado em Tibia, desenvolvido com Node.js e TypeScript, utilizando uma arquitetura data-driven focada em escalabilidade, manutenção e futura integração com cliente gráfico.

---

# 🚀 Tecnologias

- **Node.js**
- **TypeScript**
- **Express**
- **TypeORM**
- **PostgreSQL**
- **Zod**
- **bcrypt**
- **JWT**
- **WebSocket** _(planejado)_
- **Unity** _(cliente futuro)_

---

# 📁 Estrutura do Projeto

```txt
src/
│
├── api/
│   ├── controllers/
│   ├── middlewares/
│   ├── routes/
│   └── services/
│
├── game/
│   ├── ai/
│   ├── chat/
│   ├── combat/
│   ├── core/
│   ├── entities/
│   ├── loaders/
│   ├── rendering/
│   ├── systems/
│   └── world/
│
├── data/
│   ├── monsters/
│   ├── items/
│   ├── npcs/
│   ├── spawns/
│   ├── skills/
│   └── maps/
│
├── shared/
│   ├── enums/
│   ├── interfaces/
│   ├── schemas/
│   └── types/
│
└── main.ts
```

---

# 🧠 Arquitetura

O projeto segue uma arquitetura **data-driven**, onde a maior parte do conteúdo do jogo é definida através de arquivos JSON.

Exemplos:

- Monstros
- Itens
- NPCs
- Loot
- Spawns
- Skills
- Mapas

Isso permite adicionar conteúdo sem alterar código-fonte.

---

# ✅ Sistemas Implementados

## Mundo

- Geração de mapa
- Tiles
- Colisão
- Viewport
- Renderização ASCII

## Entidades

- Players
- Monstros
- NPCs
- Corpos (Corpses)

## IA

- Aggro
- Chase
- Target Loss
- Flee System
- Cooldown de ataque

## Combate

- Ataque corpo a corpo
- Defesa
- Armadura
- Crítico
- Fórmulas de dano

## Progressão

- Sistema de experiência
- Level Up
- Skills por uso
- Evolução de atributos

## Loot

- Loot Table
- Drop de itens
- Corpses
- Coleta de loot

## Inventário

- Inventário
- Equipamentos
- Slots de equipamento

## Equipamentos

- Weapon
- Shield
- Armor
- Legs
- Boots

## Persistência

- Salvamento de jogadores
- Carregamento automático
- JSON Storage

## NPCs

- Comerciante
- Banqueiro

## Chat

- Local Chat
- World Chat
- Trade Chat
- Mensagens privadas
- Sistema de denúncias

## Eventos

- Event System
- Eventos desacoplados

## Logs

- Sistema de logs por canal
- Arquivos separados
- Rotação preparada
- Níveis de log
- Debug Mode

---

## 🔌 API REST

Base URL:

```txt
http://localhost:3000/api
```

---

## 📌 Endpoints gerais

| Método | Endpoint                         | Descrição          |
| ------ | -------------------------------- | ------------------ |
| POST   | `/accounts`                      | Criar conta        |
| POST   | `/sessions`                      | Login              |
| POST   | `/characters`                    | Criar personagem   |
| GET    | `/characters/account/:accountId` | Listar personagens |

---

## 🏰 Endpoints de Guildas

Base URL:

```txt
http://localhost:3000/api/guilds
```

| Método | Rota                          | Autenticação   | Descrição                                         |
| ------ | ----------------------------- | -------------- | ------------------------------------------------- |
| GET    | `/rank/level?page=1&limit=10` | ❌              | Lista guildas por nível (desc) e EXP (desempate). |
| GET    | `/rank/kills?page=1&limit=10` | ❌              | Ranking de guildas por kills (PvP).               |
| GET    | `/list?page=1&limit=100`      | ❌              | Lista todas as guildas.                           |
| GET    | `/:guildName`                 | ❌              | Detalhes completos de uma guilda.                 |
| PUT    | `/:guildName/description`     | ✅ Bearer token | Atualiza descrição (apenas líder).                |
| PUT    | `/:guildName/profile-image`   | ✅ Bearer token | Atualiza imagem de perfil (apenas líder).         |
| PUT    | `/:guildName/cover-image`     | ✅ Bearer token | Atualiza imagem de capa (apenas líder).           |
| POST   | `/` |                         | ✅ Bearer token | Cria uma nova guilda.                            |

---

## 🔐 Autenticação

Rotas protegidas exigem:

```txt
Authorization: Bearer <token>
```

O token é obtido via:

```txt
POST /api/sessions
```

---

## 🧪 Exemplo - Criar Conta

```json
{
  "email": "player@email.com",
  "cellphone": "+5511999999999",
  "fullName": "Player Example",
  "cpf": "12345678909",
  "birthDate": "1990-01-01",
  "password": "123456",
  "confirmPassword": "123456",
  "address": "Street Example, 123"
}
```

---

## 🔑 Exemplo - Login

```json
POST /api/sessions

{
  "email": "player@email.com",
  "password": "123456"
}
```

Resposta:

```json
{
  "token": "jwt-token",
  "accountId": "account-id"
}
```



---

## 🧭 Observação

As rotas de guilda estão em constante evolução e fazem parte do sistema social do ZagoQuest (PvP, ranking e progressão de guildas).

---


# 🎮 Comandos do Jogo

| Tecla | Ação          |
| ----- | ------------- |
| W     | Norte         |
| A     | Oeste         |
| S     | Sul           |
| D     | Leste         |
| Q     | Noroeste      |
| E     | Nordeste      |
| Z     | Sudoeste      |
| C     | Sudeste       |
| F     | Atacar        |
| G     | Coletar Loot  |
| I     | Inventário    |
| P     | Status        |
| L     | Skills        |
| R     | Pescar        |
| X     | Salvar e Sair |

---

# 🖥️ Executando o Projeto

## Instalar dependências

```bash
npm install
```

## Configurar ambiente

Crie um arquivo:

```txt
.env
```

Utilizando como base:

```txt
.env.example
```

Configure:

- Banco PostgreSQL
- JWT Secret
- Porta da API

---

## Rodar servidor

```bash
npm run dev
```

---

# 📌 Roadmap

## Próximos Sistemas

### Mundo

- [ ] Integração com Tiled
- [ ] Importador JSON de mapas
- [ ] Sistema de regiões
- [ ] Houses

### Combate

- [ ] Spell System
- [ ] Conditions
- [ ] Damage Types
- [ ] Vocações

### IA

- [ ] Pathfinding (A\*)
- [ ] Threat System
- [ ] Boss AI

### Multiplayer

- [ ] WebSocket Server
- [ ] Sincronização em tempo real
- [ ] Cliente Unity

### Social

- [ ] Party System
- [ ] Guild System
- [ ] Friends List

---

# 🎯 Objetivo

Construir um MMORPG moderno inspirado em Tibia e Ravendawn, utilizando tecnologias atuais, arquitetura escalável e conteúdo totalmente orientado a dados.

---

# 📄 Licença

Definir futuramente.

---

# 🙌 Créditos

Desenvolvido por **Richard Zago**.

**Projeto:** ZagoQuest

# 📊 Estado Atual

Versão: Alpha 0.1

✔ Mundo
✔ Monstros
✔ NPCs
✔ Combate
✔ Loot
✔ Inventário
✔ Equipamentos
✔ Persistência
✔ API REST

🚧 Em desenvolvimento

- Tiled
- WebSocket
- Cliente Unity
- Magias
- Pathfinding
