using UnityEngine;
using UnityEngine.UI;
using TMPro;
using System.Collections.Generic;
using ZagoQuest.Networking.Messages;

public class LootUI : MonoBehaviour
{
    public static LootUI Instance { get; private set; }

    [Header("References")]
    public GameObject lootPanel;
    public Transform itemsContainer;
    public GameObject lootItemPrefab;  // ← prefab com Image + TextMeshProUGUI (sem button)
    public Button closeButton;
    public Button takeAllButton;

    private NetworkManager networkManager;
    private string currentCorpseId;
    private List<GameObject> itemSlots = new List<GameObject>();

    private void Awake()
    {
        if (Instance == null)
            Instance = this;
        else
            Destroy(gameObject);
    }

    private void Start()
    {
        networkManager = NetworkManager.Instance;
        if (networkManager == null)
        {
            Debug.LogError("LootUI: NetworkManager não encontrado!");
            return;
        }

        if (closeButton != null)
            closeButton.onClick.AddListener(CloseLootWindow);
        if (takeAllButton != null)
            takeAllButton.onClick.AddListener(TakeAllLoot);
        if (lootPanel != null)
            lootPanel.SetActive(false);
    }

    public void ShowLootWindow(string corpseId, LootItem[] items)
    {
        Debug.Log($"[LootUI] ShowLootWindow: corpseId={corpseId}, items={items?.Length}");
        if (items == null || items.Length == 0)
        {
            Debug.LogWarning("[LootUI] Nenhum item recebido.");
            return;
        }

        currentCorpseId = corpseId;

        foreach (var slot in itemSlots)
            Destroy(slot);
        itemSlots.Clear();

        for (int i = 0; i < items.Length; i++)
        {
            var item = items[i];
            GameObject slot = Instantiate(lootItemPrefab, itemsContainer);

            // 🔥 Busca o componente LootItemSlot
            LootItemSlot slotScript = slot.GetComponent<LootItemSlot>();
            if (slotScript != null)
            {
                slotScript.Setup(item, i, OnItemClicked); // ← passa callback
                Debug.Log($"[LootUI] Slot {i} configurado: {item.itemName} x{item.amount}");
            }
            else
            {
                Debug.LogError("[LootUI] LootItemSlot não encontrado no prefab!");
            }
            itemSlots.Add(slot);
        }

        lootPanel.SetActive(true);
    }

    public void CloseLootWindow()
    {
        if (lootPanel != null)
            lootPanel.SetActive(false);
    }

    private void TakeAllLoot()
    {
        if (!string.IsNullOrEmpty(currentCorpseId))
            networkManager.Inventory.SendTakeLoot(currentCorpseId, true);
    }

    // =========================
    // CALLBACK DO CLIQUE NO ITEM (duplo clique)
    // =========================

    private void OnItemClicked(int index)
    {
        if (!string.IsNullOrEmpty(currentCorpseId))
        {
            Debug.Log($"[LootUI] Pegando item {index} do corpse {currentCorpseId}");
            networkManager.Inventory.SendTakeLoot(currentCorpseId, false, index);

        }
    }

    private void OnDestroy()
    {
        if (closeButton != null)
            closeButton.onClick.RemoveListener(CloseLootWindow);
        if (takeAllButton != null)
            takeAllButton.onClick.RemoveListener(TakeAllLoot);
    }
}