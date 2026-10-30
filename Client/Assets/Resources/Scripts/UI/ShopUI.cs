using UnityEngine;
using UnityEngine.UI;
using TMPro;
using System.Collections.Generic;
using ZagoQuest.Networking.Messages;

public class ShopUI : MonoBehaviour
{
    public static ShopUI Instance { get; private set; }

    [Header("References")]
    public GameObject shopPanel;
    public Transform itemsContainer;
    public GameObject shopItemPrefab;
    public Button closeButton;

    private NetworkManager networkManager;
    private List<GameObject> itemSlots = new List<GameObject>();
    private string currentNpcId;

    // =========================
    // CICLO DE VIDA
    // =========================

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
            Debug.LogError("ShopUI: NetworkManager não encontrado!");
            return;
        }


        if (closeButton != null)
            closeButton.onClick.AddListener(() => CloseShop());
        else
            Debug.LogWarning("ShopUI: closeButton não atribuído!");

        if (shopPanel != null)
            shopPanel.SetActive(false);
        else
            Debug.LogError("ShopUI: shopPanel não atribuído!");
    }

    // =========================
    // MÉTODOS PÚBLICOS PARA HANDLERS
    // =========================

    public void ShowShopWindow(string npcId, ShopItem[] items)
    {
        Debug.Log($"ShopUI.ShowShopWindow: npcId={npcId}, itens={items?.Length}");
        if (items == null || items.Length == 0)
        {
            Debug.LogWarning("ShopUI: Nenhum item recebido, loja não será aberta.");
            return;
        }

        currentNpcId = npcId;

        foreach (var slot in itemSlots)
            Destroy(slot);
        itemSlots.Clear();

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

    public void ShowBuyResult(bool success, string message)
    {
        if (ChatUI.Instance != null)
            ChatUI.Instance.AddMessage($"Loja: {message}");
    }

    // =========================
    // EVENTOS DO NETWORK (mantido para compatibilidade)
    // =========================

    private void ShowShopEvent(string npcId, ShopItem[] items) // ← agora usa ShopItem diretamente
    {
        ShowShopWindow(npcId, items);
    }

    private void ShowBuyResultEvent(bool success, string message)
    {
        ShowBuyResult(success, message);
    }

    // =========================
    // FECHAR LOJA
    // =========================

    private void CloseShop()
    {
        // Um fechamento atrasado carrega o ID desta janela (não o NPC atual
        // escolhido pelo servidor). Isso protege a sessão de outro serviço.
        if (shopPanel != null && shopPanel.activeSelf && !string.IsNullOrEmpty(currentNpcId))
            networkManager?.Shop?.SendCloseShop(currentNpcId);

        currentNpcId = null;
        if (shopPanel != null)
            shopPanel.SetActive(false);
    }

    // =========================
    // LIMPEZA
    // =========================

    private void OnDestroy()
    {

    }
}