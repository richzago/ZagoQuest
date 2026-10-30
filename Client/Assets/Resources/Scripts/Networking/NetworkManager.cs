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
    private bool _connecting = false;
    private bool _shuttingDown = false;
    private float _nextReconnectAttempt = 0f;
    private const float ReconnectDelaySeconds = 2f;


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
        // Tentativas acontecem no ciclo de vida do Unity, sem criar timers globais.
        if (!_shuttingDown && !isConnected && !_connecting &&
            Time.unscaledTime >= _nextReconnectAttempt)
        {
            _ = Connect();
        }
    }

    private async void OnDestroy()
    {
        _shuttingDown = true;
        if (Instance == this) Instance = null;
        if (_websocket != null && _websocket.State == WebSocketState.Open)
        {
            try { await _websocket.Close(); }
            catch (Exception error) { Debug.LogWarning($"[NetworkManager] Erro ao fechar: {error.Message}"); }
        }
    }

    // =========================
    // CONEXÃO
    // =========================

    private async Task Connect()
    {
        if (_connecting || _shuttingDown || isConnected) return;
        _connecting = true;
        Debug.Log($"[NetworkManager] 🔗 Conectando em {serverUrl}...");

        // A NativeWebSocket não permite reabrir um socket fechado:
        // cada tentativa precisa de uma nova instância.
        var socket = new WebSocket(serverUrl);
        _websocket = socket;

        socket.OnOpen += () =>
        {
            if (_shuttingDown || !ReferenceEquals(_websocket, socket)) return;
            Debug.Log("[NetworkManager] ✅ Servidor conectado/reconectado.");
            isConnected = true;
            _nextReconnectAttempt = 0f;
            _lastPlayerId = null;
            _lastInitPosition = null;

            // Descartar entidades da sessão antiga antes do snapshot inicial.
            EntityManager.Instance?.ClearNetworkEntities();
            _context = new NetworkContext(this);

            Movement = new MovementSender(socket);
            Combat = new CombatSender(socket);
            Inventory = new InventorySender(socket);
            Chat = new ChatSender(socket);
            Shop = new ShopSender(socket);
            Bank = new BankSender(socket);
            Debug.Log("[NetworkManager] ✅ Senders e estado de rede renovados.");
        };

        socket.OnError += (error) =>
        {
            if (!ReferenceEquals(_websocket, socket)) return;
            Debug.LogWarning($"[NetworkManager] Erro WebSocket: {error}");
        };
        socket.OnClose += (reason) =>
        {
            if (!ReferenceEquals(_websocket, socket) || _shuttingDown) return;
            Debug.LogWarning($"[NetworkManager] Desconectado: {reason}. Nova tentativa em {ReconnectDelaySeconds}s.");
            isConnected = false;
            _nextReconnectAttempt = Time.unscaledTime + ReconnectDelaySeconds;
        };

        // Eventos enfileirados de sockets antigos não podem alterar a sessão atual.
        socket.OnMessage += bytes =>
        {
            if (!_shuttingDown && ReferenceEquals(_websocket, socket))
                OnMessageReceived(bytes);
        };

        try
        {
            await socket.Connect();
            if (!_shuttingDown && ReferenceEquals(_websocket, socket))
                Debug.Log("[NetworkManager] Handshake WebSocket concluído.");
        }
        catch (Exception error)
        {
            if (!_shuttingDown && ReferenceEquals(_websocket, socket))
            {
                isConnected = false;
                _nextReconnectAttempt = Time.unscaledTime + ReconnectDelaySeconds;
                Debug.LogWarning($"[NetworkManager] Conexão falhou: {error.Message}. Retentando.");
            }
        }
        finally
        {
            _connecting = false;
        }
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