using UnityEngine;
using UnityEngine.InputSystem;


public class PlayerController : MonoBehaviour
{
    public static PlayerController Instance { get; private set; }

    [Header("Movement")]
    public float stepDuration = 0.2f;
    // Auto-follow mantém no máximo UMA solicitação em voo. O servidor
    // confirma cada passo com PositionHandler (inclusive passos recusados).
    private bool followPending = false;
    private float followSentAt = 0f;
    private float followAllowedAt = 0f;
    private Vector2Int followFrom;
    private bool diagonalRejected = false;
    private float followStepSeconds = 0.15f; // atualizado pelo PlayerStatsSender
    public float FollowIntervalSeconds => followStepSeconds;
    private float manualOverrideUntil = 0f;
    private const float FollowAckTimeoutSeconds = 0.75f;

    private NetworkManager networkManager;
    private Vector2Int currentGridPosition;
    private bool isReady = false;
    private bool hasRetried = false;

    private InputAction moveNorth, moveSouth, moveEast, moveWest;
    private InputAction moveNortheast, moveNorthwest, moveSoutheast, moveSouthwest;

    // =========================
    // CICLO DE VIDA
    // =========================

    private void Awake()
    {

        if (Instance == null)
        {
            Instance = this;
        }
        else
        {

            Destroy(gameObject);
            return;
        }

        // Configura as InputActions
        moveNorth = new InputAction("North", binding: "<Keyboard>/w");
        moveSouth = new InputAction("South", binding: "<Keyboard>/s");
        moveEast = new InputAction("East", binding: "<Keyboard>/d");
        moveWest = new InputAction("West", binding: "<Keyboard>/a");
        moveNortheast = new InputAction("NE", binding: "<Keyboard>/e");
        moveNorthwest = new InputAction("NW", binding: "<Keyboard>/q");
        moveSoutheast = new InputAction("SE", binding: "<Keyboard>/c");
        moveSouthwest = new InputAction("SW", binding: "<Keyboard>/z");

        // Teclas são amostradas no Update para suportar segurar WASD.
        // Isso evita uma fila de InputAction.performed sem ACK do Node.

        Debug.Log("[PlayerController] ✅ InputActions configuradas.");
    }

    private void OnEnable()
    {
        if (Instance != this) return;
        Debug.Log("[PlayerController] OnEnable - Habilitando InputActions");
        moveNorth?.Enable();
        moveSouth?.Enable();
        moveEast?.Enable();
        moveWest?.Enable();
        moveNortheast?.Enable();
        moveNorthwest?.Enable();
        moveSoutheast?.Enable();
        moveSouthwest?.Enable();
    }

    private void Update()
    {
        if (ChatUI.IsChatActive || !isReady) return;

        // Segurar WASD envia no máximo um passo por confirmação de posição.
        // As teclas diagonais explícitas têm prioridade sobre cardinais.
        Vector2Int direction = Vector2Int.zero;
        if (moveNortheast.IsPressed()) direction = new Vector2Int(1, 1);
        else if (moveNorthwest.IsPressed()) direction = new Vector2Int(-1, 1);
        else if (moveSoutheast.IsPressed()) direction = new Vector2Int(1, -1);
        else if (moveSouthwest.IsPressed()) direction = new Vector2Int(-1, -1);
        else
        {
            direction.x = (moveEast.IsPressed() ? 1 : 0) - (moveWest.IsPressed() ? 1 : 0);
            direction.y = (moveNorth.IsPressed() ? 1 : 0) - (moveSouth.IsPressed() ? 1 : 0);
        }
        if (direction == Vector2Int.zero) return;
        manualOverrideUntil = Time.unscaledTime + followStepSeconds * 2f;
        RequestMoveDirection(direction);
    }

    private void OnDisable()
    {
        moveNorth?.Disable();
        moveSouth?.Disable();
        moveEast?.Disable();
        moveWest?.Disable();
        moveNortheast?.Disable();
        moveNorthwest?.Disable();
        moveSoutheast?.Disable();
        moveSouthwest?.Disable();
    }

    private void Start()
    {
        Debug.Log($"[PlayerController] 🟢 Start executado! Time: {Time.time:F2}");

        // Tenta obter o NetworkManager
        TryGetNetworkManager();
    }

    private void TryGetNetworkManager()
    {
        networkManager = NetworkManager.Instance;
        Debug.Log($"[PlayerController] 🔍 TryGetNetworkManager - networkManager = {(networkManager != null ? "EXISTE" : "NULL")}");

        if (networkManager == null)
        {
            Debug.LogWarning("[PlayerController] NetworkManager ainda não disponível. Tentando novamente em 0.5s...");
            if (!hasRetried)
            {
                hasRetried = true;
                Invoke(nameof(TryGetNetworkManager), 0.5f);
            }
            return;
        }

        Debug.Log("[PlayerController] ✅ NetworkManager encontrado!");

        if (networkManager.TryGetInitPosition(out _, out Vector2 pos))
            OnServerInit(null, pos);
    }

    // =========================
    // MÉTODOS PÚBLICOS CHAMADOS PELOS HANDLERS
    // =========================

    public void OnServerInit(string _, Vector2 pos)
    {
        followPending = false;
        followAllowedAt = 0f;
        diagonalRejected = false;
        Debug.Log($"[PlayerController] 📍 OnServerInit - posição recebida: ({pos.x}, {pos.y})");
        currentGridPosition = new Vector2Int(Mathf.RoundToInt(pos.x), Mathf.RoundToInt(pos.y));
        transform.position = new Vector3(currentGridPosition.x, currentGridPosition.y, 0);
        isReady = true;
        Debug.Log("[PlayerController] ✅ pronto para mover.");
    }

