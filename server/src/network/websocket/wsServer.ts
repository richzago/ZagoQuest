/**
 * wsServer.ts
 *
 * Servidor WebSocket para comunicação em tempo real com o cliente Unity.
 * Gerencia conexões, roteamento de mensagens e broadcasts.
 *
 * @module network/websocket/wsServer
 */

import { Server as HttpServer, IncomingMessage } from "http";
import { WebSocketServer as WSServer, WebSocket } from "ws";
import { World } from "../../game/world/World";
import { Player } from "../../game/entities/player";
import { Logger } from "../../game/core/logger/logger";
import { HandlerContext } from "../handlers/HandlerContext";
import { PacketSender } from "../senders";
import { handlers, HandlerFn } from "../handlers/index";
import { MAX_PACKET_BYTES, parseClientMessage } from "../validation/messageValidation";
import { MessageRateLimiter, OrderedMessageQueue } from "../validation/messageGuards";
import { NpcInteractionSystem } from "../../game/systems/npcInteractionSystem";
import { FishingSystem } from "../../game/systems/fishingSystem";
import { BroadcastService } from "./wsBroadcast";
import { CombatEventBridge } from "./combatEventBridge";
import { ItemOnGround } from "../../game/entities/itemOnGround";
import { Corpse } from "../../game/entities/corpse";
import { Monster } from "../../game/entities/monster";
import { authorizeCharacterSession, type AuthorizedCharacter } from "../auth/characterSessionAuth";
import { DatabasePersistence } from "../../game/systems/databasePersistence";
import { isSafePlayerPosition, findSafePlayerPosition } from "../../game/world/playerPosition";
import { z } from "zod";
// Importar os novos senders específicos
import {
  InitialStateSender,
  InventorySender,
  PlayerStatsSender,
  WorldStateSender,
} from "../senders";

/**
 * Servidor WebSocket responsável por receber comandos dos clientes
 * e enviar atualizações do mundo.
 */
const authenticatePacket = z.strictObject({
  type: z.literal("authenticate"),
  token: z.string().min(1).max(8192),
  characterId: z.uuid(),
});

/**
 * Auth é obrigatória em produção. Em desenvolvimento a flag explícita
 * WS_AUTH_REQUIRED=true ativa o handshake sem quebrar o cliente legado.
 * Injeção permite integração socket real sem PostgreSQL em testes unitários.
 */
export interface WebSocketSessionOptions {
  authRequired?: boolean;
  authorize?: (token: string, characterId: string) => Promise<AuthorizedCharacter | null>;
  loadPlayer?: (authorized: AuthorizedCharacter) => Promise<Player | null>;
  savePlayer?: (player: Player) => Promise<void>;
}

export class WebSocketServer {
  private wss: WSServer;
  private world: World;
  private broadcast: BroadcastService;
  private combatEvents: CombatEventBridge;
  private clients: Map<WebSocket, Player> = new Map();
  private readonly messageQueues = new Map<WebSocket, OrderedMessageQueue>();
  private stopping = false;
  private closePromise?: Promise<void>;
  private static instance: WebSocketServer | undefined;
  private readonly authRequired: boolean;
  private readonly authorizeSession: (token: string, characterId: string) => Promise<AuthorizedCharacter | null>;
  private readonly loadSessionPlayer: (authorized: AuthorizedCharacter) => Promise<Player | null>;
  private readonly saveSessionPlayer: (player: Player) => Promise<void>;
  private readonly reservedCharacterIds = new Set<string>();
  // Account IDs always come from the verified JWT + character ownership check.
  // Keep a reservation during loading AND final save, not only for open sockets.
  private readonly reservedAccountIds = new Set<string>();
  private readonly socketAccountIds = new Map<WebSocket, string>();
  private readonly pendingSessionSaves = new Set<Promise<void>>();

  constructor(server: HttpServer, world: World, options: WebSocketSessionOptions = {}) {
    this.authRequired = process.env.NODE_ENV === "production" ||
      (options.authRequired ?? process.env.WS_AUTH_REQUIRED === "true");
    this.authorizeSession = options.authorize ?? authorizeCharacterSession;
    this.loadSessionPlayer = options.loadPlayer ??
      ((authorized) => DatabasePersistence.loadCharacter(authorized.characterName));
    this.saveSessionPlayer = options.savePlayer ?? ((current) => DatabasePersistence.saveCharacter(current));
    WebSocketServer.instance = this;
    this.world = world;
    this.broadcast = new BroadcastService(world);
    // ws rejects oversized frames BEFORE JSON.parse or Zod can allocate objects.
    this.wss = new WSServer({ server, maxPayload: MAX_PACKET_BYTES, perMessageDeflate: false });
    // Um listener por WebSocketServer, removido ao encerrar o transporte.
    this.combatEvents = new CombatEventBridge(world, this);
    this.wss.on("close", () => this.combatEvents.dispose());
    this.init();
  }

