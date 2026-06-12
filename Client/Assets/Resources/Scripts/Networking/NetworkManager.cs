using System;
using System.Threading.Tasks;
using UnityEngine;
using NativeWebSocket;

public class NetworkManager : MonoBehaviour
{
    public static NetworkManager Instance { get; private set; }
    public string serverUrl = "ws://localhost:3000";

    private WebSocket websocket;
    public bool isConnected { get; private set; } = false;

    // Eventos
    public event Action<string, Vector2> OnInit;
    public event Action<Vector2> OnPositionReceived;

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
            var msg = JsonUtility.FromJson<WebSocketMessage>(message);

            if (msg.type == "init")
            {
                OnInit?.Invoke(msg.playerId, new Vector2(msg.x, msg.y));
                isConnected = true;
            }
            else if (msg.type == "position")
            {
                OnPositionReceived?.Invoke(new Vector2(msg.x, msg.y));
            }
            else if (msg.type == "spawn")
            {
                EntityManager.Instance?.SpawnEntity(msg.id, msg.name, msg.x, msg.y, msg.hp);
            }
            else if (msg.type == "move")
            {
                EntityManager.Instance?.MoveEntity(msg.id, msg.x, msg.y);
            }
            else if (msg.type == "despawn")
            {
                EntityManager.Instance?.DespawnEntity(msg.id);
            }
            else if (msg.type == "damage")
            {
                EntityManager.Instance?.UpdateMonsterHp(msg.targetId, msg.newHp, msg.maxHp);
            }
            else if (msg.type == "chat")
            {
                if (ChatUI.Instance != null) ChatUI.Instance.AddMessage(msg.message);
                else Debug.LogWarning("ChatUI.Instance não encontrado");
            }
            else if (msg.type == "lootWindow")
            {
                // Log detalhado para depuração
                string itemsText = string.Join(", ", System.Array.ConvertAll(msg.items, i => $"{i.itemId} x{i.amount}"));
                Debug.Log($"[LOOT] Corpse {msg.corpseId} contém: {itemsText}");

                if (LootUI.Instance != null) LootUI.Instance.ShowLootWindow(msg.corpseId, msg.items);
                else Debug.LogError("LootUI.Instance não encontrado");
            }
            else if (msg.type == "lootTaken")
            {
                if (LootUI.Instance != null) LootUI.Instance.CloseLootWindow();
            }
            else if (msg.type == "lootError")
            {
                Debug.LogError($"Erro ao lootear: {msg.message}");
                // Opcional: exibir mensagem na UI
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
    // ENVIO DE MENSAGENS
    // =========================
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

    async void OnDestroy()
    {
        if (websocket != null && websocket.State == WebSocketState.Open)
            await websocket.Close();
    }

    // =========================
    // CLASSES DE MENSAGEM
    // =========================
    [Serializable]
    private class WebSocketMessage
    {
        public string type;
        public string playerId;
        public string id;
        public string targetId;
        public string corpseId;
        public string name;
        public float x, y;
        public int hp, maxHp, newHp;
        public string message;
        public LootItem[] items;
    }

    [Serializable]
    private class MoveMessage
    {
        public string type;
        public float x, y;
    }

    [Serializable]
    private class ChatMessage
    {
        public string type;
        public string message;
    }

    [Serializable]
    private class AttackMessage
    {
        public string type;
        public string targetId;
    }

    [Serializable]
    private class LootMessage
    {
        public string type;
        public string corpseId;
    }

    [Serializable]
    private class TakeLootMessage
    {
        public string type;
        public string corpseId;
        public bool takeAll;
        public int itemIndex;
    }

    [Serializable]
    public class LootItem
    {
        public string itemId;
        public int amount;
    }
}