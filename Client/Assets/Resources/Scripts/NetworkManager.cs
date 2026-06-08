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

    public event Action<int, Vector2> OnInit;
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

            Debug.Log($"Recebido: {message}");

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

    public async void SendMove(Vector2 targetPos)
    {
        if (websocket == null || websocket.State != WebSocketState.Open) return;
        var moveMsg = new MoveMessage { type = "move", x = targetPos.x, y = targetPos.y };
        await websocket.SendText(JsonUtility.ToJson(moveMsg));
    }

    async void OnDestroy()
    {
        if (websocket != null && websocket.State == WebSocketState.Open)
            await websocket.Close();
    }

    [Serializable]
    private class WebSocketMessage
    {
        public string type;
        public int playerId;
        public int id;
        public string name;
        public float x, y;
        public int hp;
    }

    [Serializable]
    private class MoveMessage
    {
        public string type;
        public float x, y;
    }
}