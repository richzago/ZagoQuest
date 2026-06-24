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
    private bool autoFollowEnabled = true;
    private float nextFollowStepTime = 0f;
    private float followStepInterval = 0.15f;

    private GameObject currentOutline;
    private TargetOutline outlineScript;

    private InputAction mouseClickAction;
    private InputAction attackAction;
    private InputAction toggleFollowAction;

    // =========================
    // CICLO DE VIDA
    // =========================

    void Awake()
    {
        if (Instance == null) Instance = this;
        else Destroy(gameObject);

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
        if (!autoFollowEnabled || currentTarget == null) return;
        if (Time.time < nextFollowStepTime) return;

        Vector2 playerPos = transform.position;
        Vector2 targetPos = currentTarget.transform.position;
        float distance = Vector2.Distance(playerPos, targetPos);

        if (distance > 1.2f)
        {
            Vector2Int delta = new Vector2Int(
                (int)Mathf.Sign(targetPos.x - playerPos.x),
                (int)Mathf.Sign(targetPos.y - playerPos.y)
            );
            if (delta != Vector2Int.zero)
            {
                int steps = Mathf.FloorToInt(distance / 1.0f);
                for (int i = 0; i < Mathf.Min(steps, 3); i++)
                {
                    PlayerController.Instance.RequestMoveDirection(delta);
                }
                nextFollowStepTime = Time.time + followStepInterval;
            }
        }
    }

    void OnDestroy()
    {
        if (NetworkManager.Instance != null && currentTarget != null)
            NetworkManager.Instance.SendStopAutoAttack();
    }

    // =========================
    // EVENTOS DE INPUT
    // =========================

    private void OnMouseClick()
    {
        if (ChatUI.IsChatActive) return;

        Ray ray = Camera.main.ScreenPointToRay(Mouse.current.position.ReadValue());
        RaycastHit2D hit = Physics2D.GetRayIntersection(ray);
        if (hit.collider != null)
        {
            Debug.Log($"[TargetSelector] Clique em: {hit.collider.name}, tag: {hit.collider.tag}");

            // ====================
            // 1. CLIQUE EM MONSTRO
            // ====================
            if (hit.collider.CompareTag("Monster"))
            {
                string clickedId = GetEntityIdFromGameObject(hit.collider.gameObject);
                if (!string.IsNullOrEmpty(clickedId))
                {
                    if (currentTargetId == clickedId)
                        ClearTarget();
                    else
                        SelectTarget(clickedId);
                }
            }
            // ====================
            // 2. CLIQUE EM CORPSE (LOOT)
            // ====================
            else if (hit.collider.CompareTag("Corpse"))
            {
                CorpseIdentity corpse = hit.collider.GetComponent<CorpseIdentity>();
                if (corpse != null && !string.IsNullOrEmpty(corpse.corpseId))
                {
                    Debug.Log($"[TargetSelector] Clique no corpse ID {corpse.corpseId}");
                    NetworkManager.Instance.SendLoot(corpse.corpseId);
                }
                else
                {
                    Debug.LogWarning("[TargetSelector] CorpseIdentity inválido ou sem ID!");
                }
            }
            // ====================
            // 3. CLIQUE EM ITEM NO CHÃO (PICKUP)
            // ====================
            else if (hit.collider.CompareTag("ItemOnGround"))
            {
                ItemOnGroundIdentity item = hit.collider.GetComponent<ItemOnGroundIdentity>();
                if (item != null && !string.IsNullOrEmpty(item.groundItemId))
                {
                    Debug.Log($"[TargetSelector] Clicou no item {item.itemName} (ID: {item.groundItemId})");
                    NetworkManager.Instance.SendPickupItem(item.groundItemId);
                }
                else
                {
                    Debug.LogWarning("[TargetSelector] ItemOnGroundIdentity inválido ou sem groundItemId!");
                }
            }
            // ====================
            // 4. CLIQUE EM OUTRO LUGAR → CANCELA TARGET
            // ====================
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

    private void OnAttackKey()
    {
        if (ChatUI.IsChatActive) return;
        CycleToNextMonster();
    }

    private void ToggleAutoFollow()
    {
        autoFollowEnabled = !autoFollowEnabled;

    }

    // =========================
    // SELEÇÃO DE ALVO
    // =========================

    public void SelectTarget(string targetId)
    {
        if (currentTarget != null)
            NetworkManager.Instance.SendStopAutoAttack();

        currentTargetId = targetId;
        currentTarget = EntityManager.Instance.GetGameObject(targetId);

        ShowOutline(currentTarget.transform);
        NetworkManager.Instance.SendStartAutoAttack(targetId);
    }

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

    public void ClearTargetIfMatches(GameObject go)
    {
        MonsterIdentity idComp = go.GetComponent<MonsterIdentity>();
        if (idComp != null && idComp.entityId == currentTargetId)
            ClearTarget();
    }

    // =========================
    // BORDA DE SELEÇÃO
    // =========================

    private void ShowOutline(Transform target)
    {
        if (outlinePrefab == null)
        {
            Debug.LogWarning("[TargetSelector] outlinePrefab não atribuído!");
            return;
        }

        if (currentOutline != null)
        {
            outlineScript = currentOutline.GetComponent<TargetOutline>();
            if (outlineScript != null)
                outlineScript.SetTarget(target);
            return;
        }

        currentOutline = Instantiate(outlinePrefab, transform);
        outlineScript = currentOutline.GetComponent<TargetOutline>();
        if (outlineScript != null)
        {
            outlineScript.SetTarget(target);
            outlineScript.SetColor(Color.red);
        }
        else
        {
            Debug.LogError("[TargetSelector] O prefab TargetOutline não possui o script TargetOutline!");
        }
    }

    private void HideOutline()
    {
        if (outlineScript != null)
            outlineScript.Hide();
    }

    // =========================
    // UTILITÁRIOS
    // =========================

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

    private string GetEntityIdFromGameObject(GameObject go)
    {
        MonsterIdentity mid = go.GetComponent<MonsterIdentity>();
        if (mid != null && !string.IsNullOrEmpty(mid.entityId))
            return mid.entityId;

        EntityIdentity eid = go.GetComponent<EntityIdentity>();
        return eid?.entityId;
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
}