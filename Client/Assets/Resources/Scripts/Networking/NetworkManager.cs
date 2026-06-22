using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using UnityEngine;
using NativeWebSocket;

/// <summary>
/// Gerencia a conexão WebSocket com o servidor, enviando comandos e recebendo eventos.
/// </summary>
[DefaultExecutionOrder(-100)]
public class NetworkManager : MonoBehaviour
{
    public static NetworkManager Instance { get; private set; }
    public string serverUrl = "ws://localhost:3000";

    private WebSocket websocket;
    public bool isConnected { get; private set; } = false;

    // Eventos
    public event Action<string, Vector2> OnInit;
    public event Action<Vector2> OnPositionReceived;
    public event Action<int, Dictionary<string, int>> OnInventoryReceived;
    public event Action<string, bool, string> OnItemUsed;
    public event Action<int, int, int, int, int, int, int, int> OnPlayerStats;
    public event Action<string, ShopItem[]> OnShopWindow;
    public event Action<bool, string> OnBuyResult;
    public event Action<int, int> OnBankWindow;
    public event Action<bool, string, int, int> OnBankResult;

    private string lastPlayerId;
    private Vector2? lastInitPosition;

    // =========================
    // CICLO DE VIDA
    // =========================

    private async void Start()
    {
        if (Instance == null) Instance = this;
        else Destroy(gameObject);
        await Connect();
    }

    private void Update()
    {
#if !UNITY_WEBGL || UNITY_EDITOR
        websocket?.DispatchMessageQueue();
#endif
    }

    private async void OnDestroy()
    {
        if (websocket != null && websocket.State == WebSocketState.Open)
            await websocket.Close();
    }

    // =========================
    // CONEXÃO
    // =========================

    private async Task Connect()
    {
        websocket = new WebSocket(serverUrl);
        websocket.OnOpen += () => Debug.Log("[NetworkManager] Conectado ao servidor.");
        websocket.OnError += (e) => Debug.LogError($"[NetworkManager] WebSocket erro: {e}");
        websocket.OnClose += (e) =>
        {
            Debug.Log($"[NetworkManager] Conexão fechada: {e}");
            isConnected = false;
        };
        websocket.OnMessage += OnMessageReceived;
        await websocket.Connect();
        Debug.Log("[NetworkManager] WebSocket pronto.");
        isConnected = true;
    }

    // =========================
    // RECEPÇÃO DE MENSAGENS
    // =========================