  private init(): void {
    this.wss.on("connection", (ws: WebSocket, req: IncomingMessage) => {
      if (this.stopping) {
        ws.close(1001, "Servidor encerrando.");
        return;
      }
      // Não registrar socket anônimo no BroadcastService.
      let player: Player | undefined;
      let authPending = false;
      let sessionClosing = false;
      let invalidPackets = 0;
      const limiter = new MessageRateLimiter();
      const sender = new PacketSender(ws);
      const ctx = new HandlerContext(this.world, this, sender, this.broadcast);
      const queue = new OrderedMessageQueue((error) => {
        Logger.error(`[NETWORK] Falha no handler: ${String(error)}`);
      });
      this.messageQueues.set(ws, queue);

      const initialSnapshot = (current: Player) => {
        InitialStateSender.send(ws, current);
        InventorySender.send(ws, current);
        // Persistido no banco: snapshot completo antes de qualquer equip/unequip.
        new InventorySender(ws).sendEquipment(current);
        PlayerStatsSender.send(ws, current);
        WorldStateSender.send(ws, this.world, current, [...this.clients.values()]);
      };
      const attach = (current: Player, accountId?: string) => {
        player = current;
        this.clients.set(ws, current);
        if (accountId) this.socketAccountIds.set(ws, accountId);
        this.broadcast.registerClient(ws, current);
        // Token e segredos nunca entram no log.
        Logger.system(`Personagem ${current.name} (${current.id}) associado ao socket.`);
      };
      const duplicate = (characterId: string) =>
        this.reservedCharacterIds.has(characterId) ||
        [...this.clients.values()].some((current) => current.id === characterId);
      const duplicateAccount = (accountId: string) =>
        this.reservedAccountIds.has(accountId) ||
        [...this.socketAccountIds.values()].includes(accountId);
      const refuseOnline = (reason: "alreadyOnline" | "accountAlreadyOnline") => {
        const characterOnline = reason === "alreadyOnline";
        const message = characterOnline ? "Personagem ja conectado." : "Conta ja possui personagem conectado.";
        const refusal = JSON.stringify({ type: "authRejected", reason });
        // NativeWebSocket only exposes close code, not textual reason: flush
        // the domain error first. Never send tokens, account IDs or other names.
        try {
          ws.send(refusal, () => {
            if (ws.readyState === WebSocket.OPEN) ws.close(1008, message);
          });
        } catch {
          if (ws.readyState === WebSocket.OPEN) ws.close(1008, message);
        }
      };
      let deadline: ReturnType<typeof setTimeout> | undefined;
      if (this.authRequired) {
        deadline = setTimeout(() => {
          if (!player && ws.readyState === WebSocket.OPEN) {
            ws.close(1008, "Autenticacao nao recebida.");
          }
        }, 8000);
        deadline.unref?.();
      } else {
        // Apenas o modo legado LOCAL mantém o bootstrap world.players[0].
        // Produção rejeita esta modalidade sem JWT.
        const legacy = this.world.players[0];
        if (!legacy || duplicate(legacy.id)) {
          ws.close(1008, "Personagem indisponivel.");
        } else {
          attach(legacy);
          initialSnapshot(legacy);
        }
      }

      ws.on("error", (error) => {
        Logger.warn(`[NETWORK] Falha de socket: ${String(error)}`);
      });

      ws.on("close", () => {
        if (deadline) clearTimeout(deadline);
        sessionClosing = true;
        const closingPlayer = player;
        const closingAccountId = this.socketAccountIds.get(ws);
        // Block reconnects to this account (even another character) until
        // the last queued command and final DB save have completed.
        if (closingPlayer && this.authRequired) {
          this.reservedCharacterIds.add(closingPlayer.id);
          if (closingAccountId) this.reservedAccountIds.add(closingAccountId);
        }
        this.socketAccountIds.delete(ws);
        if (closingPlayer) {
          FishingSystem.cancelFishing(closingPlayer);
          NpcInteractionSystem.close(closingPlayer);
          this.broadcast.unregisterClient(ws);
          this.clients.delete(ws);
          if (this.authRequired) this.broadcast.broadcastDespawn(closingPlayer.id);
        }
        // Um login subsequente deste UUID só será aceito após salvar dados.
        const finishing = (async () => {
          try {
            await queue.whenIdle();
            if (closingPlayer && this.authRequired)
              await this.saveSessionPlayer(closingPlayer);
          } catch (error) {
            Logger.error(`[SESSION] Falha encerrando/salvando ${closingPlayer?.name ?? "sessão"}: ${String(error)}`);
          } finally {
            if (closingPlayer && this.authRequired) {
              this.reservedCharacterIds.delete(closingPlayer.id);
              if (closingAccountId) this.reservedAccountIds.delete(closingAccountId);
            }
          }
        })();
        this.pendingSessionSaves.add(finishing);
        void finishing.finally(() => {
          this.pendingSessionSaves.delete(finishing);
          if (this.messageQueues.get(ws) === queue) this.messageQueues.delete(ws);
        });
      });

      ws.on("message", (data, isBinary) => {
        if (this.stopping || sessionClosing || ws.readyState !== WebSocket.OPEN) return;
        if (isBinary) {
          ws.close(1003, "Apenas JSON texto e permitido.");
          return;
        }
        if (!limiter.allow()) {
          ws.close(1008, "Limite de mensagens excedido.");
          return;
        }
        const raw = data.toString();
        if (this.authRequired && !player) {
          // Um socket não pode executar comandos antes da autenticação nem
          // iniciar diversas operações SQL de login ao mesmo tempo.
          if (authPending) {
            ws.close(1008, "Autenticacao em andamento.");
            return;
          }
          let decoded: unknown;
          try { decoded = JSON.parse(raw); } catch {
            ws.close(1008, "Autenticacao invalida.");
            return;
          }
          const parsed = authenticatePacket.safeParse(decoded);
          if (!parsed.success) {
            ws.close(1008, "Autenticacao invalida.");
            return;
          }
          authPending = true;
          void (async () => {
            let reservedId: string | undefined;
            let reservedAccountId: string | undefined;
            try {
              const identity = await this.authorizeSession(parsed.data.token, parsed.data.characterId);
              if (!identity || this.stopping || sessionClosing || ws.readyState !== WebSocket.OPEN) {
                if (ws.readyState === WebSocket.OPEN) ws.close(1008, "Acesso negado.");
                return;
              }
              if (duplicate(identity.characterId)) {
                refuseOnline("alreadyOnline");
                return;
              }
              if (duplicateAccount(identity.accountId)) {
                refuseOnline("accountAlreadyOnline");
                return;
              }
              // No await between this check and both reservations: simultaneous
              // handshakes on the same account cannot win with different UUIDs.
              reservedId = identity.characterId;
              reservedAccountId = identity.accountId;
              this.reservedCharacterIds.add(reservedId);
              this.reservedAccountIds.add(reservedAccountId);
              const existing = this.world.players.find((current) => current.id === reservedId);
              const loaded = existing ?? await this.loadSessionPlayer(identity);
              if (!loaded || loaded.id !== reservedId || this.stopping ||
                  sessionClosing || ws.readyState !== WebSocket.OPEN) {
                if (ws.readyState === WebSocket.OPEN) ws.close(1008, "Personagem indisponivel.");
                return;
              }
              if (!existing) {
                // Um personagem novo criado via REST ainda pode ter posX/posY=0.
                // Somente o servidor valida posição; fallback Tiled se inválida.
                if (!isSafePlayerPosition(this.world, loaded.position)) {
                  loaded.position = findSafePlayerPosition(
                    this.world, this.world.playerRespawn ?? { x: 2, y: 2 },
                  );
                }
                this.world.addPlayer(loaded);
              }
              attach(loaded, identity.accountId);
              // The active socket now holds the exclusive account slot.
              this.reservedCharacterIds.delete(reservedId);
              this.reservedAccountIds.delete(reservedAccountId!);
              reservedId = undefined;
              reservedAccountId = undefined;
              if (deadline) clearTimeout(deadline);
              ws.send(JSON.stringify({ type: "authenticated", characterId: loaded.id }));
              initialSnapshot(loaded);
              this.broadcast.broadcastPlayerSpawn(loaded, ws);
            } catch (error) {
              Logger.error(`[SESSION] Falha no login do personagem: ${String(error)}`);
              if (ws.readyState === WebSocket.OPEN) ws.close(1011, "Falha ao autenticar.");
            } finally {
              if (reservedId) this.reservedCharacterIds.delete(reservedId);
              if (reservedAccountId) this.reservedAccountIds.delete(reservedAccountId);
              authPending = false;
            }
          })();
          return;
        }
        if (!player) return; // socket legado recusado, ainda não fechado
        const parsed = parseClientMessage(raw);
        if (!parsed.ok) {
          invalidPackets++;
          if (invalidPackets >= 3) ws.close(1008, "Mensagens invalidas repetidas.");
          else ws.send(JSON.stringify({ type: "networkError", message: "Mensagem invalida." }));
          return;
        }
        const type = parsed.message.type;
        if (!Object.prototype.hasOwnProperty.call(handlers, type)) {
          ws.close(1008, "Comando desconhecido.");
          return;
        }
        const currentPlayer = player;
        const handler = handlers[type] as HandlerFn;
        if (!queue.enqueue(async () => {
          if (!this.stopping && !sessionClosing && ws.readyState === WebSocket.OPEN &&
              this.clients.get(ws) === currentPlayer) {
            await handler(ws, currentPlayer, parsed.message, ctx);
          }
        })) {
          ws.close(1008, "Fila de comandos excedida.");
        }
      });
    });
  }

