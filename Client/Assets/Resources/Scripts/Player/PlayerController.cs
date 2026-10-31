using UnityEngine;
using UnityEngine.InputSystem;
using System.Collections.Generic;


public class PlayerController : MonoBehaviour
{
    public static PlayerController Instance { get; private set; }

    [Header("Movement")]
    public float stepDuration = 0.2f;
    private bool isMoving = false;
    // Auto-follow mantém no máximo UMA solicitação em voo. O servidor
    // confirma cada passo com PositionHandler (inclusive passos recusados).
    private bool followPending = false;
    private float followSentAt = 0f;
    private float followAllowedAt = 0f;
    private Vector2Int followFrom;
    private bool diagonalRejected = false;
    private const float FollowStepSeconds = 0.15f;
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

        moveNorth.performed += _ => SendDirection("north");
        moveSouth.performed += _ => SendDirection("south");
        moveEast.performed += _ => SendDirection("east");
        moveWest.performed += _ => SendDirection("west");
        moveNortheast.performed += _ => SendDirection("northeast");
        moveNorthwest.performed += _ => SendDirection("northwest");
        moveSoutheast.performed += _ => SendDirection("southeast");
        moveSouthwest.performed += _ => SendDirection("southwest");

        Debug.Log("[PlayerController] ✅ InputActions configuradas.");
    }

    private void OnEnable()
    {
        Debug.Log("[PlayerController] OnEnable - Habilitando InputActions");
        moveNorth.Enable();
        moveSouth.Enable();
        moveEast.Enable();
        moveWest.Enable();
        moveNortheast.Enable();
        moveNorthwest.Enable();
        moveSoutheast.Enable();
        moveSouthwest.Enable();
    }

    private void OnDisable()
    {
        moveNorth.Disable();
        moveSouth.Disable();
        moveEast.Disable();
        moveWest.Disable();
        moveNortheast.Disable();
        moveNorthwest.Disable();
        moveSoutheast.Disable();
        moveSouthwest.Disable();
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

    // =========================
    // MOVIMENTO
    // =========================

    private void SendDirection(string dir)
    {
        Debug.Log($"[PlayerController] 🎮 SendDirection: {dir}, isReady={isReady}, networkManager={(networkManager != null ? "EXISTE" : "NULL")}");

        if (!isReady)
        {
            Debug.LogWarning($"[PlayerController] ⚠️ SendDirection ignorado: isReady = false");
            return;
        }

        if (networkManager == null || !networkManager.isConnected)
        {
            Debug.LogWarning($"[PlayerController] ⚠️ SendDirection ignorado: networkManager = {networkManager != null}, isConnected = {networkManager?.isConnected ?? false}");
            return;
        }

        networkManager.Movement.SendMoveDir(dir);
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
        followAllowedAt = followSentAt + FollowStepSeconds;
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
        if (followPending || Time.unscaledTime < followAllowedAt) return;
        string dir = DirectionToString(direction);
        if (dir == null) return;
        followFrom = currentGridPosition;
        followPending = true;
        followSentAt = Time.unscaledTime;
        followAllowedAt = followSentAt + FollowStepSeconds;
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
        // Limpeza - nada necessário
    }
}