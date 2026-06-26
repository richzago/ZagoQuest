using UnityEngine;
using UnityEngine.InputSystem;
using System.Collections.Generic;

public class PlayerController : MonoBehaviour
{
    public static PlayerController Instance { get; private set; }

    [Header("Movement")]
    public float stepDuration = 0.2f;
    private bool isMoving = false;
    private Queue<Vector2Int> moveQueue = new Queue<Vector2Int>();

    private NetworkManager networkManager;
    private Vector2Int currentGridPosition;
    private bool isReady = false;

    private InputAction moveNorth, moveSouth, moveEast, moveWest;
    private InputAction moveNortheast, moveNorthwest, moveSoutheast, moveSouthwest;

    // =========================
    // CICLO DE VIDA
    // =========================

    private void Awake()
    {
        if (Instance == null) Instance = this;
        else Destroy(gameObject);

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
    }

    private void OnEnable()
    {
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
        networkManager = NetworkManager.Instance;
        if (networkManager == null)
        {
            Debug.LogError("PlayerController: NetworkManager não encontrado!");
            return;
        }

        // 🔥 Removidas as inscrições nos eventos do NetworkManager.
        // Os handlers (InitHandler, PositionHandler) agora chamam diretamente
        // os métodos públicos OnServerInit e OnPositionReceived via NetworkContext.
        // A posição inicial é obtida via TryGetInitPosition.
        if (networkManager.TryGetInitPosition(out _, out Vector2 pos))
            OnServerInit(null, pos);
    }

    // =========================
    // MÉTODOS PÚBLICOS CHAMADOS PELOS HANDLERS
    // =========================

    /// <summary>
    /// Chamado pelo InitHandler para definir a posição inicial.
    /// </summary>
    public void OnServerInit(string _, Vector2 pos)
    {
        currentGridPosition = new Vector2Int(Mathf.RoundToInt(pos.x), Mathf.RoundToInt(pos.y));
        transform.position = new Vector3(currentGridPosition.x, currentGridPosition.y, 0);
        isReady = true;
        Debug.Log("PlayerController: pronto para mover.");
    }

    /// <summary>
    /// Chamado pelo PositionHandler para atualizar a posição.
    /// </summary>
    public void OnPositionReceived(Vector2 pos)
    {
        currentGridPosition = new Vector2Int(Mathf.RoundToInt(pos.x), Mathf.RoundToInt(pos.y));
        transform.position = new Vector3(currentGridPosition.x, currentGridPosition.y, 0);
        ProcessMoveQueue();
    }

    // =========================
    // MOVIMENTO
    // =========================

    private void SendDirection(string dir)
    {
        if (!isReady) return;
        if (networkManager == null || !networkManager.isConnected) return;
        networkManager.SendMoveDir(dir);
    }

    // =========================
    // WALK QUEUE
    // =========================

    private void EnqueueDirection(Vector2Int direction)
    {
        Vector2Int targetTile = currentGridPosition + direction;
        moveQueue.Enqueue(targetTile);
        if (!isMoving) ProcessMoveQueue();
    }

    private void ProcessMoveQueue()
    {
        if (moveQueue.Count == 0)
        {
            isMoving = false;
            return;
        }
        isMoving = true;
        Vector2Int nextTile = moveQueue.Dequeue();
        Vector2Int dir = nextTile - currentGridPosition;
        string dirStr = DirectionToString(dir);
        if (dirStr != null)
            networkManager.SendMoveDir(dirStr);
        else
            ProcessMoveQueue();
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

    public void RequestMoveDirection(Vector2Int direction)
    {
        if (!isReady) return;
        EnqueueDirection(direction);
    }

    // =========================
    // LIMPEZA
    // =========================

    private void OnDestroy()
    {
        // 🔥 Não há mais inscrições em eventos do NetworkManager.
        // Nada a remover aqui.
    }
}