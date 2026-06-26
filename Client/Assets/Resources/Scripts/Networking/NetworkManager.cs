using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using UnityEngine;
using NativeWebSocket;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;
using ZagoQuest.Networking;
using ZagoQuest.Networking.Handlers;
using ZagoQuest.Networking.Messages; // ← TODAS AS MENSAGENS VÊM DAQUI

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
    private NetworkContext context;
    private bool handlersRegistered = false;

    // =========================
    // CICLO DE VIDA
    // =========================

    private async void Start()
    {
        if (!handlersRegistered)
        {
            PacketHandlerRegistry.RegisterAll();
            handlersRegistered = true;
        }
        context = new NetworkContext(this);

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
    // RECEPÇÃO DE MENSAGENS (com handlers)
    // =========================

    private void OnMessageReceived(byte[] bytes)
    {
        string message = System.Text.Encoding.UTF8.GetString(bytes);

        try
        {
            JToken token = JToken.Parse(message);

            if (token.Type != JTokenType.Object)
            {
                Debug.LogWarning($"[IGNORADO] Mensagem não é objeto JSON: {message} (tipo: {token.Type})");
                return;
            }

            JObject json = (JObject)token;
            string type = json["type"]?.ToString();
            if (string.IsNullOrEmpty(type)) return;

            var handler = PacketHandlerRegistry.GetHandler(type);
            if (handler != null)
            {
                handler.Handle(json, context);
            }
            else
            {
#if UNITY_EDITOR
                Debug.LogWarning($"Tipo de mensagem não tratado: {type}");
#endif
            }
        }
        catch (Exception e)
        {
            Debug.LogError($"[NetworkManager] Erro ao processar mensagem: {e.Message}\n{e.StackTrace}");
        }
    }

    // =========================
    // MÉTODOS AUXILIARES PARA HANDLERS
    // =========================

    public void SetInitData(string playerId, Vector2 pos)
    {
        lastPlayerId = playerId;
        lastInitPosition = pos;
    }

    public void SetConnected(bool value)
    {
        isConnected = value;
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
}