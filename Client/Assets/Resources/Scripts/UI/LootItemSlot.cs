using UnityEngine;
using UnityEngine.UI;
using TMPro;
using UnityEngine.EventSystems;
using ZagoQuest.Networking.Messages;

public class LootItemSlot : MonoBehaviour, IPointerClickHandler
{
    [Header("UI References")]
    public TextMeshProUGUI itemNameText;
    public TextMeshProUGUI amountText;

    private LootItem item;
    private int index;
    private System.Action<int> onItemClick;

    public void Setup(LootItem item, int index, System.Action<int> onItemClick)
    {
        this.item = item;
        this.index = index;
        this.onItemClick = onItemClick;

        if (itemNameText != null)
            itemNameText.text = item.itemName;
        if (amountText != null)
            amountText.text = $"{item.amount}x";
    }

    // =========================
    // CLIQUE
    // =========================

    public void OnPointerClick(PointerEventData eventData)
    {
        if (eventData.clickCount == 2) // Duplo clique
        {
            Debug.Log($"[LootItemSlot] Duplo clique em {item.itemName} (índice {index})");
            onItemClick?.Invoke(index);
        }
    }
}