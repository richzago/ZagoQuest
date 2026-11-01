using UnityEngine;
using UnityEngine.UI;
using TMPro;
using System.Collections.Generic;
using UnityEngine.InputSystem;

public class InventoryUI : MonoBehaviour
{
    public static InventoryUI Instance { get; private set; }

    [Header("UI References")]
    public GameObject slotPrefab;
    public Transform slotsGrid;
    public TextMeshProUGUI goldText;
    public GameObject inventoryPanel;

    private NetworkManager networkManager;
    private Dictionary<string, int> items = new Dictionary<string, int>();
    private Dictionary<string, string> itemTypes = new Dictionary<string, string>();
    private int currentGold = 0;
    // Evita que redraw do inventário equipe outro item sob o cursor em segundos.
    private float lastEquipmentUseAt = -1f;
    private const float EquipmentClickGuardSeconds = 0.45f;
    private List<GameObject> slotObjects = new List<GameObject>();

    private InputAction toggleInventoryAction;
    private bool isInventoryOpen = false;
    public bool IsInventoryOpen => isInventoryOpen;

    // =========================
    // CICLO DE VIDA
    // =========================

    private void Awake()
    {
        if (Instance != null && Instance != this)
        {
            Destroy(gameObject);
            return;
        }
        Instance = this;
        toggleInventoryAction = new InputAction("ToggleInventory", binding: "<Keyboard>/i");
        // Delegate nomeado: a mesma referência precisa ser removida no OnDestroy.
        toggleInventoryAction.performed += OnToggleInventory;
    }

    private void OnEnable() => toggleInventoryAction?.Enable();
    private void OnDisable() => toggleInventoryAction?.Disable();

    private void OnToggleInventory(InputAction.CallbackContext context)
    {
        var eventSystem = UnityEngine.EventSystems.EventSystem.current;
        var selected = eventSystem != null ? eventSystem.currentSelectedGameObject : null;
        if (selected != null && selected.GetComponentInParent<TMP_InputField>() != null)
            return; // o atalho I não deve funcionar enquanto digita no chat/input.
        ToggleInventory();
    }

    private void Start()
    {
        networkManager = NetworkManager.Instance ?? FindAnyObjectByType<NetworkManager>();
        if (networkManager == null)
            Debug.LogWarning("[InventoryUI] Rede não encontrada na inicialização; aguardando conexão.");

        if (inventoryPanel == null)
        {
            Debug.LogError("❌ InventoryPanel não atribuído no Inspector!");
            return;
        }

        isInventoryOpen = false;
        C6InventoryEquipmentLayout.Inventory(inventoryPanel, slotsGrid, goldText, CloseInventory);
        inventoryPanel.SetActive(false);
    }

    // =========================
    // CONTROLE DO PAINEL
    // =========================

    public void CloseInventory()
    {
        isInventoryOpen = false;
        if (inventoryPanel != null) inventoryPanel.SetActive(false);
        C8SidebarDynamicDock.Instance?.OnInventoryVisibilityChanged(false);
    }

    /// <summary>Abre o inventario real pelo botão MOCHILA, sem duplicar snapshots.</summary>
    public void OpenInventory()
    {
        if (inventoryPanel == null) return;
        if (!isInventoryOpen)
        {
            isInventoryOpen = true;
            inventoryPanel.SetActive(true);
            RefreshUI();
        }
        C8SidebarDynamicDock.Instance?.OnInventoryVisibilityChanged(true);
    }

    private void ToggleInventory()
    {
        if (inventoryPanel == null) return;
        isInventoryOpen = !isInventoryOpen;
        inventoryPanel.SetActive(isInventoryOpen);
        if (isInventoryOpen)
            RefreshUI();
        C8SidebarDynamicDock.Instance?.OnInventoryVisibilityChanged(isInventoryOpen);
    }

    // =========================
    // MÉTODOS PÚBLICOS PARA HANDLERS
    // =========================

    /// <summary>
    /// Chamado pelo InventoryHandler para atualizar o inventário.
    /// </summary>
    public void HandleInventory(int gold, Dictionary<string, int> newItems)
    {
        HandleInventory(gold, newItems, null);
    }

    /// <summary>O tipo vem do Node e serve só à UX do clique simples.</summary>
    public void HandleInventory(int gold, Dictionary<string, int> newItems,
        Dictionary<string, string> newItemTypes)
    {
        currentGold = gold;
        items = newItems ?? new Dictionary<string, int>();
        itemTypes = newItemTypes ?? new Dictionary<string, string>();
        if (isInventoryOpen)
            RefreshUI();
    }

