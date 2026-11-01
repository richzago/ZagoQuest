using UnityEngine;
using UnityEngine.UI;
using TMPro;
using System.Collections.Generic;

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
    /** Visual rows: distinct Bags with same itemId no longer collapse to xN. */
    public sealed class InventoryEntry
    {
        public string itemId;
        public int amount;
        public string itemType;
        public string instanceId;
        public string slotId; // UUID da pilha física recebido do servidor.
    }
    private List<InventoryEntry> visibleRows;
    private int currentGold = 0;
    // Evita que redraw do inventário equipe outro item sob o cursor em segundos.
    private float lastEquipmentUseAt = -1f;
    private const float EquipmentClickGuardSeconds = 0.45f;
    private List<GameObject> slotObjects = new List<GameObject>();

    private bool isInventoryOpen = false;
    public bool IsInventoryOpen => isInventoryOpen;
    public bool HasEquippedBag => bagSlots > 0 && !string.IsNullOrEmpty(bagItemId);
    public string EquippedBagId => bagItemId;
    public int BagSlots => bagSlots;
    public int SlotsUsed => slotsUsed;
    public string CurrentBagInstanceId { get; private set; }

    public void SetCurrentBagInstance(string id)
    {
        CurrentBagInstanceId = id;
    }
    private string bagItemId;
    private int bagSlots;
    private int slotsUsed;

    private void Awake()
    {
        if (Instance != null && Instance != this)
        {
            Destroy(gameObject);
            return;
        }
        Instance = this;
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
        if (!HasEquippedBag)
        {
            ChatUI.Instance?.AddMessage("Equipe ou compre uma Bag/Backpack para abrir os itens.");
            return;
        }
        if (!isInventoryOpen)
        {
            isInventoryOpen = true;
            inventoryPanel.SetActive(true);
            RefreshUI();
        }
        C8SidebarDynamicDock.Instance?.OnInventoryVisibilityChanged(true);
    }

    public void ToggleBackpack()
    {
        if (isInventoryOpen) CloseInventory();
        else OpenInventory();
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
        HandleInventory(gold, newItems, newItemTypes, bagItemId, bagSlots, slotsUsed);
    }

    public void HandleInventory(int gold, Dictionary<string, int> newItems,
        Dictionary<string, string> newItemTypes,
        string equippedBagId, int capacity, int used)
    {
        visibleRows = null;
        SetInventorySnapshot(gold,newItems,newItemTypes,equippedBagId,capacity,used);
    }

    public void HandleInventory(int gold, Dictionary<string,int> newItems,
        Dictionary<string,string> newItemTypes,string bagId,int capacity,int used,
        List<InventoryEntry> rows)
    {
        visibleRows = rows;
        SetInventorySnapshot(gold,newItems,newItemTypes,bagId,capacity,used);
    }

    private void SetInventorySnapshot(int gold, Dictionary<string,int> newItems,
        Dictionary<string,string> newItemTypes,string equippedBagId,int capacity,int used)
    {
        currentGold = gold;
        items = newItems ?? new Dictionary<string, int>();
        itemTypes = newItemTypes ?? new Dictionary<string, string>();
        bagItemId = equippedBagId;
        bagSlots = Mathf.Max(0, capacity);
        slotsUsed = Mathf.Max(0, used);
        if (!HasEquippedBag && isInventoryOpen) CloseInventory();
        if (isInventoryOpen) RefreshUI();
        UpdateBagFooter();
    }

    private void UpdateBagFooter()
    {
        if (goldText != null)
            goldText.text = HasEquippedBag
                ? $"Slots: {slotsUsed}/{bagSlots}   Ouro: {currentGold:N0}  •  Backspace: voltar"
                : $"Sem Bag/Backpack   Ouro: {currentGold:N0}";
    }

    /// <summary>
    /// Atualização isolada de saldo: NÃO substitui o inventário por um vazio.
    /// Chamado pelo ServerFeedbackHandler ao receber {type:"gold"}.
    /// </summary>
    public void UpdateGold(int gold)
    {
        currentGold = gold;
        UpdateBagFooter();
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
        // As células vazias preservam o grid de slots de verdade, como Tibia.
        // A quantidade sempre vem do CAP de slots do Node, não do cliente.
        ShowEmptyState(false);
        if (visibleRows != null)
        {
            foreach (var row in visibleRows)
            {
                var go=Instantiate(slotPrefab, slotsGrid);
                var slot=go.GetComponent<InventorySlot>();
                if (slot != null)
                {
                    slot.Setup(row.itemId,row.amount,NetworkManager.Instance ?? networkManager,
                        row.itemType,row.instanceId);
                    slot.OnBagOpen += OpenBagInstance;
                    slot.OnDoubleClick += OnSlotDoubleClicked;
                }
                slotObjects.Add(go);
            }
            CreateEmptySlotVisuals();
            return;
        }
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
        CreateEmptySlotVisuals();
    }

    private void CreateEmptySlotVisuals()
    {
        if (slotsGrid == null || !HasEquippedBag) return;
        // Cada Bag tem um limite de slots do servidor. O cliente só desenha
        // os vazios, sem criar itens, sem aceitar drag nem modificar inventário.
        int available = Mathf.Max(0, bagSlots - slotsUsed);
        for (int i = 0; i < available; i++)
        {
            var cell = new GameObject("C16EmptyBagSlot", typeof(RectTransform),
                typeof(UnityEngine.UI.Image));
            cell.transform.SetParent(slotsGrid, false);
            var image = cell.GetComponent<UnityEngine.UI.Image>();
            image.color = new Color32(31, 42, 51, 160);
            image.raycastTarget = false;
            slotObjects.Add(cell);
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

    private void Update()
    {
        // Backspace não está vinculado ao movimento WASD e volta um nível
        // na pilha de Bags. Chat e campos de texto têm prioridade.
        var k = UnityEngine.InputSystem.Keyboard.current;
        if (k == null || !isInventoryOpen || !k.backspaceKey.wasPressedThisFrame ||
            ChatUI.IsChatActive) return;
        var selected = UnityEngine.EventSystems.EventSystem.current?.currentSelectedGameObject;
        if (selected != null &&
            selected.GetComponentInParent<TMP_InputField>() != null) return;
        var net = NetworkManager.Instance;
        if (net != null && net.isConnected) net.Inventory?.CloseBag();
    }

    private void OpenBagInstance(string itemId,string instanceId)
    {
        var net=NetworkManager.Instance;
        if (net == null || !net.isConnected || string.IsNullOrEmpty(instanceId)) return;
        net.Inventory?.OpenBag(itemId,instanceId);
    }

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
        // Uma Bag DENTRO de outra abre sua própria janela (sem equipar e
        // sem mesclar conteúdos). O Node valida a relação pai→filho.
        if (itemId.Contains("/backpack/"))
        {
            network.Inventory.OpenBag(itemId);
            return;
        }
        // Node é o único que decide se o ID é realmente equipável.
        network.Inventory.UseItem(itemId);
    }

    // =========================
    // LIMPEZA
    // =========================

    private void OnDestroy()
    {
        if (Instance == this) Instance = null;
    }
}