    private void OnMessageReceived(byte[] bytes)
    {
        string message = System.Text.Encoding.UTF8.GetString(bytes);
        var simpleMsg = JsonUtility.FromJson<SimpleMessage>(message);
        if (simpleMsg == null) return;

        switch (simpleMsg.type)
        {
            case "init":
                var initMsg = JsonUtility.FromJson<InitMessage>(message);
                lastPlayerId = initMsg.playerId;
                lastInitPosition = new Vector2(initMsg.x, initMsg.y);
                OnInit?.Invoke(initMsg.playerId, lastInitPosition.Value);
                isConnected = true;
                break;

            case "position":
                var posMsg = JsonUtility.FromJson<PositionMessage>(message);
                OnPositionReceived?.Invoke(new Vector2(posMsg.x, posMsg.y));
                break;

            case "spawn":
                var spawnMsg = JsonUtility.FromJson<SpawnMessage>(message);
                EntityManager.Instance?.SpawnEntity(spawnMsg.id, spawnMsg.name, spawnMsg.x, spawnMsg.y, spawnMsg.hp, spawnMsg.npcType);
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
                // Debug.Log("[Dano] Mensagem DAMAGE recebida!");
                HandleDamageMessage(message);
                break;

            case "chat":
                var chatMsg = JsonUtility.FromJson<ChatMessageReceived>(message);
                ChatUI.Instance?.AddMessage(chatMsg.message);
                break;

            case "lootWindow":
                var lootMsg = JsonUtility.FromJson<LootWindowMessage>(message);
                LootUI.Instance?.ShowLootWindow(lootMsg.corpseId, lootMsg.items);
                break;

            case "lootTaken":
                LootUI.Instance?.CloseLootWindow();
                break;

            case "lootError":
                var lootErrorMsg = JsonUtility.FromJson<LootErrorMessage>(message);
                // Debug.LogError($"Erro ao lootear: {lootErrorMsg.message}");
                break;

            case "inventory":
                var invMsg = JsonUtility.FromJson<InventoryMessage>(message);
                var itemsDict = new Dictionary<string, int>();
                if (invMsg.items != null)
                {
                    foreach (var item in invMsg.items)
                        itemsDict[item.itemId] = item.amount;
                }
                OnInventoryReceived?.Invoke(invMsg.gold, itemsDict);
                break;

            case "itemUsed":
                var itemUsedMsg = JsonUtility.FromJson<ItemUsedMessage>(message);
                OnItemUsed?.Invoke(itemUsedMsg.itemId, itemUsedMsg.success, itemUsedMsg.message);
                break;

            case "playerStats":
                var statsMsg = JsonUtility.FromJson<PlayerStatsMessage>(message);
                OnPlayerStats?.Invoke(
                    statsMsg.hp, statsMsg.maxHp, statsMsg.mana, statsMsg.maxMana,
                    statsMsg.level, statsMsg.attack, statsMsg.defense, statsMsg.xp
                );
                break;

            // --- Economia ---
            case "shopWindow":
                var shopMsg = JsonUtility.FromJson<ShopWindowMessage>(message);
                OnShopWindow?.Invoke(shopMsg.npcId, shopMsg.items);
                break;

            case "buyResult":
                var buyResultMsg = JsonUtility.FromJson<BuyResultMessage>(message);
                OnBuyResult?.Invoke(buyResultMsg.success, buyResultMsg.message);
                break;

            case "bankWindow":
                var bankWinMsg = JsonUtility.FromJson<BankWindowMessage>(message);
                OnBankWindow?.Invoke(bankWinMsg.bankGold, bankWinMsg.gold);
                break;

            case "bankResult":
                var bankResMsg = JsonUtility.FromJson<BankResultMessage>(message);
                OnBankResult?.Invoke(bankResMsg.success, bankResMsg.message, bankResMsg.bankGold, bankResMsg.gold);
                break;

            case "shopError":
                var shopErrMsg = JsonUtility.FromJson<ShopErrorMessage>(message);
                Debug.LogError($"Erro na loja: {shopErrMsg.message}");
                ChatUI.Instance?.AddMessage($"Loja: {shopErrMsg.message}");
                break;

            case "bankError":
                var bankErrMsg = JsonUtility.FromJson<BankErrorMessage>(message);
                Debug.LogError($"Erro no banco: {bankErrMsg.message}");
                ChatUI.Instance?.AddMessage($"Banco: {bankErrMsg.message}");
                break;

            case "autoAttackStopped":
                var stopMsg = JsonUtility.FromJson<AutoAttackStoppedMessage>(message);
                TargetSelector.Instance?.ClearTarget();
                break;

            default:
#if UNITY_EDITOR
                Debug.LogWarning($"Tipo de mensagem não tratado: {simpleMsg.type}");
#endif
                break;
        }
    }

    // =========================
    // HANDLER DE DANO
    // =========================

    /// <summary>
    /// Processa a mensagem de dano: atualiza a barra de vida e exibe o dano flutuante.
    /// </summary>
    private void HandleDamageMessage(string rawMessage)
    {
        // Debug.Log("[Dano] HandleDamageMessage executado!");
        var damageMsg = JsonUtility.FromJson<DamageMessage>(rawMessage);

        EntityManager.Instance?.UpdateMonsterHp(damageMsg.targetId, damageMsg.newHp, damageMsg.maxHp);

        GameObject targetGo = EntityManager.Instance?.GetGameObject(damageMsg.targetId);
        if (targetGo == null)
        {
#if UNITY_EDITOR
            Debug.LogWarning($"Alvo não encontrado: {damageMsg.targetId}");
#endif
            return;
        }

        // 🔥 IF COM CHAVES
        if (damageMsg.damage > 0 && NameplateManager.Instance != null)
        {
            // Debug.Log($"[Dano] Chamando ShowFloatingText com dano: {damageMsg.damage}");
            NameplateManager.Instance.ShowFloatingText(
                targetGo.transform.position,
                damageMsg.damage.ToString(),
                Color.red
            );
        }
        else
        {
            Debug.LogWarning($"[Dano] Não chamou ShowFloatingText. damage={damageMsg.damage}, NameplateManager={NameplateManager.Instance != null}");
        }
    }

