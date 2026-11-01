using System.Collections.Generic;
using TMPro;
using UnityEngine.InputSystem;
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
    private const int MaxTrackedCorpses = 4;
    public int VisibleLootItemCount => visibleItems.Count;
    // LRU: o mais recente fica no final; remover o mais antigo da lista
    // NÃO remove cadáver, loot ou itens do servidor.
    private readonly List<string> openedCorpses = new List<string>();
    public int OpenedLootCount => openedCorpses.Count;
    public string CurrentCorpseId => currentCorpseId;
    public bool IsSidebarDocked { get; private set; }
    public bool IsLootOpen => !string.IsNullOrEmpty(currentCorpseId) &&
        lootPanel != null && lootPanel.activeSelf;
    public void SetSidebarDocked(bool docked) => IsSidebarDocked = docked;

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
            root.sizeDelta = new Vector2(450f, 345f);
        }
        WorldWindowLayout.MakeDraggable(gameObject, "LOOT", "loot");
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
        // Pegar Tudo e comando Ctrl+Shift+L; o botão antigo não cobre o loot.
        if (takeAllButton != null) takeAllButton.gameObject.SetActive(false);
        if (lootPanel != null) lootPanel.SetActive(false);
        var dragHeader = transform.Find("C6DragHeader");
        if (dragHeader != null) dragHeader.gameObject.SetActive(false);
        // Na scene o X é irmão de PanelVisual, portanto deve ser ocultado
        // explicitamente quando o loot estiver fechado.
        if (closeButton != null) closeButton.gameObject.SetActive(false);
    }

    public void ShowLootWindow(string corpseId, LootItem[] items)
    {
        if (string.IsNullOrEmpty(corpseId)) return;
        // Nova janela/cadáver ganha o lugar mais recente na sidebar.
        openedCorpses.Remove(corpseId);
        openedCorpses.Add(corpseId);
        if (openedCorpses.Count > MaxTrackedCorpses) openedCorpses.RemoveAt(0);
        currentCorpseId = corpseId;
        awaitingServer = false;
        visibleItems.Clear();
        if (items != null) visibleItems.AddRange(items);
        RebuildRows();
        if (lootPanel != null) lootPanel.SetActive(true);
        var header = transform.Find("C6DragHeader");
        if (header != null && !IsSidebarDocked) header.gameObject.SetActive(true);
        if (closeButton != null && !IsSidebarDocked) closeButton.gameObject.SetActive(true);
        C8SidebarDynamicDock.Instance?.OnLootOpened();
    }

    private void RebuildRows()
    {
        foreach (var slot in itemSlots)
            if (slot != null)
            {
                // Destroy so executa no fim do frame: desativar AGORA para
                // a linha antiga nao interceptar clique ou index de lootTaken.
                slot.SetActive(false);
                Destroy(slot);
            }
        itemSlots.Clear();

        if (itemsContainer == null || lootItemPrefab == null)
        {
            Debug.LogError("[LootUI] ItemsContainer ou LootItemPrefab não configurado no Inspector.");
            return;
        }

        // A janela pode ser aberta com cadáver vazio; sinalizar em vez
        // de deixar uma área sem contexto ou botão TakeAll clicável.
        if (visibleItems.Count == 0)
        {
            var empty = new GameObject("C6LootEmptyState", typeof(RectTransform),
                typeof(Image), typeof(LayoutElement));
            empty.transform.SetParent(itemsContainer, false);
            WorldWindowLayout.PrepareRow(empty, 38f, false);
            var labelObject = new GameObject("Label", typeof(RectTransform), typeof(TextMeshProUGUI));
            labelObject.transform.SetParent(empty.transform, false);
            var label = labelObject.GetComponent<TextMeshProUGUI>();
            label.text = "O cadáver não contém itens.";
            WorldWindowLayout.Place(label, 0.04f, 0.05f, 0.96f, 0.95f,
                17, WorldWindowLayout.Muted);
            itemSlots.Add(empty);
        }

        for (int i = 0; i < visibleItems.Count; i++)
        {
            GameObject slot = Instantiate(lootItemPrefab, itemsContainer, false);
            WorldWindowLayout.PrepareRow(slot, 36f, i % 2 == 1);
            var row = slot.GetComponent<LootItemSlot>();
            if (row != null)
            {
                row.Setup(visibleItems[i], i, OnItemClicked);
                if (IsSidebarDocked) row.CompactForSidebar();
            }
            else
                Debug.LogError("[LootUI] Prefab sem LootItemSlot.");
            itemSlots.Add(slot);
        }

        var scroll = itemsContainer.GetComponentInParent<ScrollRect>();
        if (scroll != null)
        {
            scroll.scrollSensitivity = 10f;
            scroll.inertia = false; // scroll preciso: um movimento nao pula linhas
            scroll.verticalNormalizedPosition = 1f;
        }
        if (takeAllButton != null) takeAllButton.interactable = visibleItems.Count > 0 && !awaitingServer;
        Canvas.ForceUpdateCanvases();
    }

    private bool ReadyToTake()
    {
        var net = NetworkManager.Instance;
        return !awaitingServer && !string.IsNullOrEmpty(currentCorpseId)
            && net != null && net.isConnected && net.Inventory != null;
    }

    private void Update()
    {
        var net = NetworkManager.Instance;
        if (net == null || !net.isConnected)
        {
            if (openedCorpses.Count > 0)
            {
                openedCorpses.Clear();
                currentCorpseId = null;
                awaitingServer = false;
                if (lootPanel != null) lootPanel.SetActive(false);
            }
            return;
        }
        var k = Keyboard.current;
        // Shift+E: mais simples que Ctrl+Shift+L; também há botão discreto
        // no cabeçalho da área. Não dispara ao escrever no chat.
        if (k == null || !IsLootOpen || !k.eKey.wasPressedThisFrame ||
            !(k.leftShiftKey.isPressed || k.rightShiftKey.isPressed)) return;
        var selected = UnityEngine.EventSystems.EventSystem.current?.currentSelectedGameObject;
        if (selected != null && selected.GetComponentInParent<TMP_InputField>() != null) return;
        TakeAllLoot();
    }

    /// <summary>
    /// Soltar uma linha do cadáver no chão NÃO coleta no inventário:
    /// o Node transfere do cadáver diretamente ao tile e confirma com lootTaken.
    /// </summary>
    public void DropItemToWorld(int index, Vector2 screenPosition)
    {
        if (!ReadyToTake() || index < 0 || index >= visibleItems.Count) return;
        var camera = Camera.main;
        var player = PlayerController.Instance;
        if (camera == null || !camera.pixelRect.Contains(screenPosition) ||
            player == null || !player.TryGetConfirmedGridPosition(out Vector2Int tile))
            return;
        var world = camera.ScreenToWorldPoint(
            new Vector3(screenPosition.x, screenPosition.y, 0f));
        int x = Mathf.FloorToInt(world.x), y = Mathf.FloorToInt(world.y);
        long distance = System.Math.Abs((long)x - tile.x) +
                        System.Math.Abs((long)y - tile.y);
        if (distance > 2)
        {
            ChatUI.Instance?.AddMessage("Loot: muito longe para soltar no chão.");
            return;
        }
        awaitingServer = true;
        NetworkManager.Instance.Inventory.SendDropCorpseLoot(currentCorpseId, index, x, y);
    }

    public void TakeByDrop(int index)
    {
        // O servidor valida Bag, capacidade, alcance e índice do cadáver.
        if (InventoryUI.Instance == null || !InventoryUI.Instance.HasEquippedBag)
        {
            ChatUI.Instance?.AddMessage("Equipe uma Bag/Backpack para coletar.");
            return;
        }
        OnItemClicked(index);
    }

    public void NavigateLoot(int direction)
    {
        if (openedCorpses.Count < 2 || string.IsNullOrEmpty(currentCorpseId)) return;
        var net = NetworkManager.Instance;
        if (net == null || !net.isConnected || net.Inventory == null) return;
        int pos = openedCorpses.IndexOf(currentCorpseId);
        int next = (pos + direction + openedCorpses.Count) % openedCorpses.Count;
        if (next == pos) return;
        if (awaitingServer) return;
        awaitingServer = true;
        net.Inventory.SendLoot(openedCorpses[next]);
    }

    public void TakeAllLoot()
    {
        if (!ReadyToTake() || visibleItems.Count == 0) return;
        Debug.Log($"[LootUI] Shift+E / botão TODOS -> takeAll corpse={currentCorpseId}, linhas={visibleItems.Count}");
        awaitingServer = true;
        if (takeAllButton != null) takeAllButton.interactable = false;
        NetworkManager.Instance.Inventory.SendTakeLoot(currentCorpseId, true);
    }

    private void OnItemClicked(int index)
    {
        if (!ReadyToTake() || index < 0 || index >= visibleItems.Count)
        {
            Debug.LogWarning($"[LootUI] Clique não enviado: corpse={currentCorpseId}, index={index}, awaiting={awaitingServer}");
            return;
        }
        Debug.Log($"[LootUI] takeLoot corpse={currentCorpseId}, index={index}");
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
        // Fecha apenas a aba do cadáver atual. Outros corpos abertos
        // seguem no seletor e pedem novo snapshot autoritativo ao Node.
        openedCorpses.Remove(currentCorpseId);
        currentCorpseId = null;
        awaitingServer = false;
        visibleItems.Clear();
        if (openedCorpses.Count > 0 &&
            NetworkManager.Instance != null && NetworkManager.Instance.isConnected)
        {
            NetworkManager.Instance.Inventory?.SendLoot(openedCorpses[openedCorpses.Count - 1]);
        }
        if (lootPanel != null) lootPanel.SetActive(false);
        var header = transform.Find("C6DragHeader");
        if (header != null) header.gameObject.SetActive(false);
        if (closeButton != null) closeButton.gameObject.SetActive(false);
        C8SidebarDynamicDock.Instance?.OnLootClosed();
    }

    private void OnDestroy()
    {
        if (closeButton != null) closeButton.onClick.RemoveListener(CloseLootWindow);
        openedCorpses.Clear();
        if (Instance == this) Instance = null;
    }
}
