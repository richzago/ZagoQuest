using UnityEngine;
using UnityEngine.UI;
using TMPro;
using System.Collections.Generic;

public class ShopUI : MonoBehaviour
{
    [Header("References")]
    public GameObject shopPanel;
    public Transform itemsContainer;
    public GameObject shopItemPrefab;
    public Button closeButton;

    private NetworkManager networkManager;
    private List<GameObject> itemSlots = new List<GameObject>();
    private string currentNpcId;

    void Start()
    {
        networkManager = NetworkManager.Instance;
        if (networkManager == null)
        {
            Debug.LogError("ShopUI: NetworkManager não encontrado!");
            return;
        }

        networkManager.OnShopWindow += ShowShop;
        if (closeButton != null)
            closeButton.onClick.AddListener(() => CloseShop());
        else
            Debug.LogWarning("ShopUI: closeButton não atribuído!");

        if (shopPanel != null)
            shopPanel.SetActive(false);
        else
            Debug.LogError("ShopUI: shopPanel não atribuído!");
    }

    private void ShowShop(string npcId, NetworkManager.ShopItem[] items)
    {
        Debug.Log($"ShopUI.ShowShop chamado! npcId={npcId}, itens={items?.Length}");
        if (items == null || items.Length == 0)
        {
            Debug.LogWarning("ShopUI: Nenhum item recebido, loja não será aberta.");
            return;
        }

        currentNpcId = npcId;

        // Limpa slots antigos
        foreach (var slot in itemSlots)
            Destroy(slot);
        itemSlots.Clear();

        // Cria novos slots
        foreach (var item in items)
        {
            if (shopItemPrefab == null) { Debug.LogError("ShopUI: shopItemPrefab não atribuído!"); return; }
            if (itemsContainer == null) { Debug.LogError("ShopUI: itemsContainer não atribuído!"); return; }

            GameObject slot = Instantiate(shopItemPrefab, itemsContainer);
            ShopItemSlot slotScript = slot.GetComponent<ShopItemSlot>();
            if (slotScript != null)
                slotScript.Setup(currentNpcId, item, networkManager);
            else
                Debug.LogError("ShopUI: ShopItemSlot não encontrado no prefab!");

            itemSlots.Add(slot);
        }

        if (shopPanel != null)
        {
            shopPanel.SetActive(true);
            Debug.Log("ShopUI: ShopPanel ativado.");
        }
    }

    private void CloseShop()
    {
        if (shopPanel != null)
            shopPanel.SetActive(false);
    }

    private void OnDestroy()
    {
        if (networkManager != null)
            networkManager.OnShopWindow -= ShowShop;
    }
}