    // =========================
    // ENVIO DE MENSAGENS
    // =========================

    private bool CanSend() => websocket != null && websocket.State == WebSocketState.Open;

    public async void SendMove(Vector2 targetPos)
    {
        if (!CanSend()) return;
        await websocket.SendText(JsonUtility.ToJson(new MoveMessage { type = "move", x = targetPos.x, y = targetPos.y }));
    }

    public async void SendChat(string message)
    {
        if (!CanSend()) return;
        await websocket.SendText(JsonUtility.ToJson(new ChatMessage { type = "chat", message = message }));
    }

    public async void SendAttack(string targetId)
    {
        if (!CanSend()) return;
        await websocket.SendText(JsonUtility.ToJson(new AttackMessage { type = "attack", targetId = targetId }));
    }

    public async void SendLoot(string corpseId)
    {
        if (!CanSend()) return;
        await websocket.SendText(JsonUtility.ToJson(new LootMessage { type = "loot", corpseId = corpseId }));
    }

    public async void SendTakeLoot(string corpseId, bool takeAll = true, int itemIndex = -1)
    {
        if (!CanSend()) return;
        await websocket.SendText(JsonUtility.ToJson(new TakeLootMessage
        {
            type = "takeLoot",
            corpseId = corpseId,
            takeAll = takeAll,
            itemIndex = itemIndex
        }));
    }

    public void UseItem(string itemId)
    {
        if (!CanSend()) return;
        websocket.SendText(JsonUtility.ToJson(new UseItemMessage { type = "useItem", itemId = itemId }));
    }

    public void DropItem(string itemId, int amount = 1)
    {
        if (!CanSend()) return;
        websocket.SendText(JsonUtility.ToJson(new DropItemMessage { type = "dropItem", itemId = itemId, amount = amount }));
    }

    public void SendOpenShop(string npcId)
    {
        if (!CanSend()) return;
        websocket.SendText(JsonUtility.ToJson(new OpenShopMessage { type = "openShop", npcId = npcId }));
    }

    public void SendOpenBank(string npcId)
    {
        if (!CanSend()) return;
        websocket.SendText(JsonUtility.ToJson(new OpenBankMessage { type = "openBank", npcId = npcId }));
    }

    public void SendBuyItem(string npcId, string itemId, int amount)
    {
        if (!CanSend()) return;
        websocket.SendText(JsonUtility.ToJson(new BuyItemMessage { type = "buyItem", npcId = npcId, itemId = itemId, amount = amount }));
    }

    public void SendDeposit(int amount)
    {
        if (!CanSend()) return;
        websocket.SendText(JsonUtility.ToJson(new DepositMessage { type = "deposit", amount = amount }));
    }

    public void SendWithdraw(int amount)
    {
        if (!CanSend()) return;
        websocket.SendText(JsonUtility.ToJson(new WithdrawMessage { type = "withdraw", amount = amount }));
    }

    public void SendMoveDir(string direction)
    {
        if (!CanSend()) return;
        websocket.SendText(JsonUtility.ToJson(new MoveDirMessage { type = "moveDir", dir = direction }));
    }

    public void SendStartAutoAttack(string targetId)
    {
        if (!CanSend()) return;
        websocket.SendText(JsonUtility.ToJson(new StartAutoAttackMessage { type = "startAutoAttack", targetId = targetId }));
    }

