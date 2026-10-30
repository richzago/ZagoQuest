using UnityEngine;
using UnityEngine.UI;
using TMPro;
using ZagoQuest.Networking.Messages; // ← ADICIONADO

public class ShopItemSlot : MonoBehaviour
{
    [Header("UI References")]
    public TextMeshProUGUI itemNameText;
    public TextMeshProUGUI priceText;
    public TextMeshProUGUI stockText;
    public Button buyButton;

    private string npcId;
    private ShopItem item; // ← agora é do namespace Messages
    private NetworkManager networkManager;

    public void Setup(string npcId, ShopItem item, NetworkManager networkManager)
    {
        this.npcId = npcId;
        this.item = item;
        this.networkManager = networkManager;

        if (itemNameText != null)
            itemNameText.text = item.name;
        if (priceText != null)
            priceText.text = $"{item.price} gold";
        if (stockText != null)
            // Contrato do servidor: -1 significa estoque ilimitado,
            // 0 significa esgotado e valores positivos são a quantidade disponível.
            stockText.text = item.stock < 0 ? "Estoque ilimitado"
                : item.stock == 0 ? "Esgotado" : $"Estoque: {item.stock}";

        if (buyButton != null)
        {
            buyButton.onClick.RemoveAllListeners();
            buyButton.onClick.AddListener(BuyItem);
            buyButton.interactable = item.stock != 0;
        }
    }

    private void BuyItem()
    {
        if (networkManager != null && !string.IsNullOrEmpty(npcId))
        {
            networkManager.Shop.SendBuyItem(npcId, item.itemId, 1);
        }
    }
}