  /**
   * Stops accepting WebSocket commands, drains handlers already running,
   * disconnects clients and closes the upgrade server. Idempotent.
   *
   * Must run BEFORE final autosave, so handlers cannot mutate player state
   * after it is persisted. The HTTP server is closed separately by lifecycle.
   */
  public close(): Promise<void> {
    if (this.closePromise) return this.closePromise;
    this.stopping = true;

    this.closePromise = (async () => {
      // Snapshot the active queues. A disconnected socket may be removed
      // from the map while its last handler is still finishing.
      const pendingHandlers = [...this.messageQueues.values()]
        .map((queue) => queue.whenIdle());
      await Promise.all(pendingHandlers);

      for (const client of this.wss.clients) {
        client.terminate();
      }

      try {
        await new Promise<void>((resolve, reject) => {
          this.wss.close((error?: Error) => {
            if (error) reject(error);
            else resolve();
          });
        });
      } finally {
        await Promise.allSettled([...this.pendingSessionSaves]);
        this.combatEvents.dispose();
        this.messageQueues.clear();
        this.clients.clear();
        this.socketAccountIds.clear();
        this.reservedCharacterIds.clear();
        this.reservedAccountIds.clear();
        if (WebSocketServer.instance === this) WebSocketServer.instance = undefined;
      }
    })();

    return this.closePromise;
  }

