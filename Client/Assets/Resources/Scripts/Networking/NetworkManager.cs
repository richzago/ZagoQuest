using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using UnityEngine;
using NativeWebSocket;

/// <summary>
/// Gerencia a conexão WebSocket com o servidor, enviando comandos e recebendo eventos.
/// Implementa o padrão Singleton.
/// </summary>
/// 
[DefaultExecutionOrder(-100)]
public class NetworkManager : MonoBehaviour
{

    public static NetworkManager Instance { get; private set; }
    public string serverUrl = "ws://localhost:3000";

    private WebSocket websocket;
    public bool isConnected { get; private set; } = false;

    // =========================
    // EVENTOS DE RECEPÇÃO (cliente → scripts UI)
    // =========================
    public event Action<string, Vector2> OnInit;
    public event Action<Vector2> OnPositionReceived;
    public event Action<int, Dictionary<string, int>> OnInventoryReceived;
    public event Action<string, bool, string> OnItemUsed;
    public event Action<int, int, int, int, int, int, int> OnPlayerStats;

    // Eventos da economia
    public event Action<string, ShopItem[]> OnShopWindow;           // npcId, itens
    public event Action<bool, string> OnBuyResult;                  // success, message
    public event Action<int, int> OnBankWindow;                     // bankGold, gold (abrir banco)
    public event Action<bool, string, int, int> OnBankResult;       // success, message, bankGold, gold

    async void Start()
    {
        if (Instance == null) Instance = this;
        else Destroy(gameObject);
        await Connect();
    }

