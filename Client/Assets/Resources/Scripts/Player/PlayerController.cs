using UnityEngine;
using UnityEngine.InputSystem;

public class PlayerController : MonoBehaviour
{
    public float speed = 5f;

    private Rigidbody2D rb;
    private Vector2 movement;
    private PlayerInputActions inputActions;
    private Animator animator;
    private NetworkManager networkManager;

    void Awake()
    {
        inputActions = new PlayerInputActions();
        rb = GetComponent<Rigidbody2D>();
        animator = GetComponent<Animator>();
        networkManager = FindAnyObjectByType<NetworkManager>();

        if (networkManager == null) Debug.LogError("NetworkManager não encontrado!");
    }

    void OnEnable()
    {
        inputActions.Gameplay.Enable();
        if (networkManager != null)
        {
            networkManager.OnPositionReceived += OnServerPosition;
            networkManager.OnInit += OnServerInit;  // ← assinatura deve corresponder
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
        movement.x = inputActions.Gameplay.MoveX.ReadValue<float>();
        movement.y = inputActions.Gameplay.MoveY.ReadValue<float>();
        movement.Normalize();

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

    /// <summary>
    /// Evento chamado quando o servidor envia a posição inicial (init).
    /// </summary>
    /// <param name="playerId">ID do jogador (UUID, string)</param>
    /// <param name="pos">Posição inicial</param>
    private void OnServerInit(string playerId, Vector2 pos)
    {
        rb.position = pos;
        Debug.Log($"Player inicializado em {pos} com ID {playerId}");
    }

    /// <summary>
    /// Evento chamado quando o servidor envia uma posição autoritativa (position).
    /// </summary>
    /// <param name="newPos">Nova posição</param>
    private void OnServerPosition(Vector2 newPos)
    {
        rb.position = newPos;
    }
}