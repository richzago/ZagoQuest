using TMPro;
using UnityEngine;
using UnityEngine.UI;
using ZagoQuest.Networking.Messages;

/// <summary>Uma linha de mercadoria, com quantidade e botão responsivo.</summary>
public class ShopItemSlot : MonoBehaviour
{
    [Header("UI References")]
    public TextMeshProUGUI itemNameText;
    public TextMeshProUGUI priceText;
    public TextMeshProUGUI stockText;
    public Button buyButton;

    private string npcId;
    private ShopItem item;
    private NetworkManager networkManager;
    private TMP_InputField amountInput;

    public void Setup(string id, ShopItem shopItem, NetworkManager manager)
    {
        npcId = id;
        item = shopItem;
        networkManager = manager;
        amountInput = GetComponentInChildren<TMP_InputField>(true);

        if (itemNameText != null)
        {
            itemNameText.text = item.name;
            WorldWindowLayout.Place(itemNameText, 0.04f, 0.44f, 0.53f, 0.96f,
                17, WorldWindowLayout.Label);
        }
        if (priceText != null)
        {
            priceText.text = item.price + " gold";
            WorldWindowLayout.Place(priceText, 0.04f, 0.03f, 0.38f, 0.43f,
                14, WorldWindowLayout.Gold);
        }
        if (stockText != null)
        {
            stockText.text = item.stock < 0 ? "Estoque ilimitado" :
                item.stock == 0 ? "Esgotado" : "Estoque: " + item.stock;
            WorldWindowLayout.Place(stockText, 0.39f, 0.03f, 0.67f, 0.43f,
                13, WorldWindowLayout.Muted);
        }

        if (amountInput != null)
        {
            amountInput.contentType = TMP_InputField.ContentType.IntegerNumber;
            amountInput.text = "1";
            WorldWindowLayout.Place(amountInput.GetComponent<RectTransform>(),
                0.68f, 0.23f, 0.79f, 0.77f);
            if (amountInput.textComponent != null)
                amountInput.textComponent.raycastTarget = false;
        }

        if (buyButton != null)
        {
            WorldWindowLayout.Place(buyButton.GetComponent<RectTransform>(),
                0.81f, 0.18f, 0.98f, 0.82f);
            WorldWindowLayout.StyleButton(buyButton);
            buyButton.onClick.RemoveListener(BuyItem);
            buyButton.onClick.AddListener(BuyItem);
            buyButton.interactable = item.stock != 0;
        }
    }

    private void BuyItem()
    {
        var network = NetworkManager.Instance;
        if (network == null || !network.isConnected || network.Shop == null ||
            string.IsNullOrEmpty(npcId)) return;

        int quantity = 1;
        if (amountInput != null &&
            (!int.TryParse(amountInput.text, out quantity) || quantity <= 0))
        {
            ChatUI.Instance?.AddMessage("Loja: informe uma quantidade válida.");
            return;
        }
        if (item.stock >= 0 && quantity > item.stock)
        {
            ChatUI.Instance?.AddMessage("Loja: quantidade acima do estoque.");
            return;
        }
        network.Shop.SendBuyItem(npcId, item.itemId, quantity);
    }

    private void OnDestroy()
    {
        if (buyButton != null) buyButton.onClick.RemoveListener(BuyItem);
    }
}
