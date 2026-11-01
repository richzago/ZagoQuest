using UnityEngine;
using UnityEngine.InputSystem;
using UnityEngine.EventSystems;
using UnityEngine.UI;
using TMPro;
using System.Collections.Generic;

/// <summary>
/// Gerencia a seleção de alvos (monstros) e o combate automático.
/// Inclui: clique para selecionar/desmarcar (toggle), troca com Espaço,
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
    // Coleta do chão finaliza no mouse UP: aceita clique ou drag até
    // o slot BACKPACK, sem exigir Physics2DRaycaster no EventSystem.
    private string pendingGroundId;
    private Vector2 pendingGroundStart;

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
        CompleteGroundPickupOnRelease();
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
        pendingGroundId = null;
    }

    // =========================
    // EVENTOS DE INPUT
    // =========================

    private void OnMouseClick()
    {
        if (Mouse.current == null) return;
#if UNITY_EDITOR
        // Se o input chegar mas for bloqueado, o log seguinte identifica
        // a etapa. Não registrar informações de conta/sessão.
        Debug.Log("[TargetSelector][CLICK] Mouse recebido.");
#endif
        if (ChatUI.IsChatActive) return;
        if (IsPointerOverUi()) return; // bloquear SOMENTE UI realmente interativa/visível
        // Cliques em alvos, cadáveres e itens não podem enviar pacotes
        // enquanto o socket ainda autentica ou após uma desconexão.
        var network = NetworkManager.Instance;
        if (network == null || !network.isConnected) return;
        var camera = Camera.main;
        if (camera == null) return;

        Ray ray = camera.ScreenPointToRay(Mouse.current.position.ReadValue());
        // A primeira interseção pode ser um colisor de cenário/player.
        // Resolver todas as entidades sob o ponteiro pela ordem visual.
        Collider2D clicked = FindWorldClickCollider(ray);
        if (clicked != null)
        {
            Debug.Log($"[TargetSelector] Clique em: {clicked.name}, tag: {clicked.tag}");
            var npcInteract = clicked.GetComponentInParent<ClickInteract>();
            var monster = clicked.GetComponentInParent<MonsterIdentity>();
            var corpse = clicked.GetComponentInParent<CorpseIdentity>();
            var groundItem = clicked.GetComponentInParent<ItemOnGroundIdentity>();

            // ====================
            // 1. CLIQUE EM MONSTRO
            // ====================
            if (monster != null)
            {
                string clickedId = GetEntityIdFromGameObject(monster.gameObject);
                // Comportamento original estilo Tibia:
                // primeiro clique seleciona/ataca; segundo clique no mesmo
                // monstro cancela. Não remover esta alternância.
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
            else if (corpse != null)
            {
                if (!string.IsNullOrEmpty(corpse.corpseId))
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
            else if (groundItem != null)
            {
                if (!string.IsNullOrEmpty(groundItem.groundItemId))
                {
                    Debug.Log($"[TargetSelector] Clicou no item {groundItem.itemName} (ID: {groundItem.groundItemId})");
                    pendingGroundId = groundItem.groundItemId;
                    pendingGroundStart = Mouse.current.position.ReadValue();
                }
                else
                {
                    Debug.LogWarning("[TargetSelector] ItemOnGroundIdentity inválido ou sem groundItemId!");
                }
            }
            // ====================
            // 5. CLIQUE EM OUTRO LUGAR → CANCELA TARGET
            // ====================
            else
            {
                ClearTarget();
            }
        }
        else
        {
#if UNITY_EDITOR
            Debug.Log("[TargetSelector][CLICK] Nenhum collider interagível sob o mouse.");
#endif
            ClearTarget();
        }
    }

    private void CompleteGroundPickupOnRelease()
    {
        if (string.IsNullOrEmpty(pendingGroundId) ||
            Mouse.current == null || !Mouse.current.leftButton.wasReleasedThisFrame)
            return;
        string id = pendingGroundId;
        pendingGroundId = null;
        var network = NetworkManager.Instance;
        if (network == null || !network.isConnected ||
            network.Inventory == null || ChatUI.IsChatActive) return;

        Vector2 release = Mouse.current.position.ReadValue();
        // Clique normal: tolerância pequena para tremor de mão.
        bool isClick = Vector2.Distance(release, pendingGroundStart) <= 12f;
        bool overBackpack = false;
        var ui = EventSystem.current;
        if (ui != null)
        {
            uiHits.Clear();
            ui.RaycastAll(new PointerEventData(ui) { position = release }, uiHits);
            foreach (var hit in uiHits)
            {
                var slot = hit.gameObject != null
                    ? hit.gameObject.GetComponentInParent<EquipmentSlotUI>() : null;
                if (slot != null && slot.slotType == EquipmentSlot.BACKPACK)
                {
                    overBackpack = true;
                    break;
                }
            }
        }
        // Arrastar para qualquer outro painel ou para longe do sprite
        // cancela; somente clique comum ou drop no BACKPACK solicita pickup.
        if (!overBackpack && (!isClick || IsPointerOverUi())) return;
        network.Inventory.SendPickupItem(id);
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

    // Prefabs do mundo usam colisores 2D. Filhos podem conter colisores
    // independentes e precisam resolver a identidade no pai.
    private enum WorldClickKind { None, Monster, Corpse, Npc, GroundItem }

    private static WorldClickKind ClickKind(Collider2D collider)
    {
        if (collider.GetComponentInParent<CorpseIdentity>() != null)
            return WorldClickKind.Corpse;
        if (collider.GetComponentInParent<MonsterIdentity>() != null)
            return WorldClickKind.Monster;
        if (collider.GetComponentInParent<ClickInteract>() != null)
            return WorldClickKind.Npc;
        if (collider.GetComponentInParent<ItemOnGroundIdentity>() != null)
            return WorldClickKind.GroundItem;
        return WorldClickKind.None;
    }

    /// <summary>
    /// Escolhe o sprite interagível mais à frente, ignorando cenário/player.
    /// Empate de ordem visual: corpse antes de monstro (tile de morte).
    /// Nunca contorna alcance/validação de combate/loot do servidor.
    /// </summary>
    private static Collider2D FindWorldClickCollider(Ray ray)
    {
        RaycastHit2D[] hits = Physics2D.GetRayIntersectionAll(ray);
        Collider2D best = null;
        int bestLayer = int.MinValue;
        // Para NPC: clique na criatura deve prevalecer sobre qualquer item
        // solto no mesmo tile (mesmo com SpriteRenderer de ordem superior).
        Collider2D bestNpc = null;
        int npcLayer = int.MinValue, npcOrder = int.MinValue;
        int bestOrder = int.MinValue;
        int bestPriority = int.MinValue;
        float bestDistance = float.MaxValue;
        foreach (var hit in hits)
        {
            Collider2D candidate = hit.collider;
            if (candidate == null) continue;
            WorldClickKind kind = ClickKind(candidate);
            if (kind == WorldClickKind.None) continue;

            var sprite = candidate.GetComponentInParent<SpriteRenderer>();
            if (sprite == null) sprite = candidate.GetComponentInChildren<SpriteRenderer>();
            int layer = sprite != null
                ? SortingLayer.GetLayerValueFromID(sprite.sortingLayerID) : 0;
            int order = sprite != null ? sprite.sortingOrder : 0;
            if (kind == WorldClickKind.Npc &&
                (bestNpc == null || layer > npcLayer ||
                 (layer == npcLayer && order > npcOrder)))
            {
                bestNpc = candidate;
                npcLayer = layer;
                npcOrder = order;
            }
            int priority = kind == WorldClickKind.Corpse ? 4 :
                kind == WorldClickKind.Monster ? 3 :
                kind == WorldClickKind.GroundItem ? 2 : 1;

            bool better = best == null || layer > bestLayer ||
                (layer == bestLayer && order > bestOrder) ||
                (layer == bestLayer && order == bestOrder && priority > bestPriority) ||
                (layer == bestLayer && order == bestOrder &&
                 priority == bestPriority && hit.distance < bestDistance);
            if (!better) continue;
            best = candidate;
            bestLayer = layer;
            bestOrder = order;
            bestPriority = priority;
            bestDistance = hit.distance;
        }
        // NPC que está sobre um item recebe o clique mesmo se o item
        // estiver em sorting layer/ordem acima; o Node valida alcance.
        return bestNpc != null ? bestNpc : best;
    }

    /// <summary>
    /// UI pode ter Image com alpha ZERO e raycastTarget=true no Inspector.
    /// Ex.: HUD/ButtomLeft, HUD/InventoryManager e HUD/LootPanel da cena.
    /// GraphicRaycaster devolve esses elementos no RaycastAll mesmo invisíveis,
    /// portanto não se pode rejeitar QUALQUER hit de Canvas ScreenSpace.
    /// Selectables recebem o clique mesmo com Image invisível (botões/inputs).
    /// </summary>
    private static bool BlocksWorldClick(RaycastResult hit)
    {
        GameObject go = hit.gameObject;
        if (go == null) return false;
        Canvas canvas = go.GetComponentInParent<Canvas>();
        if (canvas == null || canvas.renderMode == RenderMode.WorldSpace)
            return false; // nameplates e barras de HP não são UI bloqueadora

        // Respeitar fade também de BOTÕES: um painel completamente
        // oculto via CanvasGroup não pode bloquear mundo por Selectable.
        CanvasGroup[] groups = go.GetComponentsInParent<CanvasGroup>();
        foreach (var group in groups)
            if (group != null && group.alpha <= 0.001f) return false;

        // Um controle interativo pode ter Image invisível de propósito.
        // O EventSystem já aplica interatividade/blocksRaycasts.
        if (go.GetComponentInParent<Selectable>() != null ||
            go.GetComponentInParent<C6WindowDragHandle>() != null)
            return true;

        // Imagens/labels 100% transparentes não cobrem o mundo. Unity
        // não desliga raycasts automaticamente quando Color.alpha == 0.
        Graphic graphic = go.GetComponent<Graphic>();
        if (graphic == null || !graphic.raycastTarget ||
            graphic.color.a <= 0.001f || graphic.canvasRenderer.GetAlpha() <= 0.001f)
            return false;

        return true; // fundo VISÍVEL de janela deve continuar protegendo o mundo
    }

    /// <summary>
    /// Bloquear apenas UI visível/interativa. O código C7 original bloqueava
    /// toda imagem transparente capturada por EventSystem.RaycastAll, causando
    /// o bug de cliques no combate/loot enquanto a tecla Espaço funcionava.
    /// </summary>
    private bool IsPointerOverUi()
    {
        var system = EventSystem.current;
        if (system == null || Mouse.current == null) return false;
        var pointer = new PointerEventData(system) { position = Mouse.current.position.ReadValue() };
        uiHits.Clear();
        system.RaycastAll(pointer, uiHits);
        foreach (var hit in uiHits)
        {
            if (!BlocksWorldClick(hit)) continue;
#if UNITY_EDITOR
            Debug.Log($"[TargetSelector][CLICK] UI bloqueou clique: {hit.gameObject.name} " +
                $"(Canvas={hit.gameObject.GetComponentInParent<Canvas>()?.name})");
#endif
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
        MonsterIdentity mid = go.GetComponentInParent<MonsterIdentity>();
        if (mid != null && !string.IsNullOrEmpty(mid.entityId))
            return mid.entityId;

        EntityIdentity eid = go.GetComponentInParent<EntityIdentity>();
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