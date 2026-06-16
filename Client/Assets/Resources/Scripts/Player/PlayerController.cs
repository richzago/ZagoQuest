using UnityEngine;
using UnityEngine.InputSystem;

public class PlayerController : MonoBehaviour
{
    private NetworkManager networkManager;
    private Vector2Int currentGridPosition;
    private bool isReady = false;

    // Ações de movimento (Input System)
    private InputAction moveNorth, moveSouth, moveEast, moveWest;
    private InputAction moveNortheast, moveNorthwest, moveSoutheast, moveSouthwest;

    void Awake()
    {
        // Cria as ações e associa os callbacks
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

    void OnEnable()
    {
        moveNorth.Enable(); moveSouth.Enable(); moveEast.Enable(); moveWest.Enable();
        moveNortheast.Enable(); moveNorthwest.Enable(); moveSoutheast.Enable(); moveSouthwest.Enable();
    }

    void OnDisable()
    {
        moveNorth.Disable(); moveSouth.Disable(); moveEast.Disable(); moveWest.Disable();
        moveNortheast.Disable(); moveNorthwest.Disable(); moveSoutheast.Disable(); moveSouthwest.Disable();
    }

    void Start()
    {
        networkManager = NetworkManager.Instance;
        if (networkManager == null)
        {
            Debug.LogError("PlayerController: NetworkManager não encontrado!");
            return;
        }

        networkManager.OnInit += OnServerInit;
        networkManager.OnPositionReceived += OnPositionReceived;

        // Verifica cache (caso o init já tenha chegado)
        if (networkManager.TryGetInitPosition(out _, out Vector2 pos))
            OnServerInit(null, pos);
    }

    private void OnServerInit(string _, Vector2 pos)
    {
        currentGridPosition = new Vector2Int(Mathf.RoundToInt(pos.x), Mathf.RoundToInt(pos.y));
        transform.position = new Vector3(currentGridPosition.x, currentGridPosition.y, 0);
        isReady = true;
        Debug.Log("PlayerController: pronto para mover.");
    }

    private void OnPositionReceived(Vector2 pos)
    {
        currentGridPosition = new Vector2Int(Mathf.RoundToInt(pos.x), Mathf.RoundToInt(pos.y));
        transform.position = new Vector3(currentGridPosition.x, currentGridPosition.y, 0);
    }

    private void SendDirection(string dir)
    {
        if (!isReady) return;
        if (networkManager == null || !networkManager.isConnected) return;
        networkManager.SendMoveDir(dir);
    }

    private void OnDestroy()
    {
        if (networkManager != null)
        {
            networkManager.OnInit -= OnServerInit;
            networkManager.OnPositionReceived -= OnPositionReceived;
        }
    }
}