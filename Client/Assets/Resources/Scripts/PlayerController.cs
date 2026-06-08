using UnityEngine;
using UnityEngine.InputSystem;

public class PlayerController : MonoBehaviour
{
    [Header("Configurações")]
    public float speed = 5f;

    private Rigidbody2D rb;
    private Vector2 movement;
    private PlayerInputActions inputActions;
    private Animator animator;
    private NetworkManager networkManager;

    private Vector2 serverPosition;      // Última posição recebida do servidor
    private bool hasServerPosition = false;

    void Awake()
    {
        inputActions = new PlayerInputActions();
        rb = GetComponent<Rigidbody2D>();
        animator = GetComponent<Animator>();
        networkManager = FindAnyObjectByType<NetworkManager>();

        if (rb == null) Debug.LogError("PlayerController: Rigidbody2D ausente");
        if (animator == null) Debug.LogError("PlayerController: Animator ausente");
        if (networkManager == null) Debug.LogError("PlayerController: NetworkManager ausente");
    }

    void OnEnable()
    {
        inputActions.Gameplay.Enable();
        if (networkManager != null)
        {
            networkManager.OnPositionReceived += OnServerPosition;
            networkManager.OnInit += OnServerInit;
        }
    }

    void OnDisable()
    {
        inputActions.Gameplay.Disable();
        if (networkManager != null)
        {
            networkManager.OnPositionReceived -= OnServerPosition;
            networkManager.OnInit -= OnServerInit;
        }
    }

    void Update()
    {
        // Lê input
        movement.x = inputActions.Gameplay.MoveX.ReadValue<float>();
        movement.y = inputActions.Gameplay.MoveY.ReadValue<float>();
        movement.Normalize();

        // Atualiza animações
        if (animator != null)
        {
            animator.SetFloat("MoveX", movement.x);
            animator.SetFloat("MoveY", movement.y);
            animator.SetBool("IsMoving", movement.magnitude > 0.01f);
        }
    }

  void FixedUpdate()
{
    if (movement != Vector2.zero)
    {
        Vector2 desiredPos = rb.position + movement * speed * Time.fixedDeltaTime;
        networkManager.SendMove(desiredPos);
    }
}

    // Posição inicial enviada pelo servidor
    private void OnServerInit(int playerId, Vector2 pos)
    {
        rb.position = pos;
        serverPosition = pos;
        hasServerPosition = true;
    }

    // Posição autoritativa atualizada
    private void OnServerPosition(Vector2 newPos)
{
    rb.position = newPos;
    transform.position = newPos;
}
}