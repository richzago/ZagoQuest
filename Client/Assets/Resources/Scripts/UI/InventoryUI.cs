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
        if (Instance == null)
            Instance = this;
        else
            Destroy(gameObject);

        toggleInventoryAction = new InputAction("ToggleInventory", binding: "<Keyboard>/i");
        toggleInventoryAction.performed += ctx =>
        {
            if (UnityEngine.EventSystems.EventSystem.current != null)
            {
                var selected = UnityEngine.EventSystems.EventSystem.current.currentSelectedGameObject;
                if (selected != null && selected.GetComponent<TMPro.TMP_InputField>() != null)
                    return;
            }
            ToggleInventory();
        };
    }

    private void OnEnable() => toggleInventoryAction.Enable();
    private void OnDisable() => toggleInventoryAction.Disable();

    private void Start()
    {
        networkManager = NetworkManager.Instance ?? FindAnyObjectByType<NetworkManager>();
        if (networkManager == null)
        {
            Debug.LogError("❌ NetworkManager não encontrado!");
            return;
        }

        // 🔥 Mantém os eventos para compatibilidade (opcional)
        networkManager.OnInventoryReceived += HandleInventoryEvent;
        networkManager.OnItemUsed += HandleItemUsed;

        if (inventoryPanel == null)
        {
            Debug.LogError("❌ InventoryPanel não atribuído no Inspector!");
            return;
        }

        isInventoryOpen = false;
        inventoryPanel.SetActive(false);
    }

    // =========================
    // CONTROLE DO PAINEL
    // =========================

    private void ToggleInventory()
    {
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
        items = newItems;
        if (isInventoryOpen)
            RefreshUI();
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
            goldText.text = $"{currentGold} gold";

        foreach (var slot in slotObjects)
            Destroy(slot);
        slotObjects.Clear();

        foreach (var kvp in items)
        {
            GameObject slot = Instantiate(slotPrefab, slotsGrid);
            InventorySlot slotScript = slot.GetComponent<InventorySlot>();
            if (slotScript != null)
            {
                slotScript.Setup(kvp.Key, kvp.Value, networkManager);
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
        Debug.Log($"[InventoryUI] Duplo clique em {itemId} → tentando equipar.");
        NetworkManager.Instance.SendEquipItem(itemId);
    }

    // =========================
    // LIMPEZA
    // =========================

    private void OnDestroy()
    {
        if (networkManager != null)
        {
            networkManager.OnInventoryReceived -= HandleInventoryEvent;
            networkManager.OnItemUsed -= HandleItemUsedEvent;
        }
        if (toggleInventoryAction != null)
        {
            toggleInventoryAction.performed -= ctx => ToggleInventory();
            toggleInventoryAction.Dispose();
        }
    }
}