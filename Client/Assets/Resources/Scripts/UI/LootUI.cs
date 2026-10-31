using System.Collections.Generic;
using TMPro;
using UnityEngine;
using UnityEngine.UI;
using ZagoQuest.Networking.Messages;

/// <summary>
/// Loot do cadáver. Cada item é clicável e a remoção é confirmada pelo Node
/// (lootTaken), nunca presumida no cliente. A lista usa layout/scroll dinâmico.
/// </summary>
public class LootUI : MonoBehaviour
{
    public static LootUI Instance { get; private set; }

    [Header("References")]
    public GameObject lootPanel;
    public Transform itemsContainer;
    public GameObject lootItemPrefab;
    public Button closeButton;
    public Button takeAllButton;

    private string currentCorpseId;
    private readonly List<LootItem> visibleItems = new List<LootItem>();
    private readonly List<GameObject> itemSlots = new List<GameObject>();
    private bool awaitingServer;

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
        // LootPanel da cena é um root transparente fora do centro da tela.
        // Não deve bloquear cliques do mundo quando PanelVisual está oculto.
        var rootRaycaster = GetComponent<Image>();
        if (rootRaycaster != null) rootRaycaster.raycastTarget = false;
        var root = transform as RectTransform;
        if (root != null)
        {
            root.anchorMin = root.anchorMax = new Vector2(0.5f, 0.5f);
            root.pivot = new Vector2(0.5f, 0.5f);
            root.anchoredPosition = new Vector2(185f, 0f);
            root.sizeDelta = new Vector2(520f, 390f);
        }
        WorldWindowLayout.PrepareList(itemsContainer);
        var scrollView = itemsContainer != null
            ? itemsContainer.GetComponentInParent<ScrollRect>() : null;
        if (scrollView != null)
        {
            // O ItemContainer estava fixado em 606x326 dentro de um painel
            // menor, com Viewport de tamanho ZERO. Corrigir sem editar YAML.
            WorldWindowLayout.Place(scrollView.GetComponent<RectTransform>(),
                0.04f, 0.21f, 0.96f, 0.86f);
            if (scrollView.viewport != null)
                WorldWindowLayout.Place(scrollView.viewport, 0f, 0f, 0.95f, 1f);
            if (scrollView.horizontalScrollbar != null)
                scrollView.horizontalScrollbar.gameObject.SetActive(false);
            scrollView.horizontalScrollbar = null;
        }
        if (takeAllButton != null)
            WorldWindowLayout.Place(takeAllButton.GetComponent<RectTransform>(),
                0.64f, 0.04f, 0.95f, 0.17f);
        // Na cena versionada o botão X existe como LootPanel/Button, mas
        // closeButton está sem referência (fileID 0) no Inspector.
        if (closeButton == null)
        {
            var closeTransform = transform.Find("Button");
            if (closeTransform != null)
                closeButton = closeTransform.GetComponent<Button>();
        }
        if (closeButton != null)
        {
            var closeRect = closeButton.GetComponent<RectTransform>();
            if (closeRect != null)
            {
                closeRect.anchorMin = closeRect.anchorMax = new Vector2(1f, 1f);
                closeRect.pivot = new Vector2(1f, 1f);
                closeRect.anchoredPosition = new Vector2(-12f, -12f);
                closeRect.sizeDelta = new Vector2(34f, 34f);
            }
        }
        var background = lootPanel != null ? lootPanel.GetComponent<Image>() : null;
        if (background != null) background.color = WorldWindowLayout.Background;
        WorldWindowLayout.StyleButton(closeButton);
        WorldWindowLayout.StyleButton(takeAllButton);
        if (closeButton != null) closeButton.onClick.AddListener(CloseLootWindow);
        if (takeAllButton != null) takeAllButton.onClick.AddListener(TakeAllLoot);
        if (lootPanel != null) lootPanel.SetActive(false);
    }

    public void ShowLootWindow(string corpseId, LootItem[] items)
    {
        if (string.IsNullOrEmpty(corpseId)) return;
        currentCorpseId = corpseId;
        awaitingServer = false;
        visibleItems.Clear();
        if (items != null) visibleItems.AddRange(items);
        RebuildRows();
        if (lootPanel != null) lootPanel.SetActive(true);
    }

    private void RebuildRows()
    {
        foreach (var slot in itemSlots)
            if (slot != null) Destroy(slot);
        itemSlots.Clear();

        if (itemsContainer == null || lootItemPrefab == null)
        {
            Debug.LogError("[LootUI] ItemsContainer ou LootItemPrefab não configurado no Inspector.");
            return;
        }

        for (int i = 0; i < visibleItems.Count; i++)
        {
            GameObject slot = Instantiate(lootItemPrefab, itemsContainer, false);
            WorldWindowLayout.PrepareRow(slot, 56f, i % 2 == 1);
            var row = slot.GetComponent<LootItemSlot>();
            if (row != null)
                row.Setup(visibleItems[i], i, OnItemClicked);
            else
                Debug.LogError("[LootUI] Prefab sem LootItemSlot.");
            itemSlots.Add(slot);
        }

        var scroll = itemsContainer.GetComponentInParent<ScrollRect>();
        if (scroll != null) scroll.verticalNormalizedPosition = 1f;
        if (takeAllButton != null) takeAllButton.interactable = visibleItems.Count > 0 && !awaitingServer;
        Canvas.ForceUpdateCanvases();
    }

    private bool ReadyToTake()
    {
        var net = NetworkManager.Instance;
        return !awaitingServer && !string.IsNullOrEmpty(currentCorpseId)
            && net != null && net.isConnected && net.Inventory != null;
    }

    private void TakeAllLoot()
    {
        if (!ReadyToTake() || visibleItems.Count == 0) return;
        awaitingServer = true;
        if (takeAllButton != null) takeAllButton.interactable = false;
        NetworkManager.Instance.Inventory.SendTakeLoot(currentCorpseId, true);
    }

    private void OnItemClicked(int index)
    {
        if (!ReadyToTake() || index < 0 || index >= visibleItems.Count) return;
        awaitingServer = true;
        if (takeAllButton != null) takeAllButton.interactable = false;
        NetworkManager.Instance.Inventory.SendTakeLoot(currentCorpseId, false, index);
    }

    /// <summary>
    /// O Node envia lootTaken com itemIndex para item individual ou sem
    /// itemIndex para takeAll. Não fechar a janela após pegar um item:
    /// o próximo índice muda quando um elemento é removido.
    /// </summary>
    public void OnLootTaken(string corpseId, int? itemIndex)
    {
        if (corpseId != currentCorpseId) return; // ACK tardio de outro cadáver
        awaitingServer = false;
        if (!itemIndex.HasValue)
        {
            CloseLootWindow();
            return;
        }
        if (itemIndex.Value < 0 || itemIndex.Value >= visibleItems.Count)
        {
            // Índice fora do snapshot: pedir o estado autoritativo atualizado.
            NetworkManager.Instance?.Inventory?.SendLoot(corpseId);
            return;
        }
        visibleItems.RemoveAt(itemIndex.Value);
        if (visibleItems.Count == 0)
        {
            CloseLootWindow();
            return;
        }
        RebuildRows();
    }

    public void OnLootError(string message)
    {
        awaitingServer = false;
        if (takeAllButton != null) takeAllButton.interactable = visibleItems.Count > 0;
        Debug.LogWarning("[LootUI] " + message);
        ChatUI.Instance?.AddMessage("Loot: " + message);
    }

    public void CloseLootWindow()
    {
        currentCorpseId = null;
        awaitingServer = false;
        visibleItems.Clear();
        if (lootPanel != null) lootPanel.SetActive(false);
    }

    private void OnDestroy()
    {
        if (closeButton != null) closeButton.onClick.RemoveListener(CloseLootWindow);
        if (takeAllButton != null) takeAllButton.onClick.RemoveListener(TakeAllLoot);
        if (Instance == this) Instance = null;
    }
}
