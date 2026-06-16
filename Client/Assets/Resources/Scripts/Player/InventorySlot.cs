using UnityEngine;
using UnityEngine.UI;
using TMPro;

public class InventorySlot : MonoBehaviour
{
    [Header("UI Components")]
    public Image iconImage;               // Opcional: imagem do item
    public TextMeshProUGUI itemNameText;
    public TextMeshProUGUI quantityText;
    public Button useButton;

    private string itemId;
    private int quantity;
    private NetworkManager networkManager;

    public void Setup(string id, int qty, NetworkManager nm)
    {
        itemId = id;
        quantity = qty;
        networkManager = nm;

        // Exibe um nome legível (apenas a parte após a última '/')
        string shortName = id.Contains('/') ? id.Substring(id.LastIndexOf('/') + 1) : id;
        itemNameText.text = shortName;
        quantityText.text = qty.ToString();

        // Se tiver um sistema de ícones, carregue aqui (ex: Resources.Load)
        // Exemplo: Sprite icon = Resources.Load<Sprite>($"Icons/{shortName}");
        // if (icon != null) iconImage.sprite = icon;

        useButton.onClick.RemoveAllListeners();
        useButton.onClick.AddListener(UseItem);
    }

    void UseItem()
    {
        if (networkManager != null)
            networkManager.UseItem(itemId);
    }
}