using System;
using System.Threading.Tasks;
using UnityEngine;
using NativeWebSocket;
using Newtonsoft.Json.Linq;
using ZagoQuest.Networking;
using ZagoQuest.Networking.Handlers;
using ZagoQuest.Networking.Senders;
using ZagoQuest.Networking.Parser;

public class NetworkManager : MonoBehaviour
{
    public static NetworkManager Instance { get; private set; }
    public string serverUrl = "ws://localhost:3000";
    public bool isConnected { get; private set; } = false;

    // =========================
    // SENDERS
    // =========================

    public MovementSender Movement { get; private set; }
    public CombatSender Combat { get; private set; }
    public InventorySender Inventory { get; private set; }
    public ChatSender Chat { get; private set; }
    public ShopSender Shop { get; private set; }
    public BankSender Bank { get; private set; }

    // =========================
    // CAMPOS PRIVADOS
    // =========================

    private WebSocket _websocket;
    private NetworkContext _context;
    private string _lastPlayerId;
    private Vector2? _lastInitPosition;
    private bool _handlersRegistered = false;

    // =========================
    // CICLO DE VIDA
    // =========================

    private void Awake()
    {
        Debug.Log($"[NetworkManager] 🟣 Awake executado! Time: {Time.time:F2}");

        if (Instance == null)
        {
            Instance = this;
            Debug.Log("[NetworkManager] ✅ Instance definida.");
        }
        else
        {
            Debug.LogWarning("[NetworkManager] ⚠️ Instance já existe. Destruindo duplicata.");
            Destroy(gameObject);
            return;
        }

        // Inicializa o contexto antes de qualquer coisa
        _context = new NetworkContext(this);
    }

    private async void Start()
    {
        Debug.Log($"[NetworkManager] 🟢 Start executado! Time: {Time.time:F2}");

        if (!_handlersRegistered)
        {
            PacketHandlerRegistry.RegisterAll();
            _handlersRegistered = true;
            Debug.Log("[NetworkManager] ✅ Handlers registrados.");
        }

        if (DragDropManager.Instance == null)
        {
            var go = new GameObject("DragDropManager");
            go.AddComponent<DragDropManager>();
            Debug.Log("[NetworkManager] DragDropManager criado automaticamente.");
        }

        await Connect();
    }

    private void Update()
    {
#if !UNITY_WEBGL || UNITY_EDITOR
        _websocket?.DispatchMessageQueue();
#endif
    }

    private async void OnDestroy()
    {
        if (_websocket != null && _websocket.State == WebSocketState.Open)
            await _websocket.Close();
    }

    // =========================
    // CONEXÃO
    // =========================

    private async Task Connect()
    {
        Debug.Log($"[NetworkManager] 🔗 Connect iniciado. Time: {Time.time:F2}");

        _websocket = new WebSocket(serverUrl);

        _websocket.OnOpen += () =>
        {
            Debug.Log($"[NetworkManager] ✅ Conectado ao servidor. Time: {Time.time:F2}");
            isConnected = true;

            Movement = new MovementSender(_websocket);
            Combat = new CombatSender(_websocket);
            Inventory = new InventorySender(_websocket);
            Chat = new ChatSender(_websocket);
            Shop = new ShopSender(_websocket);
            Bank = new BankSender(_websocket);
            Debug.Log("[NetworkManager] ✅ Senders inicializados.");
        };

        _websocket.OnError += (e) => Debug.LogError($"[NetworkManager] WebSocket erro: {e}");
        _websocket.OnClose += (e) =>
        {
            Debug.Log($"[NetworkManager] Conexão fechada: {e}");
            isConnected = false;
        };

        _websocket.OnMessage += OnMessageReceived;
        await _websocket.Connect();
        Debug.Log("[NetworkManager] WebSocket pronto.");
    }

    // =========================
    // RECEPÇÃO DE MENSAGENS (COM PARSER)
    // =========================

    private void OnMessageReceived(byte[] bytes)
    {
        string message = System.Text.Encoding.UTF8.GetString(bytes);

        JObject json = JsonMessageParser.Parse(message);
        if (json == null) return;

        string type = json["type"]?.ToString();
        if (string.IsNullOrEmpty(type)) return;

        var handler = PacketHandlerRegistry.GetHandler(type);
        if (handler != null)
            handler.Handle(json, _context);
        else
#if UNITY_EDITOR
            Debug.LogWarning($"[NetworkManager] Tipo de mensagem não tratado: {type}");
#endif
    }

    // =========================
    // MÉTODOS AUXILIARES
    // =========================

    public void SetInitData(string playerId, Vector2 pos)
    {
        _lastPlayerId = playerId;
        _lastInitPosition = pos;
    }

    public void SetConnected(bool value)
    {
        isConnected = value;
    }

    public bool TryGetInitPosition(out string playerId, out Vector2 position)
    {
        playerId = _lastPlayerId;
        position = _lastInitPosition ?? Vector2.zero;
        return _lastInitPosition.HasValue;
    }
}