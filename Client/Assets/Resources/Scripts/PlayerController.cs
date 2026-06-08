using UnityEngine;
using UnityEngine.InputSystem;

public class PlayerController : MonoBehaviour
{
    public float speed = 5f;
    private Rigidbody2D rb;
    private Vector2 movement;
    private PlayerInputActions inputActions;
    private Animator animator; // ← NOVO: referência ao Animator

    void Awake()
    {
        // Garante que inputActions seja criado antes de qualquer uso
        inputActions = new PlayerInputActions();
        rb = GetComponent<Rigidbody2D>();
        if (rb == null) Debug.LogError("Rigidbody2D não encontrado!");

        // ← NOVO: obtém o componente Animator
        animator = GetComponent<Animator>();
        if (animator == null) Debug.LogError("Animator não encontrado no Player!");
    }

    void OnEnable()
    {
        if (inputActions == null)
            inputActions = new PlayerInputActions();
        inputActions.Gameplay.Enable();
    }

    void OnDisable()
    {
        if (inputActions != null)
            inputActions.Gameplay.Disable();
    }

    void Start()
    {
        // Já obtivemos rb no Awake, então não precisa repetir
    }

    void Update()
    {
        // Verifica se inputActions está nulo para evitar erro
        if (inputActions == null)
        {
            Debug.LogError("inputActions está nulo!");
            return;
        }

        movement.x = inputActions.Gameplay.MoveX.ReadValue<float>();
        movement.y = inputActions.Gameplay.MoveY.ReadValue<float>();
        movement.Normalize();

        // ← NOVO: envia os valores para o Animator
        if (animator != null)
        {
            animator.SetFloat("MoveX", movement.x);
            animator.SetFloat("MoveY", movement.y);
            animator.SetBool("IsMoving", movement.magnitude > 0.01f);
        }
    }
    

    void FixedUpdate()
    {
        Vector2 newPos = rb.position + movement * speed * Time.fixedDeltaTime;
        Vector2Int tilePos = new Vector2Int(Mathf.FloorToInt(newPos.x), Mathf.FloorToInt(newPos.y));

        // Verifica colisão
        bool walkable = GameManager.Instance != null && GameManager.Instance.IsTileWalkable(tilePos.x, tilePos.y);
        if (!walkable && movement != Vector2.zero)
        {
            // Debug.Log($"Bloqueado: {tilePos}");
            return;
        }

        rb.MovePosition(newPos);
    }
}