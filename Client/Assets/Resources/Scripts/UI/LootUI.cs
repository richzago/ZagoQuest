using UnityEngine;
using UnityEngine.UI;
using TMPro;

public class LootUI : MonoBehaviour
{
    public static LootUI Instance;

    public GameObject lootPanel;
    public Transform itemContainer;
    public GameObject itemButtonPrefab;
    public Button takeAllButton;

    private string currentCorpseId;

    void Awake()
    {
        if (Instance == null) Instance = this;
        else Destroy(gameObject);
    }

    void Start()
    {
        if (lootPanel != null) lootPanel.SetActive(false);
        if (takeAllButton != null) takeAllButton.onClick.AddListener(() => TakeAll());
    }

    public void ShowLootWindow(string corpseId, NetworkManager.LootItem[] items)
    {
        Debug.Log($"LootPanel ativo? {lootPanel.activeSelf}. Posição: {lootPanel.transform.position}");
        currentCorpseId = corpseId;
        foreach (Transform child in itemContainer) Destroy(child.gameObject);

        if (items == null || items.Length == 0)
        {
            CloseLootWindow();
            return;
        }

        for (int i = 0; i < items.Length; i++)
        {
            int idx = i;
            GameObject btn = Instantiate(itemButtonPrefab, itemContainer);
            var text = btn.GetComponentInChildren<TMP_Text>();
            if (text) text.text = $"{items[i].itemId} x{items[i].amount}";
            btn.GetComponent<Button>().onClick.AddListener(() => TakeItem(idx));
        }
        lootPanel.SetActive(true);
    }

    public void CloseLootWindow()
    {
        currentCorpseId = null;
        lootPanel.SetActive(false);
    }

    public void TakeAll()
    {
        if (!string.IsNullOrEmpty(currentCorpseId))
            NetworkManager.Instance.SendTakeLoot(currentCorpseId, true);
        CloseLootWindow();
    }

    private void TakeItem(int index)
    {
        if (!string.IsNullOrEmpty(currentCorpseId))
            NetworkManager.Instance.SendTakeLoot(currentCorpseId, false, index);
    }
}