    async Task Connect()
    {
        websocket = new WebSocket(serverUrl);
        websocket.OnOpen += () => Debug.Log("WebSocket conectado!");
        websocket.OnError += (e) => Debug.LogError($"WebSocket erro: {e}");
        websocket.OnClose += (e) =>
        {
            Debug.Log($"WebSocket fechado: {e}");
            isConnected = false;
        };

        websocket.OnMessage += (bytes) =>
        {
            string message = System.Text.Encoding.UTF8.GetString(bytes);
            // Extrai o campo "type" com uma classe mínima
            var simpleMsg = JsonUtility.FromJson<SimpleMessage>(message);
            if (simpleMsg == null) return;

            switch (simpleMsg.type)
            {
                // --- Movimento, spawn, combate, loot (existente) ---
                case "init":
                    var initMsg = JsonUtility.FromJson<InitMessage>(message);
                    lastPlayerId = initMsg.playerId;
                    lastInitPosition = new Vector2(initMsg.x, initMsg.y);
                    Debug.Log($"[NetworkManager] Init recebido: playerId={lastPlayerId}, pos={lastInitPosition}");
                    OnInit?.Invoke(initMsg.playerId, new Vector2(initMsg.x, initMsg.y));
                    isConnected = true;
                    break;
                case "position":
                    var posMsg = JsonUtility.FromJson<PositionMessage>(message);
                    OnPositionReceived?.Invoke(new Vector2(posMsg.x, posMsg.y));
                    break;
                case "spawn":
                    var spawnMsg = JsonUtility.FromJson<SpawnMessage>(message);
                    EntityManager.Instance?.SpawnEntity(spawnMsg.id, spawnMsg.name, spawnMsg.x, spawnMsg.y, spawnMsg.hp);
                    break;
                case "move":
                    var moveMsg = JsonUtility.FromJson<MoveEntityMessage>(message);
                    EntityManager.Instance?.MoveEntity(moveMsg.id, moveMsg.x, moveMsg.y);
                    break;
                case "despawn":
                    var despawnMsg = JsonUtility.FromJson<DespawnMessage>(message);
                    EntityManager.Instance?.DespawnEntity(despawnMsg.id);
                    break;
                case "damage":
                    var damageMsg = JsonUtility.FromJson<DamageMessage>(message);
                    EntityManager.Instance?.UpdateMonsterHp(damageMsg.targetId, damageMsg.newHp, damageMsg.maxHp);
                    break;
                case "chat":
                    var chatMsg = JsonUtility.FromJson<ChatMessageReceived>(message);
                    if (ChatUI.Instance != null) ChatUI.Instance.AddMessage(chatMsg.message);
                    break;
                case "lootWindow":
                    var lootMsg = JsonUtility.FromJson<LootWindowMessage>(message);
                    if (LootUI.Instance != null) LootUI.Instance.ShowLootWindow(lootMsg.corpseId, lootMsg.items);
                    break;
                case "lootTaken":
                    LootUI.Instance?.CloseLootWindow();
                    break;
                case "lootError":
                    var lootErrorMsg = JsonUtility.FromJson<LootErrorMessage>(message);
                    Debug.LogError($"Erro ao lootear: {lootErrorMsg.message}");
                    break;

                // --- Inventário e estatísticas ---
                case "inventory":
                    var invMsg = JsonUtility.FromJson<InventoryMessage>(message);
                    var itemsDict = new Dictionary<string, int>();
                    if (invMsg.items != null)
                    {
                        foreach (var item in invMsg.items)
                            itemsDict[item.itemId] = item.amount;
                    }
                    OnInventoryReceived?.Invoke(invMsg.gold, itemsDict);
                    // Debug.Log($"💰 Inventário recebido: gold={invMsg.gold}, itens={itemsDict.Count}");
                    break;
                case "itemUsed":
                    var itemUsedMsg = JsonUtility.FromJson<ItemUsedMessage>(message);
                    OnItemUsed?.Invoke(itemUsedMsg.itemId, itemUsedMsg.success, itemUsedMsg.message);
                    break;
                case "playerStats":
                    var statsMsg = JsonUtility.FromJson<PlayerStatsMessage>(message);
                    OnPlayerStats?.Invoke(statsMsg.hp, statsMsg.maxHp, statsMsg.mana, statsMsg.maxMana, statsMsg.level, statsMsg.attack, statsMsg.defense);
                    break;

                // --- ECONOMIA (merchant / banker) ---
                case "shopWindow":
                    var shopMsg = JsonUtility.FromJson<ShopWindowMessage>(message);
                    Debug.Log($"[NETWORK] shopWindow RECEBIDO: npcId={shopMsg.npcId}, itens={shopMsg.items?.Length}");
                    if (shopMsg.items != null)
                    {
                        OnShopWindow?.Invoke(shopMsg.npcId, shopMsg.items);
                    }
                    break;
                case "buyResult":
                    var buyResultMsg = JsonUtility.FromJson<BuyResultMessage>(message);
                    OnBuyResult?.Invoke(buyResultMsg.success, buyResultMsg.message);
                    break;
                case "bankWindow":
                    var bankWinMsg = JsonUtility.FromJson<BankWindowMessage>(message);
                    Debug.Log($"[NETWORK] bankWindow RECEBIDO: bankGold={bankWinMsg.bankGold}, gold={bankWinMsg.gold}");
                    OnBankWindow?.Invoke(bankWinMsg.bankGold, bankWinMsg.gold);
                    break;
                case "bankResult":
                    var bankResMsg = JsonUtility.FromJson<BankResultMessage>(message);
                    OnBankResult?.Invoke(bankResMsg.success, bankResMsg.message, bankResMsg.bankGold, bankResMsg.gold);
                    break;
                case "goldUpdate":
                    var goldUpdMsg = JsonUtility.FromJson<GoldUpdateMessage>(message);
                    // Atualiza qualquer UI que mostre gold (ex: HUD, inventário)
                    // O inventário já atualiza via OnInventoryReceived, mas podemos disparar evento separado se necessário.
                    // Por enquanto, apenas log.
                    // Debug.Log($"💰 Gold atualizado: mochila={goldUpdMsg.gold}, banco={goldUpdMsg.bankGold}");
                    break;
                case "shopError":
                    var shopErrMsg = JsonUtility.FromJson<ShopErrorMessage>(message);
                    Debug.LogError($"Erro na loja: {shopErrMsg.message}");
                    if (ChatUI.Instance != null) ChatUI.Instance.AddMessage($"Loja: {shopErrMsg.message}");
                    break;
                case "bankError":
                    var bankErrMsg = JsonUtility.FromJson<BankErrorMessage>(message);
                    Debug.LogError($"Erro no banco: {bankErrMsg.message}");
                    if (ChatUI.Instance != null) ChatUI.Instance.AddMessage($"Banco: {bankErrMsg.message}");
                    break;


                default:
                    Debug.LogWarning($"Tipo de mensagem não tratado: {simpleMsg.type}");
                    break;
            }
        };

        await websocket.Connect();
        Debug.Log("Conectado ao servidor WebSocket");
        isConnected = true;
    }

    void Update()
    {
#if !UNITY_WEBGL || UNITY_EDITOR
        websocket?.DispatchMessageQueue();
#endif
    }

    // =========================
    // ENVIO DE MENSAGENS (comandos do cliente)
    // =========================

    // Movimento, chat, ataque, loot (já existentes)
    public async void SendMove(Vector2 targetPos)
    {
        if (websocket == null || websocket.State != WebSocketState.Open) return;
        var moveMsg = new MoveMessage { type = "move", x = targetPos.x, y = targetPos.y };
        await websocket.SendText(JsonUtility.ToJson(moveMsg));
    }

