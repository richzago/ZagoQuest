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

# 🔌 API REST

Base URL:

```txt
http://localhost:3000/api
```

## Endpoints

| Método | Endpoint                         | Descrição          |
| ------ | -------------------------------- | ------------------ |
| POST   | `/accounts`                      | Criar conta        |
| POST   | `/sessions`                      | Login              |
| POST   | `/characters`                    | Criar personagem   |
| GET    | `/characters/account/:accountId` | Listar personagens |

---

## Exemplo - Criar Conta

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

## Exemplo - Login

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