    public void SendStopAutoAttack()
    {
        if (!CanSend()) return;
        websocket.SendText(JsonUtility.ToJson(new StopAutoAttackMessage { type = "stopAutoAttack" }));
    }

    // =========================
    // CACHE DA POSIÇÃO INICIAL
    // =========================

    public bool TryGetInitPosition(out string playerId, out Vector2 position)
    {
        playerId = lastPlayerId;
        position = lastInitPosition ?? Vector2.zero;
        return lastInitPosition.HasValue;
    }

    // =========================
    // CLASSES DE MENSAGEM
    // =========================

    [Serializable] private class SimpleMessage { public string type; }
    [Serializable] private class InitMessage { public string type; public string playerId; public float x; public float y; }
    [Serializable] private class PositionMessage { public string type; public float x; public float y; }
    [Serializable] private class SpawnMessage { public string type; public string id; public string name; public float x; public float y; public int hp; public int maxHp; public string npcType; }
    [Serializable] private class MoveEntityMessage { public string type; public string id; public float x; public float y; }
    [Serializable] private class DespawnMessage { public string type; public string id; }
    [Serializable] private class DamageMessage { public string type; public string targetId; public int newHp; public int maxHp; public int damage; }
    [Serializable] private class ChatMessageReceived { public string type; public string message; }
    [Serializable] private class LootWindowMessage { public string type; public string corpseId; public LootItem[] items; }
    [Serializable] private class LootErrorMessage { public string type; public string message; }
    [Serializable] private class InventoryMessage { public string type; public int gold; public InventoryItem[] items; }
    [Serializable] private class ItemUsedMessage { public string type; public string itemId; public bool success; public string message; }
    [Serializable] private class PlayerStatsMessage { public string type; public int hp; public int maxHp; public int mana; public int maxMana; public int level; public int attack; public int defense; public int xp; }

    [Serializable] public class ShopItem { public string itemId; public string name; public int price; public int stock; }
    [Serializable] private class ShopWindowMessage { public string type; public string npcId; public ShopItem[] items; }
    [Serializable] private class BuyResultMessage { public string type; public bool success; public string message; }
    [Serializable] private class BankWindowMessage { public string type; public string npcId; public int bankGold; public int gold; }
    [Serializable] private class BankResultMessage { public string type; public bool success; public string message; public int bankGold; public int gold; }
    [Serializable] private class GoldUpdateMessage { public string type; public int gold; public int bankGold; }

    [Serializable] private class ShopErrorMessage { public string type; public string message; }
    [Serializable] private class BankErrorMessage { public string type; public string message; }
    [Serializable] private class AutoAttackStoppedMessage { public string type; public string reason; }

    // Classes de envio
    [Serializable] private class MoveMessage { public string type; public float x, y; }
    [Serializable] private class ChatMessage { public string type; public string message; }
    [Serializable] private class AttackMessage { public string type; public string targetId; }
    [Serializable] private class LootMessage { public string type; public string corpseId; }
    [Serializable] private class TakeLootMessage { public string type; public string corpseId; public bool takeAll; public int itemIndex; }
    [Serializable] private class UseItemMessage { public string type; public string itemId; }
    [Serializable] private class DropItemMessage { public string type; public string itemId; public int amount; }
    [Serializable] private class MoveDirMessage { public string type; public string dir; }
    [Serializable] private class StartAutoAttackMessage { public string type; public string targetId; }
    [Serializable] private class StopAutoAttackMessage { public string type; }
    [Serializable] private class OpenShopMessage { public string type; public string npcId; }
    [Serializable] private class OpenBankMessage { public string type; public string npcId; }
    [Serializable] private class BuyItemMessage { public string type; public string npcId; public string itemId; public int amount; }
    [Serializable] private class DepositMessage { public string type; public int amount; }
    [Serializable] private class WithdrawMessage { public string type; public int amount; }

    [Serializable] public class LootItem { public string itemId; public int amount; public string itemName; }
    [Serializable] public class InventoryItem { public string itemId; public int amount; }
}