    public async void SendChat(string message)
    {
        if (websocket == null || websocket.State != WebSocketState.Open) return;
        var chatMsg = new ChatMessage { type = "chat", message = message };
        await websocket.SendText(JsonUtility.ToJson(chatMsg));
    }

    public async void SendAttack(string targetId)
    {
        if (websocket == null || websocket.State != WebSocketState.Open) return;
        var attackMsg = new AttackMessage { type = "attack", targetId = targetId };
        await websocket.SendText(JsonUtility.ToJson(attackMsg));
    }

    public async void SendLoot(string corpseId)
    {
        if (websocket == null || websocket.State != WebSocketState.Open) return;
        var lootMsg = new LootMessage { type = "loot", corpseId = corpseId };
        await websocket.SendText(JsonUtility.ToJson(lootMsg));
    }

    public async void SendTakeLoot(string corpseId, bool takeAll = true, int itemIndex = -1)
    {
        if (websocket == null || websocket.State != WebSocketState.Open) return;
        var takeMsg = new TakeLootMessage
        {
            type = "takeLoot",
            corpseId = corpseId,
            takeAll = takeAll,
            itemIndex = itemIndex
        };
        await websocket.SendText(JsonUtility.ToJson(takeMsg));
    }

    // Inventário
    public void UseItem(string itemId)
    {
        if (websocket == null || websocket.State != WebSocketState.Open) return;
        var useMsg = new UseItemMessage { type = "useItem", itemId = itemId };
        websocket.SendText(JsonUtility.ToJson(useMsg));
    }

    public void DropItem(string itemId, int amount = 1)
    {
        if (websocket == null || websocket.State != WebSocketState.Open) return;
        var dropMsg = new DropItemMessage { type = "dropItem", itemId = itemId, amount = amount };
        websocket.SendText(JsonUtility.ToJson(dropMsg));
    }

    // =========================
    // COMANDOS DA ECONOMIA
    // =========================

    /// <summary> Envia comando para abrir a loja do merchant. </summary>
    public void SendOpenShop(string npcId)
    {
        if (websocket == null || websocket.State != WebSocketState.Open) return;
        var msg = new OpenShopMessage { type = "openShop", npcId = npcId };
        websocket.SendText(JsonUtility.ToJson(msg));
        // Debug.Log($"[NETWORK] Enviado openShop para npcId={npcId}");
    }

    /// <summary> Envia comando para abrir o banco. </summary>
    public void SendOpenBank(string npcId)
    {
        if (websocket == null || websocket.State != WebSocketState.Open) return;
        var msg = new OpenBankMessage { type = "openBank", npcId = npcId };
        websocket.SendText(JsonUtility.ToJson(msg));
        // Debug.Log($"[NETWORK] Enviado openBank para npcId={npcId}");
    }

    /// <summary> Envia comando para comprar um item. </summary>
    public void SendBuyItem(string npcId, string itemId, int amount)
    {
        if (websocket == null || websocket.State != WebSocketState.Open) return;
        var msg = new BuyItemMessage { type = "buyItem", npcId = npcId, itemId = itemId, amount = amount };
        websocket.SendText(JsonUtility.ToJson(msg));
    }

    /// <summary> Envia depósito de gold no banco. </summary>
    public void SendDeposit(int amount)
    {
        if (websocket == null || websocket.State != WebSocketState.Open) return;
        var msg = new DepositMessage { type = "deposit", amount = amount };
        websocket.SendText(JsonUtility.ToJson(msg));
    }

    /// <summary> Envia saque de gold do banco. </summary>
    public void SendWithdraw(int amount)
    {
        if (websocket == null || websocket.State != WebSocketState.Open) return;
        var msg = new WithdrawMessage { type = "withdraw", amount = amount };
        websocket.SendText(JsonUtility.ToJson(msg));
    }

    async void OnDestroy()
    {
        if (websocket != null && websocket.State == WebSocketState.Open)
            await websocket.Close();
    }

    public void SendMoveDir(string direction)
    {
        if (websocket == null || websocket.State != WebSocketState.Open) return;
        var msg = new MoveDirMessage { type = "moveDir", dir = direction };
        websocket.SendText(JsonUtility.ToJson(msg));
    }

    public void SendStartAutoAttack(string targetId)
    {
        if (websocket == null || websocket.State != WebSocketState.Open) return;
        var msg = new StartAutoAttackMessage { type = "startAutoAttack", targetId = targetId };
        websocket.SendText(JsonUtility.ToJson(msg));
    }

