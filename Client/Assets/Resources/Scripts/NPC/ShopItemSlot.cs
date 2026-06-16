using UnityEngine;
using UnityEngine.UI;
using TMPro;

public class ShopItemSlot : MonoBehaviour
{
    [Header("UI Components")]
    public TextMeshProUGUI itemNameText;
    public TextMeshProUGUI priceText;
    public TextMeshProUGUI stockText;
    public TMP_InputField amountInput;
    public Button buyButton;

    private string npcId;
    private NetworkManager.ShopItem item;
    private NetworkManager networkManager;

    public void Setup(string npcId, NetworkManager.ShopItem shopItem, NetworkManager nm)
    {
        this.npcId = npcId;
        this.item = shopItem;
        this.networkManager = nm;

        // Verifica se os componentes foram atribuídos no prefab
        if (itemNameText == null) Debug.LogError("ShopItemSlot: itemNameText não atribuído!");
        if (priceText == null) Debug.LogError("ShopItemSlot: priceText não atribuído!");
        if (stockText == null) Debug.LogError("ShopItemSlot: stockText não atribuído!");
        if (amountInput == null) Debug.LogError("ShopItemSlot: amountInput não atribuído!");
        if (buyButton == null) Debug.LogError("ShopItemSlot: buyButton não atribuído!");

        if (itemNameText != null)
            itemNameText.text = shopItem.name;
        if (priceText != null)
            priceText.text = $"{shopItem.price} gold";
        if (stockText != null)
            stockText.text = shopItem.stock > 0 ? $"Estoque: {shopItem.stock}" : "Ilimitado";

        if (buyButton != null)
        {
            buyButton.onClick.RemoveAllListeners();
            buyButton.onClick.AddListener(() =>
            {
                int amount = 1;
                if (amountInput != null && int.TryParse(amountInput.text, out int parsed) && parsed > 0)
                    amount = parsed;
                networkManager?.SendBuyItem(npcId, item.itemId, amount);
            });
        }
    }
}