    /// <summary>
    /// Atualização isolada de saldo: NÃO substitui o inventário por um vazio.
    /// Chamado pelo ServerFeedbackHandler ao receber {type:"gold"}.
    /// </summary>
    public void UpdateGold(int gold)
    {
        currentGold = gold;
        if (goldText != null)
            goldText.text = $"Ouro em mãos: {currentGold:N0} gold";
    }

    /// <summary>
    /// Chamado pelo ItemUsedHandler para exibir mensagem de uso de item.
    /// </summary>
    public void HandleItemUsed(string itemId, bool success, string message)
    {
        if (ChatUI.Instance != null)
            ChatUI.Instance.AddMessage($"Item: {message}");
    }

    // =========================
    // EVENTOS DO NETWORK (mantido para compatibilidade)
    // =========================

    private void HandleInventoryEvent(int gold, Dictionary<string, int> newItems)
    {
        // 🔥 Redireciona para o método público
        HandleInventory(gold, newItems);
    }

    private void HandleItemUsedEvent(string itemId, bool success, string message)
    {
        HandleItemUsed(itemId, success, message);
    }

    // =========================
    // REFRESH DA UI
    // =========================

    private void RefreshUI()
    {
        if (goldText != null)
            goldText.text = $"Ouro em mãos: {currentGold:N0} gold";

        foreach (var slot in slotObjects)
        {
            // Destroy ocorre só no fim do frame. Desativar já evita um
            // segundo OnPointerClick num slot antigo após snapshot de equip.
            if (slot != null)
            {
                slot.SetActive(false);
                Destroy(slot);
            }
        }
        slotObjects.Clear();

        if (slotPrefab == null || slotsGrid == null) return;
        ShowEmptyState(items.Count == 0);
        foreach (var kvp in items)
        {
            GameObject slot = Instantiate(slotPrefab, slotsGrid);
            InventorySlot slotScript = slot.GetComponent<InventorySlot>();
            if (slotScript != null)
            {
                itemTypes.TryGetValue(kvp.Key, out string type);
                slotScript.Setup(kvp.Key, kvp.Value, NetworkManager.Instance ?? networkManager, type);
                slotScript.OnDoubleClick += OnSlotDoubleClicked;
            }
            slotObjects.Add(slot);
        }
    }

    /// <summary>Estado vazio puramente visual; não altera a lista do servidor.</summary>
    private void ShowEmptyState(bool empty)
    {
        if (inventoryPanel == null) return;
        var viewport = inventoryPanel.transform.Find("C6InventoryViewport");
        if (viewport == null) return;
        var existing = viewport.Find("C6EmptyInventoryLabel");
        GameObject labelObject = existing != null ? existing.gameObject : null;
        if (labelObject == null && empty)
        {
            labelObject = new GameObject("C6EmptyInventoryLabel",
                typeof(RectTransform), typeof(TextMeshProUGUI));
            labelObject.transform.SetParent(viewport, false);
            var label = labelObject.GetComponent<TextMeshProUGUI>();
            label.text = "Inventário vazio";
            label.fontSize = 18;
            label.color = new Color32(181, 196, 207, 255);
            label.alignment = TextAlignmentOptions.Center;
            label.raycastTarget = false;
            var rect = label.rectTransform;
            rect.anchorMin = Vector2.zero;
            rect.anchorMax = Vector2.one;
            rect.offsetMin = Vector2.zero;
            rect.offsetMax = Vector2.zero;
        }
        if (labelObject != null) labelObject.SetActive(empty);
    }

    // =========================
    // INTERAÇÃO COM ITENS
    // =========================

    private void OnSlotDoubleClicked(string itemId)
    {
        var network = NetworkManager.Instance;
        if (network == null || !network.isConnected || network.Inventory == null ||
            string.IsNullOrWhiteSpace(itemId)) return;
        // O clique simples em consumível já solicitou useItem no InventorySlot.
        // O duplo clique para equipar aceita APENAS o item ainda presente no
        // último snapshot, não o slot que tomou seu lugar num redraw.
        if (!items.TryGetValue(itemId, out int quantity) || quantity <= 0) return;
        if (itemTypes.TryGetValue(itemId, out string type) && type == "consumable") return;
        float now = Time.unscaledTime;
        if (lastEquipmentUseAt >= 0f &&
            now >= lastEquipmentUseAt &&
            now - lastEquipmentUseAt < EquipmentClickGuardSeconds)
            return;
        lastEquipmentUseAt = now;
        // Node é o único que decide se o ID é realmente equipável.
        network.Inventory.UseItem(itemId);
    }

    // =========================
    // LIMPEZA
    // =========================

    private void OnDestroy()
    {
        if (toggleInventoryAction != null)
        {
            toggleInventoryAction.performed -= OnToggleInventory;
            toggleInventoryAction.Dispose();
            toggleInventoryAction = null;
        }
        if (Instance == this) Instance = null;
    }
}