  // =========================
  // MÉTODOS DELEGADOS PARA BROADCAST (mantém compatibilidade)
  // =========================

  public broadcastMove(entityId: string, x: number, y: number, excludeSocket?: WebSocket): void {
    this.broadcast.broadcastMove(entityId, x, y, excludeSocket);
  }

  public broadcastDamage(targetId: string, newHp: number, maxHp: number, damage: number): void {
    this.broadcast.broadcastDamage(targetId, newHp, maxHp, damage);
  }

  public broadcastDespawn(entityId: string): void {
    this.broadcast.broadcastDespawn(entityId);
  }

  public broadcastChat(senderName: string, message: string, channel: string = "local"): void {
    this.broadcast.broadcastChat(senderName, message, channel);
  }

  public broadcastSpawn(monster: Monster): void {
    this.broadcast.broadcastSpawn(monster);
  }

  public broadcastSpawnCorpse(corpse: Corpse): void {
    this.broadcast.broadcastSpawnCorpse(corpse);
  }

  public broadcastSpawnItemOnGround(item: ItemOnGround): void {
    this.broadcast.broadcastSpawnItemOnGround(item);
  }

  public sendToPlayer(playerId: string, message: string): void {
    this.broadcast.sendToPlayer(playerId, message);
  }

  public sendChatToPlayer(playerId: string, message: string): void {
    this.broadcast.sendChatToPlayer(playerId, message);
  }

  // =========================
  // SINGLETON
  // =========================

  public static getInstance(): WebSocketServer | undefined {
    return WebSocketServer.instance;
  }

  /** Operational gauges without exposing identity, character data or JWT. */
  public getNetworkLoad(): { connected: number; pendingCommands: number; maxQueueDepth: number } {
    const depths = [...this.messageQueues.values()].map(queue => queue.pending);
    return {
      connected: this.clients.size,
      pendingCommands: depths.reduce((sum, depth) => sum + depth, 0),
      maxQueueDepth: depths.length ? Math.max(...depths) : 0,
    };
  }

  public getBroadcastService(): BroadcastService {
    return this.broadcast;
  }
}
