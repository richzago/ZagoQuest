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
        if (Instance != null && Instance != this)
        {
            Destroy(gameObject);
            return;
        }
        Instance = this;
    }

    private void Start()
    {
        WorldWindowLayout.PreparePanel(shopPanel, 500f, 370f);
        WorldWindowLayout.MakeDraggable(shopPanel, "COMERCIANTE", "shop");
        WorldWindowLayout.PrepareList(itemsContainer);
        var scrollView = itemsContainer != null
            ? itemsContainer.GetComponentInParent<ScrollRect>() : null;
        if (scrollView != null)
        {
            WorldWindowLayout.Place(scrollView.GetComponent<RectTransform>(),
                0.04f, 0.06f, 0.96f, 0.84f);
            if (scrollView.viewport != null)
                WorldWindowLayout.Place(scrollView.viewport, 0f, 0f, 0.95f, 1f);
            if (scrollView.horizontalScrollbar != null)
                scrollView.horizontalScrollbar.gameObject.SetActive(false);
            scrollView.horizontalScrollbar = null;
        }
        WorldWindowLayout.StyleButton(closeButton);
        networkManager = NetworkManager.Instance;
        if (networkManager == null)
        {
            Debug.LogWarning("ShopUI: NetworkManager ainda não encontrado (será consultado ao comprar).");
        }


        if (closeButton != null)
            closeButton.onClick.AddListener(CloseShop);
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
        if (items == null)
        {
            Debug.LogWarning("[ShopUI] Catálogo nulo recebido; ignorando payload inválido.");
            return;
        }

        if (string.IsNullOrEmpty(npcId) || shopItemPrefab == null || itemsContainer == null)
        {
            Debug.LogError("[ShopUI] Dados ou referências do Inspector ausentes.");
            return;
        }
        currentNpcId = npcId;
        networkManager = NetworkManager.Instance;

        foreach (var slot in itemSlots)
        {
            if (slot != null) { slot.SetActive(false); Destroy(slot); }
        }
        itemSlots.Clear();

        // Catálogo válido porém vazio não deve deixar a loja antiga visível.
        // Estado vazio é apresentação; preços e disponibilidade vêm do Node.
        if (items.Length == 0)
        {
            var row = new GameObject("C6ShopEmptyState", typeof(RectTransform),
                typeof(Image), typeof(LayoutElement));
            row.transform.SetParent(itemsContainer, false);
            WorldWindowLayout.PrepareRow(row, 60f, false);
            var labelObject = new GameObject("Label", typeof(RectTransform), typeof(TextMeshProUGUI));
            labelObject.transform.SetParent(row.transform, false);
            var label = labelObject.GetComponent<TextMeshProUGUI>();
            label.text = "Nenhum item disponível nesta loja.";
            WorldWindowLayout.Place(label, 0.04f, 0.05f, 0.96f, 0.95f,
                17, WorldWindowLayout.Muted);
            itemSlots.Add(row);
        }

        for (int i = 0; i < items.Length; i++)
        {
            var item = items[i];
            GameObject slot = Instantiate(shopItemPrefab, itemsContainer, false);
            WorldWindowLayout.PrepareRow(slot, 76f, i % 2 == 1);
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
            var scroll = itemsContainer.GetComponentInParent<ScrollRect>();
            if (scroll != null) scroll.verticalNormalizedPosition = 1f;
            Canvas.ForceUpdateCanvases();
            Debug.Log("ShopUI: ShopPanel ativado.");
        }
    }

    public void ShowBuyResult(bool success, string message)
    {
        ChatUI.Instance?.AddMessage($"Loja: {message}");
    }

    public void ShowSellResult(bool success, string message)
    {
        ChatUI.Instance?.AddMessage($"Loja: {message}");
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
            NetworkManager.Instance?.Shop?.SendCloseShop(currentNpcId);

        currentNpcId = null;
        if (shopPanel != null)
            shopPanel.SetActive(false);
    }

    // =========================
    // LIMPEZA
    // =========================

    private void OnDestroy()
    {
        if (closeButton != null) closeButton.onClick.RemoveListener(CloseShop);
        if (Instance == this) Instance = null;
    }
}