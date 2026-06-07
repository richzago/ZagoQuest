using UnityEngine;
using UnityEngine.InputSystem;

public class PlayerController : MonoBehaviour
{
    public float speed = 5f;
    private Rigidbody2D rb;
    private Vector2 movement;
    private PlayerInputActions inputActions;

    void Awake()
    {
        // Garante que inputActions seja criado antes de qualquer uso
        inputActions = new PlayerInputActions();
        rb = GetComponent<Rigidbody2D>();
        if (rb == null) Debug.LogError("Rigidbody2D não encontrado!");
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
    }

    void FixedUpdate()
    {
        Vector2 newPos = rb.position + movement * speed * Time.fixedDeltaTime;
        Vector2Int tilePos = new Vector2Int(Mathf.FloorToInt(newPos.x), Mathf.FloorToInt(newPos.y));

        // Verifica colisão (recomendo desabilitar temporariamente para teste)
        bool walkable = GameManager.Instance != null && GameManager.Instance.IsTileWalkable(tilePos.x, tilePos.y);
        if (!walkable && movement != Vector2.zero)
        {
            // Debug.Log($"Bloqueado: {tilePos}");
            return;
        }

        rb.MovePosition(newPos);
    }
}