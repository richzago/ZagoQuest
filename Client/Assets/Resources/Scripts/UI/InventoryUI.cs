using UnityEngine;
using UnityEngine.UI;
using TMPro;
using System.Collections.Generic;
using UnityEngine.InputSystem;

public class InventoryUI : MonoBehaviour
{
    [Header("UI References")]
    public GameObject slotPrefab;          // Prefab do slot
    public Transform slotsGrid;            // Objeto com GridLayoutGroup (dentro do InventoryPanel)
    public TextMeshProUGUI goldText;       // Texto do gold (dentro do InventoryPanel)
    public GameObject inventoryPanel;      // O painel que será aberto/fechado

    private NetworkManager networkManager;
    private Dictionary<string, int> items = new Dictionary<string, int>();
    private int currentGold = 0;
    private List<GameObject> slotObjects = new List<GameObject>();

    private InputAction toggleInventoryAction;
    private bool isInventoryOpen = false;

    void Awake()
    {
        toggleInventoryAction = new InputAction("ToggleInventory", binding: "<Keyboard>/i");
        toggleInventoryAction.performed += ctx =>
        {
            // Se existe um EventSystem e o objeto selecionado é um InputField (TMP), não abre o inventário
            if (UnityEngine.EventSystems.EventSystem.current != null)
            {
                var selected = UnityEngine.EventSystems.EventSystem.current.currentSelectedGameObject;
                if (selected != null && selected.GetComponent<TMPro.TMP_InputField>() != null)
                    return;
            }
            ToggleInventory();
        };
    }

    void OnEnable()
    {
        toggleInventoryAction.Enable();
    }

    void OnDisable()
    {
        toggleInventoryAction.Disable();
    }

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

        // Garante que o painel comece fechado
        isInventoryOpen = false;
        inventoryPanel.SetActive(false);
    }

    // NÃO TEM MÉTODO Update() – a detecção da tecla é feita via InputAction

    private void ToggleInventory()
    {
        // Debug.Log($"[INVENTORY] ToggleInventory chamado. Painel ativo antes: {inventoryPanel.activeSelf}");
        isInventoryOpen = !isInventoryOpen;
        inventoryPanel.SetActive(isInventoryOpen);
        // Debug.Log($"📦 Inventário {(isInventoryOpen ? "ABERTO" : "FECHADO")}");

        if (isInventoryOpen)
            RefreshUI();
    }

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
                slotScript.Setup(kvp.Key, kvp.Value, networkManager);
            slotObjects.Add(slot);
        }
    }

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