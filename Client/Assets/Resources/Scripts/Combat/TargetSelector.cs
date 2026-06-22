using UnityEngine;
using UnityEngine.InputSystem;
using System.Collections.Generic;

/// <summary>
/// Gerencia a seleção de alvos (monstros) e o combate automático.
/// Inclui: clique para selecionar/desmarcar, troca de alvo com Espaço,
/// auto follow, e exibição de uma borda visual ao redor do alvo selecionado.
/// </summary>
public class TargetSelector : MonoBehaviour
{
    // =========================
    // SINGLETON
    // =========================

    public static TargetSelector Instance { get; private set; }

    // =========================
    // CONFIGURAÇÕES
    // =========================

    [Header("Combate")]
    [Tooltip("Distância máxima para detectar monstros (em unidades do mundo).")]
    public float maxTargetDistance = 5f;

    [Header("Auto Follow")]
    [Tooltip("Tecla para ativar/desativar o auto follow.")]
    public KeyCode followToggleKey = KeyCode.F;

    [Header("Target Outline")]
    [Tooltip("Prefab da borda de seleção (deve conter o script TargetOutline).")]
    public GameObject outlinePrefab;

    // =========================
    // ESTADO INTERNO
    // =========================

    private string currentTargetId = null;
    private GameObject currentTarget = null;
    private bool autoFollowEnabled = true;          // Por padrão, segue o monstro
    private float nextFollowStepTime = 0f;
    private float followStepInterval = 0.4f;       // Mesmo valor do stepDuration do PlayerController

    // Borda de seleção
    private GameObject currentOutline;
    private TargetOutline outlineScript;

    // Input System
    private InputAction mouseClickAction;
    private InputAction attackAction;
    private InputAction toggleFollowAction;

    // =========================
    // CICLO DE VIDA
    // =========================

    void Awake()
    {
        // Singleton
        if (Instance == null) Instance = this;
        else Destroy(gameObject);

        // Configura as ações de input
        mouseClickAction = new InputAction("MouseClick", binding: "<Mouse>/leftButton");
        attackAction = new InputAction("Attack", binding: "<Keyboard>/space");
        toggleFollowAction = new InputAction("ToggleFollow", binding: "<Keyboard>/f");

        mouseClickAction.performed += ctx => OnMouseClick();
        attackAction.performed += ctx => OnAttackKey();
        toggleFollowAction.performed += ctx => ToggleAutoFollow();
    }

    void OnEnable()
    {
        mouseClickAction.Enable();
        attackAction.Enable();
        toggleFollowAction.Enable();
    }

    void OnDisable()
    {
        mouseClickAction.Disable();
        attackAction.Disable();
        toggleFollowAction.Disable();
    }

    void Update()
    {
        // Lógica de auto follow (movimento em direção ao alvo)
        if (!autoFollowEnabled || currentTarget == null) return;
        if (Time.time < nextFollowStepTime) return;

        Vector2 playerPos = transform.position;
        Vector2 targetPos = currentTarget.transform.position;
        float distance = Vector2.Distance(playerPos, targetPos);

        if (distance > 1.2f) // Se estiver além de 1 tile de distância
        {
            Vector2Int delta = new Vector2Int(
                (int)Mathf.Sign(targetPos.x - playerPos.x),
                (int)Mathf.Sign(targetPos.y - playerPos.y)
            );
            if (delta != Vector2Int.zero)
            {
                PlayerController.Instance.RequestMoveDirection(delta);
                nextFollowStepTime = Time.time + followStepInterval;
            }
        }
    }

    void OnDestroy()
    {
        // Ao destruir, garante que o auto attack seja interrompido
        if (NetworkManager.Instance != null && currentTarget != null)
            NetworkManager.Instance.SendStopAutoAttack();
    }

    // =========================
    // EVENTOS DE INPUT
    // =========================

    /// <summary>
    /// Chamado ao clicar com o botão esquerdo do mouse.
    /// </summary>
    private void OnMouseClick()
    {
        if (ChatUI.IsChatActive) return;

        Ray ray = Camera.main.ScreenPointToRay(Mouse.current.position.ReadValue());
        RaycastHit2D hit = Physics2D.GetRayIntersection(ray);
        if (hit.collider != null)
        {
            if (hit.collider.CompareTag("Monster"))
            {
                string clickedId = GetEntityIdFromGameObject(hit.collider.gameObject);
                if (!string.IsNullOrEmpty(clickedId))
                {
                    // Se clicou no mesmo monstro, cancela a seleção
                    if (currentTargetId == clickedId)
                        ClearTarget();
                    else
                        SelectTarget(clickedId);
                }
            }
            else if (hit.collider.CompareTag("Corpse"))
            {
                CorpseIdentity corpse = hit.collider.GetComponent<CorpseIdentity>();
                if (corpse != null && !string.IsNullOrEmpty(corpse.corpseId))
                    NetworkManager.Instance.SendLoot(corpse.corpseId);
            }
            else
            {
                ClearTarget();
            }
        }
        else
        {
            ClearTarget();
        }
    }

    /// <summary>
    /// Chamado ao pressionar a tecla Espaço.
    /// Troca para o próximo monstro disponível na tela.
    /// </summary>
    private void OnAttackKey()
    {
        if (ChatUI.IsChatActive) return;
        CycleToNextMonster();
    }