    public void SendStopAutoAttack()
    {
        if (websocket == null || websocket.State != WebSocketState.Open) return;
        var msg = new StopAutoAttackMessage { type = "stopAutoAttack" };
        websocket.SendText(JsonUtility.ToJson(msg));
    }

    // =========================
    // CACHE DA ÚLTIMA POSIÇÃO INICIAL
    // =========================
    private string lastPlayerId = null;
    private Vector2? lastInitPosition = null;

    /// <summary>
    /// Tenta obter a posição inicial do jogador, caso o evento 'init' já tenha sido recebido.
    /// </summary>
    public bool TryGetInitPosition(out string playerId, out Vector2 position)
    {
        playerId = lastPlayerId;
        position = lastInitPosition ?? Vector2.zero;
        return lastInitPosition.HasValue;
    }

    [Serializable] private class StartAutoAttackMessage { public string type; public string targetId; }
    [Serializable] private class StopAutoAttackMessage { public string type; }

    [Serializable] private class MoveDirMessage { public string type; public string dir; }

    // =========================
    // CLASSES DE MENSAGEM (envio)
    // =========================
    [Serializable] private class MoveMessage { public string type; public float x, y; }
    [Serializable] private class ChatMessage { public string type; public string message; }
    [Serializable] private class AttackMessage { public string type; public string targetId; }
    [Serializable] private class LootMessage { public string type; public string corpseId; }
    [Serializable] private class TakeLootMessage { public string type; public string corpseId; public bool takeAll; public int itemIndex; }
    [Serializable] private class UseItemMessage { public string type; public string itemId; }
    [Serializable] private class DropItemMessage { public string type; public string itemId; public int amount; }

    // =========================
    // CLASSES DE MENSAGEM (recepção)
    // =========================
    [Serializable] private class SimpleMessage { public string type; }

    [Serializable] private class InitMessage { public string type; public string playerId; public float x; public float y; }
    [Serializable] private class PositionMessage { public string type; public float x; public float y; }
    [Serializable] private class SpawnMessage { public string type; public string id; public string name; public float x; public float y; public int hp; public int maxHp; }
    [Serializable] private class MoveEntityMessage { public string type; public string id; public float x; public float y; }
    [Serializable] private class DespawnMessage { public string type; public string id; }
    [Serializable] private class DamageMessage { public string type; public string targetId; public int newHp; public int maxHp; }
    [Serializable] private class ChatMessageReceived { public string type; public string message; }
    [Serializable] private class LootWindowMessage { public string type; public string corpseId; public LootItem[] items; }
    [Serializable] private class LootTakenMessage { public string type; public string corpseId; public int itemIndex; }
    [Serializable] private class LootErrorMessage { public string type; public string message; }
    [Serializable] private class InventoryMessage { public string type; public int gold; public InventoryItem[] items; }
    [Serializable] private class ItemUsedMessage { public string type; public string itemId; public bool success; public string message; }
    [Serializable] private class PlayerStatsMessage { public string type; public int hp; public int maxHp; public int mana; public int maxMana; public int level; public int attack; public int defense; }

    // Classes para economia
    [Serializable] public class ShopItem { public string itemId; public string name; public int price; public int stock; }
    [Serializable] private class ShopWindowMessage { public string type; public string npcId; public ShopItem[] items; }
    [Serializable] private class BuyResultMessage { public string type; public bool success; public string message; }
    [Serializable] private class BankWindowMessage { public string type; public string npcId; public int bankGold; public int gold; }
    [Serializable] private class BankResultMessage { public string type; public bool success; public string message; public int bankGold; public int gold; }
    [Serializable] private class GoldUpdateMessage { public string type; public int gold; public int bankGold; }

    // =========================
    // CLASSES DE MENSAGEM PARA ECONOMIA (envio)
    // =========================
    [Serializable] private class OpenShopMessage { public string type; public string npcId; }
    [Serializable] private class OpenBankMessage { public string type; public string npcId; }
    [Serializable] private class BuyItemMessage { public string type; public string npcId; public string itemId; public int amount; }
    [Serializable] private class DepositMessage { public string type; public int amount; }
    [Serializable] private class WithdrawMessage { public string type; public int amount; }

    // Classes compartilhadas (item de inventário e loot)
    [Serializable] public class LootItem { public string itemId; public int amount; }
    [Serializable] public class InventoryItem { public string itemId; public int amount; }

    [Serializable] private class ShopErrorMessage { public string type; public string message; }
    [Serializable] private class BankErrorMessage { public string type; public string message; }
}