using UnityEngine;
using UnityEngine.InputSystem;
using UnityEngine.EventSystems;
using UnityEngine.UI;
using TMPro;
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

    private GameObject currentOutline;
    private TargetOutline outlineScript;

    private InputAction mouseClickAction;
    private InputAction attackAction;
    private InputAction toggleFollowAction;
    // Reuso da lista: não alocar por clique quando o player está em combate.
    private readonly List<RaycastResult> uiHits = new List<RaycastResult>(16);

    // =========================
    // CICLO DE VIDA
    // =========================

    void Awake()
    {
        if (Instance != null && Instance != this)
        {
            Destroy(gameObject);
            return; // a duplicata não pode registrar InputActions
        }
        Instance = this;

        mouseClickAction = new InputAction("MouseClick", binding: "<Mouse>/leftButton");
        attackAction = new InputAction("Attack", binding: "<Keyboard>/space");
        toggleFollowAction = new InputAction("ToggleFollow", binding: "<Keyboard>/f");

        mouseClickAction.performed += ctx => OnMouseClick();
        attackAction.performed += ctx => OnAttackKey();
        toggleFollowAction.performed += ctx => ToggleAutoFollow();
    }

    void OnEnable()
    {
        mouseClickAction?.Enable();
        attackAction?.Enable();
        toggleFollowAction?.Enable();
    }

    void OnDisable()
    {
        mouseClickAction?.Disable();
        attackAction?.Disable();
        toggleFollowAction?.Disable();
    }

    void Update()
    {
        if (!autoFollowEnabled || currentTarget == null) return;
        if (PlayerController.Instance == null || NetworkManager.Instance == null ||
            !NetworkManager.Instance.isConnected) return;
        if (Time.time < nextFollowStepTime) return;

        // O TargetSelector pode estar em outro GameObject da Hierarchy.
        // Nunca calcular a distância usando o transform deste componente.
        // PlayerController usa exclusivamente a última posição validada pelo Node.
        PlayerController.Instance.RequestFollowTowards(currentTarget.transform.position);
        nextFollowStepTime = Time.time + PlayerController.Instance.FollowIntervalSeconds;
    }

    void OnDestroy()
    {
        // Durante encerramento/reload a conexão e o CombatSender podem
        // não existir. Nunca enviar comando pela sessão antiga/desconectada.
        if (Instance == this)
        {
            if (currentTarget != null && NetworkManager.Instance != null &&
                NetworkManager.Instance.isConnected && NetworkManager.Instance.Combat != null)
                NetworkManager.Instance.Combat.SendStopAutoAttack();
            Instance = null;
        }
        mouseClickAction?.Dispose();
        attackAction?.Dispose();
        toggleFollowAction?.Dispose();
    }

    // =========================
    // EVENTOS DE INPUT
    // =========================

    private void OnMouseClick()
    {
        if (ChatUI.IsChatActive || IsPointerOverUi()) return;
        // Cliques em alvos, cadáveres e itens não podem enviar pacotes
        // enquanto o socket ainda autentica ou após uma desconexão.
        var network = NetworkManager.Instance;
        if (network == null || !network.isConnected) return;
        var camera = Camera.main;
        if (camera == null) return;

        Ray ray = camera.ScreenPointToRay(Mouse.current.position.ReadValue());
        RaycastHit2D hit = Physics2D.GetRayIntersection(ray);
        if (hit.collider != null)
        {
            Debug.Log($"[TargetSelector] Clique em: {hit.collider.name}, tag: {hit.collider.tag}");
            var npcInteract = hit.collider.GetComponentInParent<ClickInteract>();

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
                    network.Inventory?.SendLoot(corpse.corpseId);
                }
                else
                {
                    Debug.LogWarning("[TargetSelector] CorpseIdentity inválido ou sem ID!");
                }
            }
            // ====================
            // 3. CLIQUE EM NPC (mesmo Input System usado por loot/monstros)
            // ====================
            else if (npcInteract != null)
            {
                npcInteract.Interact();
            }
            // ====================
            // 4. CLIQUE EM ITEM NO CHÃO (PICKUP)
            // ====================
            else if (hit.collider.CompareTag("ItemOnGround"))
            {
                ItemOnGroundIdentity item = hit.collider.GetComponent<ItemOnGroundIdentity>();
                if (item != null && !string.IsNullOrEmpty(item.groundItemId))
                {
                    Debug.Log($"[TargetSelector] Clicou no item {item.itemName} (ID: {item.groundItemId})");
                    network.Inventory?.SendPickupItem(item.groundItemId);
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
        if (ChatUI.IsChatActive || IsTyping() ||
            NetworkManager.Instance == null || !NetworkManager.Instance.isConnected) return;
        CycleToNextMonster();
    }

    private void ToggleAutoFollow()
    {
        if (ChatUI.IsChatActive || IsTyping()) return;
        autoFollowEnabled = !autoFollowEnabled;

    }

    // =========================
    // SELEÇÃO DE ALVO
    // =========================

    public void SelectTarget(string targetId)
    {
        var network = NetworkManager.Instance;
        if (string.IsNullOrEmpty(targetId) || network == null ||
            !network.isConnected || network.Combat == null ||
            EntityManager.Instance == null) return;

        // Resolver o próximo alvo ANTES de interromper o atual. Quando um
        // monstro despawna entre o clique e a seleção, GetGameObject retorna
        // null: antes enviávamos STOP duas vezes e perdíamos o alvo válido.
        GameObject nextTarget = EntityManager.Instance.GetGameObject(targetId);
        if (nextTarget == null)
        {
            Debug.LogWarning($"[TargetSelector] Alvo {targetId} não existe mais no cliente.");
            return;
        }
        if (currentTargetId == targetId) return; // seleção repetida não reenvia START

        if (currentTarget != null)
            network.Combat.SendStopAutoAttack();

        currentTargetId = targetId;
        currentTarget = nextTarget;
        ShowOutline(currentTarget.transform);
        network.Combat.SendStartAutoAttack(targetId);
    }

    /// <summary>
    /// Cancelamento LOCAL do usuário (clique, troca de alvo, morte/despawn):
    /// somente nesse fluxo o cliente avisa o servidor para parar.
    /// </summary>
    public void ClearTarget()
    {
        ClearTargetInternal(true);
    }

    /// <summary>
    /// O pacote autoAttackStopped já foi decidido pelo servidor.
    /// Não ecoar stopAutoAttack ao recebê-lo. O targetId opcional impede que
    /// um ACK atrasado de alvo antigo cancele a seleção mais recente.
    /// </summary>
    public void OnServerAutoAttackStopped(string targetId, string reason)
    {
        if (!string.IsNullOrEmpty(targetId) && targetId != currentTargetId)
        {
            Debug.Log($"[AUTO] Ignorando STOP atrasado de {targetId}: alvo atual {currentTargetId ?? "(nenhum)"}");
            return;
        }
        Debug.Log($"[AUTO] Stop do servidor para {targetId ?? currentTargetId ?? "(nenhum)"}: {reason}");
        ClearTargetInternal(false);
    }

    private void ClearTargetInternal(bool notifyServer)
    {
        bool hadTarget = !string.IsNullOrEmpty(currentTargetId);
        currentTargetId = null;
        currentTarget = null;
        HideOutline();

        if (hadTarget && notifyServer && NetworkManager.Instance != null &&
            NetworkManager.Instance.isConnected && NetworkManager.Instance.Combat != null)
            NetworkManager.Instance.Combat.SendStopAutoAttack();
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

    /// <summary>Precedência de UI: ponteiro em qualquer GraphicRaycaster bloqueia o mundo.</summary>
    private bool IsPointerOverUi()
    {
        var system = EventSystem.current;
        if (system == null || Mouse.current == null) return false;
        var pointer = new PointerEventData(system) { position = Mouse.current.position.ReadValue() };
        uiHits.Clear();
        system.RaycastAll(pointer, uiHits);
        foreach (var hit in uiHits)
        {
            if (hit.gameObject == null) continue;
            var canvas = hit.gameObject.GetComponentInParent<Canvas>();
            // Nameplates world-space decorativas não podem bloquear combate.
            if (canvas != null && (canvas.renderMode != RenderMode.WorldSpace ||
                hit.gameObject.GetComponentInParent<Selectable>() != null))
                return true;
        }
        return false;
    }

    private static bool IsTyping()
    {
        var selected = EventSystem.current != null
            ? EventSystem.current.currentSelectedGameObject : null;
        return selected != null &&
            selected.GetComponentInParent<TMP_InputField>() != null;
    }

    /// <summary>
    /// Seleção ordenada por proximidade e ID; centro sempre do PlayerController,
    /// nunca da posição arbitrária do GameObject TargetSelector na Hierarchy.
    /// </summary>
    private void CycleToNextMonster()
    {
        var player = PlayerController.Instance;
        if (player == null) return;
        Vector2 center = player.transform.position;
        float maxSqr = maxTargetDistance * maxTargetDistance;
        var nearby = new List<(string id, float distance)>();
        var unique = new HashSet<string>();
        foreach (var col in Physics2D.OverlapCircleAll(center, maxTargetDistance))
        {
            if (!col.CompareTag("Monster")) continue;
            string id = GetEntityIdFromGameObject(col.gameObject);
            if (string.IsNullOrEmpty(id) || !unique.Add(id)) continue;
            float dist = ((Vector2)col.transform.position - center).sqrMagnitude;
            if (dist <= maxSqr) nearby.Add((id, dist));
        }
        nearby.Sort((a, b) => {
            int compare = a.distance.CompareTo(b.distance);
            return compare != 0 ? compare : string.CompareOrdinal(a.id, b.id);
        });
        if (nearby.Count == 0)
        {
            ClearTarget();
            return;
        }
        int index = nearby.FindIndex(x => x.id == currentTargetId);
        SelectTarget(nearby[(index + 1) % nearby.Count].id);
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