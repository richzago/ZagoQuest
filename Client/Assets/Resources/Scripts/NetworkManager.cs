using System;
using System.Threading.Tasks;
using UnityEngine;
using NativeWebSocket;

public class NetworkManager : MonoBehaviour
{
    public static NetworkManager Instance { get; private set; }
    public string serverUrl = "ws://localhost:3000";
    private WebSocket websocket;
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
        websocket.OnClose += (e) => Debug.Log($"WebSocket fechado: {e}");
        websocket.OnMessage += (bytes) =>
        {
            string message = System.Text.Encoding.UTF8.GetString(bytes);
            var msg = JsonUtility.FromJson<WebSocketMessage>(message);
            if (msg.type == "init")
                OnInit?.Invoke(msg.playerId, new Vector2(msg.x, msg.y));
            else if (msg.type == "position")
                OnPositionReceived?.Invoke(new Vector2(msg.x, msg.y));
        };
        await websocket.Connect();
        Debug.Log("Conectado ao servidor WebSocket");
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

    [Serializable] private class WebSocketMessage { public string type; public int playerId; public float x, y; }
    [Serializable] private class MoveMessage { public string type; public float x, y; }
}