using UnityEngine;
using UnityEngine.UI;
using TMPro;
using System.Collections.Generic;
using System.Linq;
using UnityEngine.InputSystem;

public class InventoryUI : MonoBehaviour
{
    [Header("UI References")]
    public GameObject slotPrefab;          // Prefab do slot (com InventorySlot)
    public Transform slotsGrid;            // Objeto com GridLayoutGroup
    public TextMeshProUGUI goldText;       // Texto do gold
    public GameObject inventoryPanel;      // O painel que será aberto/fechado

    private NetworkManager networkManager;
    private Dictionary<string, int> items = new Dictionary<string, int>();
    private int currentGold = 0;
    private List<GameObject> slotObjects = new List<GameObject>();

    private InputAction toggleInventoryAction;
    private bool isInventoryOpen = false;

    // =========================
    // CICLO DE VIDA
    // =========================

    void Awake()
    {
        // Configura a tecla 'I' para abrir/fechar o inventário
        toggleInventoryAction = new InputAction("ToggleInventory", binding: "<Keyboard>/i");
        toggleInventoryAction.performed += ctx =>
        {
            // Se houver um input field selecionado (ex: chat), não abre o inventário
            if (UnityEngine.EventSystems.EventSystem.current != null)
            {
                var selected = UnityEngine.EventSystems.EventSystem.current.currentSelectedGameObject;
                if (selected != null && selected.GetComponent<TMPro.TMP_InputField>() != null)
                    return;
            }
            ToggleInventory();
        };
    }

    void OnEnable() => toggleInventoryAction.Enable();
    void OnDisable() => toggleInventoryAction.Disable();

    void Start()
    {
        networkManager = NetworkManager.Instance ?? FindAnyObjectByType<NetworkManager>();
        if (networkManager == null)
        {
            Debug.LogError("❌ NetworkManager não encontrado!");
            return;
        }

        networkManager.OnInventoryReceived += HandleInventory;
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
    // EVENTOS DO NETWORK
    // =========================

    private void HandleInventory(int gold, Dictionary<string, int> newItems)
    {
        currentGold = gold;
        items = newItems;
        if (isInventoryOpen)
            RefreshUI();
    }

    private void HandleItemUsed(string itemId, bool success, string message)
    {
        if (ChatUI.Instance != null)
            ChatUI.Instance.AddMessage($"Item: {message}");
    }

    // =========================
    // REFRESH DA UI
    // =========================

    private void RefreshUI()
    {
        if (goldText != null)
            goldText.text = $"{currentGold} gold";

        // Remove slots antigos
        foreach (var slot in slotObjects)
            Destroy(slot);
        slotObjects.Clear();

        // Cria novos slots
        foreach (var kvp in items)
        {
            GameObject slot = Instantiate(slotPrefab, slotsGrid);
            InventorySlot slotScript = slot.GetComponent<InventorySlot>();
            if (slotScript != null)
            {
                slotScript.Setup(kvp.Key, kvp.Value, networkManager);
                // Assina o evento de duplo clique do slot
                slotScript.OnDoubleClick += OnSlotDoubleClicked;
            }
            slotObjects.Add(slot);
        }
    }

    // =========================
    // INTERAÇÃO COM ITENS
    // =========================

    /// <summary>
    /// Chamado quando um slot é clicado duas vezes.
    /// Tenta equipar o item (se for equipável).
    /// </summary>
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
            networkManager.OnInventoryReceived -= HandleInventory;
            networkManager.OnItemUsed -= HandleItemUsed;
        }
        if (toggleInventoryAction != null)
        {
            toggleInventoryAction.performed -= ctx => ToggleInventory();
            toggleInventoryAction.Dispose();
        }
    }
}