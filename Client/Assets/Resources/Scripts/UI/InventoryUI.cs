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
    private int currentGold = 0;
    private List<GameObject> slotObjects = new List<GameObject>();

    private InputAction toggleInventoryAction;
    private bool isInventoryOpen = false;

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
    }

    private void ToggleInventory()
    {
        if (inventoryPanel == null) return;
        isInventoryOpen = !isInventoryOpen;
        inventoryPanel.SetActive(isInventoryOpen);
        if (isInventoryOpen)
            RefreshUI();
    }

    // =========================
    // MÉTODOS PÚBLICOS PARA HANDLERS
    // =========================

    /// <summary>
    /// Chamado pelo InventoryHandler para atualizar o inventário.
    /// </summary>
    public void HandleInventory(int gold, Dictionary<string, int> newItems)
    {
        currentGold = gold;
        items = newItems ?? new Dictionary<string, int>();
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
            Destroy(slot);
        slotObjects.Clear();

        if (slotPrefab == null || slotsGrid == null) return;
        foreach (var kvp in items)
        {
            GameObject slot = Instantiate(slotPrefab, slotsGrid);
            InventorySlot slotScript = slot.GetComponent<InventorySlot>();
            if (slotScript != null)
            {
                slotScript.Setup(kvp.Key, kvp.Value, NetworkManager.Instance ?? networkManager);
                slotScript.OnDoubleClick += OnSlotDoubleClicked;
            }
            slotObjects.Add(slot);
        }
    }

    // =========================
    // INTERAÇÃO COM ITENS
    // =========================

    private void OnSlotDoubleClicked(string itemId)
    {
        var network = NetworkManager.Instance;
        if (network == null || !network.isConnected || network.Inventory == null ||
            string.IsNullOrWhiteSpace(itemId)) return;
        // Node valida se o item é equipável, se há quantidade e slot compatível.
        network.Inventory.SendEquipItem(itemId);
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