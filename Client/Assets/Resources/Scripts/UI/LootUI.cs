using UnityEngine;
using UnityEngine.UI;
using TMPro;
using System.Collections.Generic;

public class LootUI : MonoBehaviour
{
    public static LootUI Instance { get; private set; }

    [Header("UI References")]
    public GameObject lootPanel;
    public Transform itemsContainer; // Content do ScrollView
    public GameObject lootItemPrefab; // Prefab do slot de item
    public Button takeAllButton;

    private string currentCorpseId;
    private List<GameObject> itemSlots = new List<GameObject>();

    void Awake()
    {
        if (Instance == null) Instance = this;
        else Destroy(gameObject);
    }

    void Start()
    {
        if (lootPanel != null) lootPanel.SetActive(false);
        if (takeAllButton != null)
            takeAllButton.onClick.AddListener(() =>
            {
                if (!string.IsNullOrEmpty(currentCorpseId))
                    NetworkManager.Instance.SendTakeLoot(currentCorpseId, true);
            });
    }

    public void ShowLootWindow(string corpseId, NetworkManager.LootItem[] items)
    {
        currentCorpseId = corpseId;

        // Limpa slots antigos
        foreach (var slot in itemSlots)
            Destroy(slot);
        itemSlots.Clear();

        // Cria um slot para cada item
        foreach (var item in items)
        {
            GameObject slot = Instantiate(lootItemPrefab, itemsContainer);
            // Configura o slot (nome e quantidade)
            TextMeshProUGUI[] texts = slot.GetComponentsInChildren<TextMeshProUGUI>();
            if (texts.Length >= 2)
            {
                texts[0].text = item.itemName; // nome legível
                texts[1].text = $"x{item.amount}";
            }
            else
            {
                // Fallback: se não tiver dois textos, usa o primeiro para nome + quantidade
                if (texts.Length > 0)
                    texts[0].text = $"{item.itemName} x{item.amount}";
            }

            // Armazena o slot para limpeza futura
            itemSlots.Add(slot);
        }

        // Ativa o painel
        if (lootPanel != null)
            lootPanel.SetActive(true);
    }

    public void CloseLootWindow()
    {
        if (lootPanel != null)
            lootPanel.SetActive(false);
        currentCorpseId = null;
    }
}