    public void OnPositionReceived(Vector2 pos)
    {
        var confirmed = new Vector2Int(Mathf.RoundToInt(pos.x), Mathf.RoundToInt(pos.y));
        if (followPending)
        {
            // Um passo rejeitado (parede/cooldown) confirma a posição anterior.
            // Na próxima tentativa, experimente um eixo em vez da diagonal.
            diagonalRejected = confirmed == followFrom;
            followPending = false;
        }
        currentGridPosition = confirmed;
        transform.position = new Vector3(confirmed.x, confirmed.y, 0);
    }

    /// <summary>
    /// Posição confirmada pelo Node (init/position). Interações com o mundo
    /// não devem deduzir alcance a partir de um sprite ou da câmera.
    /// Este método não autoriza uma ação: o servidor sempre revalida.
    /// </summary>
    public bool TryGetConfirmedGridPosition(out Vector2Int position)
    {
        position = currentGridPosition;
        return isReady;
    }

    // =========================
    // MOVIMENTO
    // =========================

    /// <summary>
    /// O servidor envia o ritmo permitido via playerStats. O cliente só
    /// agenda solicitações; o Node mantém o limite autoritativo.
    /// </summary>
    public void SetMoveIntervalMs(int milliseconds)
    {
        if (milliseconds < 75 || milliseconds > 150) return;
        followStepSeconds = milliseconds / 1000f;
    }

    // =========================
    // AUTO FOLLOW (UM PASSO CONFIRMADO POR VEZ)
    // =========================

    /// <summary>
    /// Persegue a posição atual do monstro. Nunca prevê a posição futura
    /// e nunca coloca múltiplos passos no socket para furar o cooldown.
    /// </summary>
    public void RequestFollowTowards(Vector3 monsterWorldPosition)
    {
        if (!isReady || networkManager == null || !networkManager.isConnected) return;
        if (Time.unscaledTime < manualOverrideUntil) return;

        if (followPending)
        {
            if (Time.unscaledTime - followSentAt < FollowAckTimeoutSeconds) return;
            // Reconexão ou pacote perdido: não trava a perseguição para sempre.
            followPending = false;
        }
        if (Time.unscaledTime < followAllowedAt) return;

        var monster = new Vector2Int(
            Mathf.RoundToInt(monsterWorldPosition.x),
            Mathf.RoundToInt(monsterWorldPosition.y));
        int dx = monster.x - currentGridPosition.x;
        int dy = monster.y - currentGridPosition.y;

        // Alcance corpo a corpo: cardinal e diagonal adjacentes (até 1.5).
        if (Mathf.Max(Mathf.Abs(dx), Mathf.Abs(dy)) <= 1) return;

        var direction = new Vector2Int(System.Math.Sign(dx), System.Math.Sign(dy));
        if (diagonalRejected && direction.x != 0 && direction.y != 0)
        {
            // Se a diagonal foi bloqueada, tenta um eixo de maior distância.
            // Os dois eixos não podem ser enviados simultaneamente.
            if (Mathf.Abs(dx) >= Mathf.Abs(dy)) direction.y = 0;
            else direction.x = 0;
        }

        string dir = DirectionToString(direction);
        if (dir == null) return;

        followFrom = currentGridPosition;
        followPending = true;
        followSentAt = Time.unscaledTime;
        followAllowedAt = followSentAt + followStepSeconds;
        diagonalRejected = false;
        networkManager.Movement.SendMoveDir(dir);
    }

    /// <summary>
    /// Compatibilidade com código que solicite um passo de navegação.
    /// Não enfileira passos antigos: a posição autoritativa é a referência.
    /// </summary>
    public void RequestMoveDirection(Vector2Int direction)
    {
        if (!isReady || networkManager == null || !networkManager.isConnected) return;
        if (followPending && Time.unscaledTime - followSentAt < FollowAckTimeoutSeconds) return;
        if (Time.unscaledTime < followAllowedAt) return;
        string dir = DirectionToString(direction);
        if (dir == null) return;
        followFrom = currentGridPosition;
        followPending = true;
        followSentAt = Time.unscaledTime;
        followAllowedAt = followSentAt + followStepSeconds;
        networkManager.Movement.SendMoveDir(dir);
    }

    private string DirectionToString(Vector2Int dir)
    {
        if (dir == Vector2Int.up) return "north";
        if (dir == Vector2Int.down) return "south";
        if (dir == Vector2Int.right) return "east";
        if (dir == Vector2Int.left) return "west";
        if (dir.x == 1 && dir.y == 1) return "northeast";
        if (dir.x == -1 && dir.y == 1) return "northwest";
        if (dir.x == 1 && dir.y == -1) return "southeast";
        if (dir.x == -1 && dir.y == -1) return "southwest";
        return null;
    }

    private void OnDestroy()
    {
        if (Instance == this) Instance = null;
        // As InputActions são alocadas no Awake: liberar recursos ao trocar
        // de cena/reabrir Play Mode, mesmo que OnDisable já as tenha desativado.
        moveNorth?.Dispose();
        moveSouth?.Dispose();
        moveEast?.Dispose();
        moveWest?.Dispose();
        moveNortheast?.Dispose();
        moveNorthwest?.Dispose();
        moveSoutheast?.Dispose();
        moveSouthwest?.Dispose();
    }
}