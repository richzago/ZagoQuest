using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using UnityEngine;
using NativeWebSocket;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;

// using ZagoQuest.Networking;
// using ZagoQuest.Networking.Handlers;
// using ZagoQuest.Networking.Parser;

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
    public event Action<Dictionary<EquipmentSlot, string>> OnEquipmentUpdate;

    public static event System.Action<PlayerStatsData> OnPlayerStatsFull;
    private string lastPlayerId;
    private Vector2? lastInitPosition;

    // =========================
    // CICLO DE VIDA
    // =========================

    private async void Start()
    {
        // context = new NetworkContext(this);
        if (DragDropManager.Instance == null)
        {
            GameObject go = new GameObject("DragDropManager");
            go.AddComponent<DragDropManager>();
            Debug.Log("[NetworkManager] DragDropManager criado automaticamente.");
        }
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
    // RECEPÇÃO DE MENSAGENS (com Newtonsoft.Json)
    // =========================

    /// <summary>
    /// Remove aspas externas e desescapa strings JSON.
    /// </summary>
    private string UnescapeJsonString(string message)
    {
        // Se a mensagem começa e termina com aspas, é uma string JSON escapada
        if (message.StartsWith("\"") && message.EndsWith("\""))
        {
            // Usa o Newtonsoft para desserializar a string interna
            try
            {
                string inner = JsonConvert.DeserializeObject<string>(message);
                return inner;
            }
            catch
            {
                // Fallback: remover aspas manualmente
                return message.Substring(1, message.Length - 2).Replace("\\\"", "\"");
            }
        }
        return message;
    }

    private void OnMessageReceived(byte[] bytes)
    {
        string message = System.Text.Encoding.UTF8.GetString(bytes);
        // Debug.Log($"[RAW] Mensagem recebida: {message}");

        try
        {
            JToken token = JToken.Parse(message);

            // 🔥 Se não for um objeto, loga e ignora
            if (token.Type != JTokenType.Object)
            {
                Debug.LogWarning($"[IGNORADO] Mensagem não é objeto JSON: {message} (tipo: {token.Type})");
                return;
            }

            JObject json = (JObject)token;
            string type = json["type"]?.ToString();
            if (string.IsNullOrEmpty(type)) return;

            switch (type)
            {
                case "init":
                    var initMsg = json.ToObject<InitMessage>();
                    lastPlayerId = initMsg.playerId;
                    lastInitPosition = new Vector2(initMsg.x, initMsg.y);
                    OnInit?.Invoke(initMsg.playerId, lastInitPosition.Value);
                    isConnected = true;
                    break;

                case "position":
                    var posMsg = json.ToObject<PositionMessage>();
                    OnPositionReceived?.Invoke(new Vector2(posMsg.x, posMsg.y));
                    break;

                case "spawn":
                    var spawnMsg = json.ToObject<SpawnMessage>();
                    if (spawnMsg.isItem)
                    {
                        EntityManager.Instance?.SpawnItemOnGround(
                            spawnMsg.id,
                            spawnMsg.itemId,
                            spawnMsg.name,
                            spawnMsg.x,
                            spawnMsg.y,
                            spawnMsg.amount
                        );
                    }
                    else
                    {
                        EntityManager.Instance?.SpawnEntity(
                            spawnMsg.id,
                            spawnMsg.name,
                            spawnMsg.x,
                            spawnMsg.y,
                            spawnMsg.hp,
                            spawnMsg.npcType
                        );
                    }
                    break;

                case "move":
                    var moveMsg = json.ToObject<MoveEntityMessage>();
                    EntityManager.Instance?.MoveEntity(moveMsg.id, moveMsg.x, moveMsg.y);
                    break;

                case "despawn":
                    var despawnMsg = json.ToObject<DespawnMessage>();
                    EntityManager.Instance?.DespawnEntity(despawnMsg.id);
                    break;

                case "damage":
                    HandleDamageMessage(message);
                    break;

                case "chat":
                    var chatMsg = json.ToObject<ChatMessageReceived>();
                    ChatUI.Instance?.AddMessage(chatMsg.message);
                    break;

                case "lootWindow":
                    var lootMsg = json.ToObject<LootWindowMessage>();
                    LootUI.Instance?.ShowLootWindow(lootMsg.corpseId, lootMsg.items);
                    break;

                case "lootTaken":
                    LootUI.Instance?.CloseLootWindow();
                    break;

                case "lootError":
                    var lootErrorMsg = json.ToObject<LootErrorMessage>();
                    break;

                case "inventory":
                    var invMsg = json.ToObject<InventoryMessage>();
                    var itemsDict = new Dictionary<string, int>();
                    if (invMsg.items != null)
                    {
                        foreach (var item in invMsg.items)
                            itemsDict[item.itemId] = item.amount;
                    }
                    OnInventoryReceived?.Invoke(invMsg.gold, itemsDict);
                    break;

                case "itemUsed":
                    var itemUsedMsg = json.ToObject<ItemUsedMessage>();
                    OnItemUsed?.Invoke(itemUsedMsg.itemId, itemUsedMsg.success, itemUsedMsg.message);
                    break;

                case "playerStats":
                    var stats = json.ToObject<PlayerStatsData>();
                    if (GameManager.Instance != null)
                        GameManager.Instance.PlayerStats = stats;
                    OnPlayerStats?.Invoke(
                        stats.hp, stats.maxHp,
                        stats.mana, stats.maxMana,
                        stats.level, stats.attack, stats.defense,
                        stats.xp
                    );
                    OnPlayerStatsFull?.Invoke(stats);
                    break;

                case "shopWindow":
                    var shopMsg = json.ToObject<ShopWindowMessage>();
                    OnShopWindow?.Invoke(shopMsg.npcId, shopMsg.items);
                    break;

                case "buyResult":
                    var buyResultMsg = json.ToObject<BuyResultMessage>();
                    OnBuyResult?.Invoke(buyResultMsg.success, buyResultMsg.message);
                    break;

                case "bankWindow":
                    var bankWinMsg = json.ToObject<BankWindowMessage>();
                    OnBankWindow?.Invoke(bankWinMsg.bankGold, bankWinMsg.gold);
                    break;

                case "bankResult":
                    var bankResMsg = json.ToObject<BankResultMessage>();
                    OnBankResult?.Invoke(bankResMsg.success, bankResMsg.message, bankResMsg.bankGold, bankResMsg.gold);
                    break;

                case "shopError":
                    var shopErrMsg = json.ToObject<ShopErrorMessage>();
                    Debug.LogError($"Erro na loja: {shopErrMsg.message}");
                    ChatUI.Instance?.AddMessage($"Loja: {shopErrMsg.message}");
                    break;

                case "bankError":
                    var bankErrMsg = json.ToObject<BankErrorMessage>();
                    Debug.LogError($"Erro no banco: {bankErrMsg.message}");
                    ChatUI.Instance?.AddMessage($"Banco: {bankErrMsg.message}");
                    break;

                case "autoAttackStopped":
                    var stopMsg = json.ToObject<AutoAttackStoppedMessage>();
                    TargetSelector.Instance?.ClearTarget();
                    break;

                case "equipment":
                    Debug.Log($"[RAW] Mensagem equipment (bruta): '{message}'");
                    Debug.Log($"[RAW] Tamanho: {message?.Length ?? 0}");
                    Debug.Log($"[RAW] Primeiro char: {(message != null && message.Length > 0 ? message[0] : ' ')}");
                    try
                    {
                        // 🔥 CORRIGIDO: renomeei a variável para 'equipJson' para evitar conflito com 'json' do escopo externo
                        JObject equipJson = JObject.Parse(message);
                        string equipType = equipJson["type"]?.ToString();
                        if (equipType != "equipment")
                        {
                            Debug.LogWarning($"[EQUIPMENT] Tipo inesperado: {equipType}");
                            break;
                        }

                        JArray itemsArray = equipJson["items"] as JArray;
                        var equipDict = new Dictionary<EquipmentSlot, string>();

                        if (itemsArray != null)
                        {
                            foreach (var item in itemsArray)
                            {
                                string slotStr = item["slot"]?.ToString();
                                string itemId = item["itemId"]?.ToString();
                                if (!string.IsNullOrEmpty(slotStr) && !string.IsNullOrEmpty(itemId))
                                {
                                    if (Enum.TryParse<EquipmentSlot>(slotStr, true, out var slot))
                                    {
                                        equipDict[slot] = itemId;
                                        Debug.Log($"[EQUIPMENT] Slot: {slot}, Item: {itemId}");
                                    }
                                    else
                                    {
                                        Debug.LogWarning($"[EQUIPMENT] Slot inválido: {slotStr}");
                                    }
                                }
                            }
                        }
                        else
                        {
                            Debug.LogWarning("[EQUIPMENT] items é nulo ou não é um array!");
                        }

                        OnEquipmentUpdate?.Invoke(equipDict);
                    }
                    catch (Exception e)
                    {
                        Debug.LogError($"[EQUIPMENT] Erro ao parsear JSON: {e.Message}\n{e.StackTrace}");
                    }
                    break;

                case "unequipResult":
                    var unequipResult = json.ToObject<UnequipResultMessage>();
                    // Debug.Log($"[Unequip] {unequipResult.message}");
                    break;

                case "dropError":
                    var dropErr = json.ToObject<DropErrorMessage>();
                    Debug.LogError($"[Drop] Erro: {dropErr.message}");
                    if (ChatUI.Instance != null)
                        ChatUI.Instance.AddMessage($"Erro: {dropErr.message}");
                    break;

                default:
#if UNITY_EDITOR
                    Debug.LogWarning($"Tipo de mensagem não tratado: {type}");
#endif
                    break;
            }
        }
        catch (Exception e)
        {
            Debug.LogError($"[NetworkManager] Erro ao processar mensagem: {e.Message}\n{e.StackTrace}");
        }
    }

    // =========================
    // HANDLER DE DANO
    // =========================

    private void HandleDamageMessage(string rawMessage)
    {
        var damageMsg = JsonConvert.DeserializeObject<DamageMessage>(rawMessage);
        if (damageMsg == null) return;

        EntityManager.Instance?.UpdateMonsterHp(damageMsg.targetId, damageMsg.newHp, damageMsg.maxHp);

        GameObject targetGo = EntityManager.Instance?.GetGameObject(damageMsg.targetId);
        if (targetGo == null)
        {
#if UNITY_EDITOR
            Debug.LogWarning($"Alvo não encontrado: {damageMsg.targetId}");
#endif
            return;
        }

        if (damageMsg.damage > 0 && NameplateManager.Instance != null)
        {
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
    // ENVIO DE MENSAGENS (JsonUtility continua ok para envio)
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
    // EQUIPAMENTO
    // =========================

    public void SendEquipItem(string itemId)
    {
        Debug.Log($"[NetworkManager] 🚀 SendEquipItem chamado para {itemId}");
        if (!CanSend())
        {
            Debug.LogWarning("[NetworkManager] ⚠️ Não foi possível enviar: WebSocket não está aberto!");
            return;
        }
        var msg = new EquipItemMessage { type = "equipItem", itemId = itemId };
        string json = JsonUtility.ToJson(msg);
        Debug.Log($"[Network] Enviando equipItem: {json}");
        websocket.SendText(json);
    }

    public void SendUnequipItem(EquipmentSlot slot)
    {
        if (!CanSend()) return;
        var msg = new UnequipItemMessage { type = "unequipItem", slot = slot.ToString() };
        websocket.SendText(JsonUtility.ToJson(msg));
    }

    public void SendDropItem(string itemId, int amount, int x, int y)
    {
        if (!CanSend()) return;
        var msg = new DropItemMessage
        {
            type = "dropItem",
            itemId = itemId,
            amount = amount,
            x = x,
            y = y
        };
        string json = JsonUtility.ToJson(msg);
        Debug.Log($"[NETWORK] 📤 Enviando dropItem: {json}");
        websocket.SendText(json);
    }

    public void SendPickupItem(string itemOnGroundId)
    {
        if (!CanSend()) return;
        var msg = new PickupItemMessage
        {
            type = "pickupItem",
            itemId = itemOnGroundId
        };
        websocket.SendText(JsonUtility.ToJson(msg));
    }

    // =========================
    // CLASSES DE MENSAGEM (serializáveis)
    // =========================

    [Serializable] public class SimpleMessage { public string type; }
    [Serializable] public class InitMessage { public string type; public string playerId; public float x; public float y; }
    [Serializable] public class PositionMessage { public string type; public float x; public float y; }
    [Serializable] public class MoveEntityMessage { public string type; public string id; public float x; public float y; }
    [Serializable]
    public class SpawnMessage
    {
        public string type;
        public string id;
        public string name;
        public float x;
        public float y;
        public int hp;
        public int maxHp;
        public string npcType;
        public bool isItem;
        public string itemId;
        public int amount;
    }
    [Serializable] public class DamageMessage { public string type; public string targetId; public int newHp; public int maxHp; public int damage; }
    [Serializable] public class ChatMessageReceived { public string type; public string message; }
    [Serializable] public class LootWindowMessage { public string type; public string corpseId; public LootItem[] items; }
    [Serializable] public class LootErrorMessage { public string type; public string message; }
    [Serializable] public class InventoryMessage { public string type; public int gold; public InventoryItem[] items; public InventoryEquipment[] equipment; }
    [Serializable] public class ItemUsedMessage { public string type; public string itemId; public bool success; public string message; }
    [Serializable] public class ShopItem { public string itemId; public string name; public int price; public int stock; }
    [Serializable] public class ShopWindowMessage { public string type; public string npcId; public ShopItem[] items; }
    [Serializable] public class BuyResultMessage { public string type; public bool success; public string message; }
    [Serializable] public class BankWindowMessage { public string type; public string npcId; public int bankGold; public int gold; }
    [Serializable] public class BankResultMessage { public string type; public bool success; public string message; public int bankGold; public int gold; }
    [Serializable] public class GoldUpdateMessage { public string type; public int gold; public int bankGold; }
    [Serializable] public class ShopErrorMessage { public string type; public string message; }
    [Serializable] public class BankErrorMessage { public string type; public string message; }
    [Serializable] public class AutoAttackStoppedMessage { public string type; public string reason; }

    // Envio
    [Serializable] public class MoveMessage { public string type; public float x, y; }
    [Serializable] public class ChatMessage { public string type; public string message; }
    [Serializable] public class AttackMessage { public string type; public string targetId; }
    [Serializable] public class LootMessage { public string type; public string corpseId; }
    [Serializable] public class TakeLootMessage { public string type; public string corpseId; public bool takeAll; public int itemIndex; }
    [Serializable] public class UseItemMessage { public string type; public string itemId; }
    [Serializable] public class StartAutoAttackMessage { public string type; public string targetId; }
    [Serializable] public class StopAutoAttackMessage { public string type; }
    [Serializable] public class OpenShopMessage { public string type; public string npcId; }
    [Serializable] public class OpenBankMessage { public string type; public string npcId; }
    [Serializable] public class BuyItemMessage { public string type; public string npcId; public string itemId; public int amount; }
    [Serializable] public class DepositMessage { public string type; public int amount; }
    [Serializable] public class WithdrawMessage { public string type; public int amount; }

    [Serializable] public class LootItem { public string itemId; public int amount; public string itemName; }
    [Serializable] public class InventoryItem { public string itemId; public int amount; }
    [Serializable] public class InventoryEquipment { public string slot; public string itemId; }
    [Serializable] public class EquipItemMessage { public string type; public string itemId; }
    [Serializable] public class UnequipItemMessage { public string type; public string slot; }

    [Serializable]
    public class EquipmentItem
    {
        public string slot;
        public string itemId;
    }

    [Serializable]
    public class EquipmentMessage
    {
        public string type;
        public EquipmentItem[] items;
    }

    [Serializable]
    public class UnequipResultMessage
    {
        public string type;
        public bool success;
        public string message;
    }

    [Serializable]
    public class DropItemMessage
    {
        public string type;
        public string itemId;
        public int amount;
        public int x;
        public int y;
    }

    [Serializable]
    public class PickupItemMessage
    {
        public string type;
        public string itemId;
    }

    [Serializable]
    public class MoveDirMessage
    {
        public string type;
        public string dir;
    }

    [Serializable]
    public class DespawnMessage
    {
        public string type; public string id;
    }

    [Serializable]
    public class DropErrorMessage
    {
        public string type;
        public string message;
    }
}