    /// <summary>
    /// Alterna o estado do auto follow (ligado/desligado).
    /// </summary>
    private void ToggleAutoFollow()
    {
        autoFollowEnabled = !autoFollowEnabled;
    }

    // =========================
    // SELEÇÃO DE ALVO
    // =========================

    /// <summary>
    /// Seleciona um alvo (monstro) pelo ID, inicia o ataque automático
    /// e exibe a borda de seleção.
    /// </summary>
    public void SelectTarget(string targetId)
    {
        // Para o ataque automático do alvo anterior
        if (currentTarget != null)
            NetworkManager.Instance.SendStopAutoAttack();

        currentTargetId = targetId;
        currentTarget = EntityManager.Instance.GetGameObject(targetId);

        // Exibe a borda ao redor do novo alvo
        ShowOutline(currentTarget.transform);

        // Inicia o ataque automático
        NetworkManager.Instance.SendStartAutoAttack(targetId);
    }

    /// <summary>
    /// Cancela a seleção atual, para o ataque automático e esconde a borda.
    /// </summary>
    public void ClearTarget()
    {
        if (!string.IsNullOrEmpty(currentTargetId))
        {
            NetworkManager.Instance.SendStopAutoAttack();
            currentTargetId = null;
            currentTarget = null;
        }

        HideOutline();
    }

    /// <summary>
    /// Cancela a seleção se o GameObject fornecido for o alvo atual.
    /// (Chamado quando um monstro é despawneado).
    /// </summary>
    public void ClearTargetIfMatches(GameObject go)
    {
        MonsterIdentity idComp = go.GetComponent<MonsterIdentity>();
        if (idComp != null && idComp.entityId == currentTargetId)
            ClearTarget();
    }

    // =========================
    // BORDA DE SELEÇÃO
    // =========================

    /// <summary>
    /// Exibe a borda ao redor do alvo.
    /// Se a borda ainda não existir, instancia uma nova.
    /// </summary>
    private void ShowOutline(Transform target)
    {
        // Debug.Log("[TargetSelector] ShowOutline chamado.");
        if (outlinePrefab == null)
        {
            Debug.LogWarning("[TargetSelector] outlinePrefab não atribuído!");
#if UNITY_EDITOR
            Debug.LogWarning("[TargetSelector] outlinePrefab não atribuído!");
#endif
            return;
        }

        // Se já existe, apenas atualiza o alvo
        if (currentOutline != null)
        {
            outlineScript = currentOutline.GetComponent<TargetOutline>();
            if (outlineScript != null)
                outlineScript.SetTarget(target);
            return;
        }

        // Cria nova instância como filho do TargetSelector
        currentOutline = Instantiate(outlinePrefab, transform);
        outlineScript = currentOutline.GetComponent<TargetOutline>();
        if (outlineScript != null)
        {
            outlineScript.SetTarget(target);
            outlineScript.SetColor(Color.red); // Cor padrão (futuramente pode ser parametrizada)
            // Debug.Log("[TargetSelector] Outline configurado.");
        }
        else
        {
#if UNITY_EDITOR
            Debug.LogError("[TargetSelector] O prefab TargetOutline não possui o script TargetOutline!");
#endif
        }
    }

    /// <summary>
    /// Esconde a borda (sem destruí-la, para reutilização futura).
    /// </summary>
    private void HideOutline()
    {
        if (outlineScript != null)
            outlineScript.Hide();
    }

    // =========================
    // UTILITÁRIOS
    // =========================

    /// <summary>
    /// Cicla para o próximo monstro dentro do alcance.
    /// </summary>
    private void CycleToNextMonster()
    {
        List<string> nearbyMonsters = new List<string>();
        Collider2D[] colliders = Physics2D.OverlapCircleAll(transform.position, maxTargetDistance);
        foreach (var col in colliders)
        {
            if (col.CompareTag("Monster"))
            {
                string id = GetEntityIdFromGameObject(col.gameObject);
                if (!string.IsNullOrEmpty(id))
                    nearbyMonsters.Add(id);
            }
        }

        if (nearbyMonsters.Count == 0)
        {
            ClearTarget();
            return;
        }

        if (!string.IsNullOrEmpty(currentTargetId))
        {
            int idx = nearbyMonsters.IndexOf(currentTargetId);
            if (idx >= 0 && idx < nearbyMonsters.Count - 1)
                SelectTarget(nearbyMonsters[idx + 1]);
            else
                SelectTarget(nearbyMonsters[0]);
        }
        else
        {
            SelectTarget(nearbyMonsters[0]);
        }
    }

    /// <summary>
    /// Extrai o ID da entidade a partir do GameObject (monstro ou entidade genérica).
    /// </summary>
    private string GetEntityIdFromGameObject(GameObject go)
    {
        MonsterIdentity mid = go.GetComponent<MonsterIdentity>();
        if (mid != null && !string.IsNullOrEmpty(mid.entityId))
            return mid.entityId;

        EntityIdentity eid = go.GetComponent<EntityIdentity>();
        return eid?.entityId;
    }

    /// <summary>
    /// Converte um vetor de direção para string (usado no envio de movimento).
    /// </summary>
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
}