using TMPro;
using UnityEngine;
using UnityEngine.UI;

/// <summary>
/// C8 UI 2B: docking visual do Inventario/Mochila e Loot REAIS da cena.
/// Nao cria itens, containers persistentes, protocolos, nem reexecuta Start.
/// Abas compartilham a area dinamica: um painel visivel por vez, com scroll.
/// </summary>
[DisallowMultipleComponent]
public sealed class C8SidebarDynamicDock : MonoBehaviour
{
    public static C8SidebarDynamicDock Instance { get; private set; }

    private enum Tab { None, Backpack, Loot, Stats }
    private struct PanelBackup
    {
        public RectTransform rect;
        public Transform parent;
        public int sibling;
        public Vector2 min, max, pivot, offsetMin, offsetMax;
        public Vector3 scale;
    }

    private C8SidebarShell shell;
    private InventoryUI inventory;
    private LootUI loot;
    private PanelBackup inventoryBackup;
    private PanelBackup lootBackup;
    private bool docked;
    private Tab selected = Tab.None;
    private CanvasGroup inventoryGroup;
    private CanvasGroup lootGroup;
    private Button backpackButton, lootButton, closeLootButton;
    private Button previousLootButton, nextLootButton, takeAllMiniButton;
    private RectTransform bagHost, corpseHost;
    private TextMeshProUGUI backpackLabel, lootLabel;
    private RectTransform tabBar;
    private GameObject tabBarObject;
    private float lastWidth = -1f;

    // C16: alturas preferidas são configurações LOCAIS, nunca pacotes Node.
    // A altura de verdade é sempre limitada pelo host e pela outra janela.
    private const float MinBagHeight = 170f; // 2×2 slots + rodapé + puxador
    private const float MinLootHeight = 150f;
    private const float PanelGap = 6f;
    private const string BagHeightKey = "ZagoQuest.C16.BagHeight";
    private const string LootHeightKey = "ZagoQuest.C16.LootHeight";
    private float requestedBagHeight = MinBagHeight;
    private float requestedLootHeight = 180f;
    private C16PanelResizeHandle bagResizeHandle, lootResizeHandle;
    private readonly Color32 idle = C11VisualTheme.Recess;
    private readonly Color32 active = C11VisualTheme.BronzeDark;
    private readonly Color32 letters = C11VisualTheme.Text;
    private readonly Color32 disabled = C11VisualTheme.Muted;

    private void Awake()
    {
        if (Instance != null && Instance != this) { Destroy(this); return; }
        Instance = this;
        shell = GetComponent<C8SidebarShell>();
        requestedBagHeight = Mathf.Max(MinBagHeight,
            PlayerPrefs.GetFloat(BagHeightKey, MinBagHeight));
        requestedLootHeight = Mathf.Max(MinLootHeight,
            PlayerPrefs.GetFloat(LootHeightKey, 180f));
    }

    private void LateUpdate()
    {
        if (!docked) TryDock();
        if (!docked) return;
        if (shell == null || shell.DynamicHost == null) return;
        ResolveHosts();
        float width = bagHost != null ? bagHost.rect.width : shell.DynamicHost.rect.width;
        if (Mathf.Abs(width - lastWidth) > 1f)
        {
            AdaptInventoryGrid();
            lastWidth = width;
        }
        // A visibilidade real dos painéis deriva de seus controladores
        // antigos; as abas nao alteram estado e nao geram mensagens Node.
        bool bagOpen = inventory != null && inventory.IsInventoryOpen;
        bool lootOpen = loot != null && loot.IsLootOpen;
        if (selected == Tab.Loot && !lootOpen)
            selected = bagOpen ? Tab.Backpack : Tab.None;
        if (selected == Tab.Backpack && !bagOpen)
            selected = lootOpen ? Tab.Loot : Tab.None;
        ApplyVisibility();
    }

    private void TryDock()
    {
        if (shell == null) shell = GetComponent<C8SidebarShell>();
        if (shell == null || shell.DynamicHost == null || shell.DynamicSection == null) return;
        inventory = InventoryUI.Instance;
        loot = LootUI.Instance;
        if (inventory == null || loot == null || inventory.inventoryPanel == null ||
            loot.lootPanel == null || inventory.slotsGrid == null ||
            loot.itemsContainer == null) return;
        // Os layouts C6 e C5 precisam ter finalizado seus Start() antes
        // do docking. NUNCA invocar Start, Header ou PrepareList de novo.
        if (inventory.inventoryPanel.transform.Find("C6InventoryViewport") == null ||
            loot.transform.Find("C6DragHeader") == null) return;

        var host = shell.DynamicHost;
        if (host.GetComponent<RectMask2D>() == null)
            host.gameObject.AddComponent<RectMask2D>();

        inventoryBackup = Capture(inventory.inventoryPanel.transform as RectTransform);
        lootBackup = Capture(loot.transform as RectTransform);
        if (inventoryBackup.rect == null || lootBackup.rect == null) return;

        Dock(inventoryBackup.rect, host);
        Dock(lootBackup.rect, host);
        inventoryGroup = EnsureGroup(inventoryBackup.rect.gameObject);
        lootGroup = EnsureGroup(lootBackup.rect.gameObject);

        ConfigureInventoryPanel();
        ConfigureLootPanel();
        WireBackpackIcon();
        StatusManager.Instance?.DockToSidebar(shell.DynamicHost);
        bagResizeHandle = CreateResizeHandle(inventoryBackup.rect, true);
        lootResizeHandle = CreateResizeHandle(lootBackup.rect, false);

        shell.SetDynamicDocked(true);
        loot.SetSidebarDocked(true);
        docked = true;

        if (loot.IsLootOpen) selected = Tab.Loot;
        else if (inventory.IsInventoryOpen) selected = Tab.Backpack;
        ApplyVisibility();
        Debug.Log("[C8DynamicDock] Mochila e Loot originais encaixados na sidebar.");
    }

    /// <summary>
    /// Troca APENAS o RectTransform REAL entre colunas configuráveis.
    /// Nunca cria clones de LootUI/InventoryUI e mantém callbacks originais.
    /// </summary>
    private void ResolveHosts()
    {
        var preferences=C10ClientLayoutSettings.Instance;
        var desiredBag=preferences != null && preferences.BagHost != null
            ? preferences.BagHost : shell.DynamicHost;
        var desiredLoot=preferences != null && preferences.LootHost != null
            ? preferences.LootHost : shell.DynamicHost;
        if (desiredBag != null && inventoryBackup.rect != null &&
            inventoryBackup.rect.parent != desiredBag)
        {
            inventoryBackup.rect.SetParent(desiredBag,false);
            bagHost=desiredBag;
            lastWidth=-1f;
        }
        if (desiredLoot != null && lootBackup.rect != null &&
            lootBackup.rect.parent != desiredLoot)
        {
            lootBackup.rect.SetParent(desiredLoot,false);
            corpseHost=desiredLoot;
        }
        if (bagHost == null) bagHost=desiredBag;
        if (corpseHost == null) corpseHost=desiredLoot;
    }

    private static PanelBackup Capture(RectTransform rect)
    {
        return new PanelBackup {
            rect = rect,
            parent = rect != null ? rect.parent : null,
            sibling = rect != null ? rect.GetSiblingIndex() : 0,
            min = rect != null ? rect.anchorMin : Vector2.zero,
            max = rect != null ? rect.anchorMax : Vector2.one,
            pivot = rect != null ? rect.pivot : new Vector2(0.5f, 0.5f),
            offsetMin = rect != null ? rect.offsetMin : Vector2.zero,
            offsetMax = rect != null ? rect.offsetMax : Vector2.zero,
            scale = rect != null ? rect.localScale : Vector3.one
        };
    }

    private static void Dock(RectTransform panel, RectTransform host)
    {
        panel.SetParent(host, false);
        panel.anchorMin = Vector2.zero;
        panel.anchorMax = Vector2.one;
        panel.pivot = new Vector2(0.5f, 0.5f);
        panel.offsetMin = Vector2.zero;
        panel.offsetMax = Vector2.zero;
        panel.localScale = Vector3.one;
    }

    private static void Restore(PanelBackup b)
    {
        if (b.rect == null || b.parent == null) return;
        b.rect.SetParent(b.parent, false);
        b.rect.SetSiblingIndex(Mathf.Min(b.sibling, b.parent.childCount - 1));
        b.rect.anchorMin = b.min;
        b.rect.anchorMax = b.max;
        b.rect.pivot = b.pivot;
        b.rect.offsetMin = b.offsetMin;
        b.rect.offsetMax = b.offsetMax;
        b.rect.localScale = b.scale;
    }

    private static CanvasGroup EnsureGroup(GameObject obj)
    {
        var group = obj.GetComponent<CanvasGroup>();
        if (group == null) group = obj.AddComponent<CanvasGroup>();
        return group;
    }

    private void ConfigureInventoryPanel()
    {
        var panel = inventory.inventoryPanel.transform;
        SetChildActive(panel, "C6DragHeader", false);
        SetChildActive(panel, "C6Title", false);
        SetChildActive(panel, "C6CloseButton", false);
        SetChildActive(panel, "C6Help", false);
        var viewport = panel.Find("C6InventoryViewport") as RectTransform;
        if (viewport != null)
        {
            if (viewport.GetComponent<C9LootBagDropTarget>() == null)
                viewport.gameObject.AddComponent<C9LootBagDropTarget>();
            viewport.anchorMin = Vector2.zero;
            viewport.anchorMax = Vector2.one;
            // Rodapé (ouro + slots) fica sobre o puxador de 16 px.
            viewport.offsetMin = new Vector2(5f, 46f);
            viewport.offsetMax = new Vector2(-5f, -5f);
        }
        if (inventory.goldText != null)
        {
            var gold = inventory.goldText.rectTransform;
            gold.anchorMin = new Vector2(0f, 0f);
            gold.anchorMax = new Vector2(1f, 0f);
            gold.pivot = new Vector2(0.5f, 0f);
            gold.offsetMin = new Vector2(8f, 18f);
            gold.offsetMax = new Vector2(-8f, 43f);
            inventory.goldText.enableAutoSizing = true;
            inventory.goldText.fontSizeMin = 10f;
            inventory.goldText.fontSizeMax = 13f;
            inventory.goldText.raycastTarget = false;
        }
        var panelImage = inventory.inventoryPanel.GetComponent<Image>();
        if (panelImage != null) panelImage.raycastTarget = false;
        AdaptInventoryGrid();
    }

    private void AdaptInventoryGrid()
    {
        if (inventory == null || inventory.slotsGrid == null || shell == null ||
            bagHost == null) return;
        var grid = inventory.slotsGrid.GetComponent<GridLayoutGroup>();
        if (grid == null) return;
        // 3 colunas de 92px estouravam a largura da barra (~240px).
        // 2 colunas preservam nome + ícone e scroll vertical do inventário.
        grid.constraint = GridLayoutGroup.Constraint.FixedColumnCount;
        grid.constraintCount = 2;
        float available = Mathf.Max(132f, bagHost.rect.width - 16f);
        // Quatro slots visíveis por padrão: duas colunas × duas linhas.
        // Slots menores para caber até em 720p/F10 sem cortar linhas.
        float width = Mathf.Clamp((available - 22f) * 0.5f, 50f, 100f);
        grid.cellSize = new Vector2(width, 50f);
        grid.spacing = new Vector2(4f, 3f);
        grid.padding = new RectOffset(4, 4, 4, 4);
        var bagScroll = inventory.slotsGrid.GetComponentInParent<ScrollRect>();
        if (bagScroll != null)
        {
            bagScroll.scrollSensitivity = 1f;
            bagScroll.inertia = false;
            EnsureVerticalScrollbar(bagScroll, "C15BagScrollbar");
            bagScroll.movementType = ScrollRect.MovementType.Clamped;
        }
    }

    /// <summary>
    /// Sempre usar um viewport FILHO separado. No inventário C6 o
    /// ScrollRect.viewport apontava para o próprio RectTransform do ScrollRect;
    /// alterar anchorMax ali encolhia a janela toda e cortava slots.
    /// </summary>
    private static void EnsureVerticalScrollbar(ScrollRect scroll, string id)
    {
        if (scroll == null || scroll.content == null) return;
        scroll.horizontal = false;
        scroll.vertical = true;
        scroll.movementType = ScrollRect.MovementType.Clamped;
        scroll.inertia = false;
        scroll.scrollSensitivity = 1f; // fallback: C16FineScrollWheel recebe o evento
        var scrollRoot = (RectTransform)scroll.transform;
        var view = scroll.viewport;
        if (view == null || view == scrollRoot)
        {
            var existing = scroll.transform.Find("C16ClippedViewport");
            if (existing == null)
            {
                var go = new GameObject("C16ClippedViewport", typeof(RectTransform),
                    typeof(Image), typeof(RectMask2D));
                go.transform.SetParent(scroll.transform, false);
                existing = go.transform;
            }
            view = (RectTransform)existing;
            scroll.content.SetParent(view, false);
            scroll.viewport = view;
        }
        if (view.GetComponent<RectMask2D>() == null)
            view.gameObject.AddComponent<RectMask2D>();
        var target = view.GetComponent<Image>();
        if (target == null) target = view.gameObject.AddComponent<Image>();
        target.color = new Color(0f, 0f, 0f, 0f);
        target.raycastTarget = true;
        var handler = view.GetComponent<C16FineScrollWheel>();
        if (handler == null) handler = view.gameObject.AddComponent<C16FineScrollWheel>();
        handler.Bind(scroll);

        view.anchorMin = Vector2.zero;
        view.anchorMax = Vector2.one;
        view.offsetMin = Vector2.zero;
        view.offsetMax = new Vector2(-14f, 0f);
        if (scroll.content != null)
        {
            var fitter = scroll.content.GetComponent<ContentSizeFitter>();
            if (fitter == null)
                fitter = scroll.content.gameObject.AddComponent<ContentSizeFitter>();
            fitter.verticalFit = ContentSizeFitter.FitMode.PreferredSize;
            fitter.horizontalFit = ContentSizeFitter.FitMode.Unconstrained;
        }

        var root = scroll.transform.Find(id);
        if (root == null)
        {
            var obj = new GameObject(id, typeof(RectTransform), typeof(Image), typeof(Scrollbar));
            obj.transform.SetParent(scroll.transform, false);
            root = obj.transform;
            var track = obj.GetComponent<Image>();
            track.color = C11VisualTheme.Recess;
            var thumb = new GameObject("Handle", typeof(RectTransform), typeof(Image));
            thumb.transform.SetParent(root, false);
            var hr = (RectTransform)thumb.transform;
            hr.anchorMin = Vector2.zero; hr.anchorMax = Vector2.one;
            hr.offsetMin = new Vector2(1, 1); hr.offsetMax = new Vector2(-1, -1);
            var image = thumb.GetComponent<Image>();
            image.color = C11VisualTheme.Bronze;
            image.raycastTarget = true;
            var bar = obj.GetComponent<Scrollbar>();
            bar.handleRect = hr;
            bar.targetGraphic = image;
            bar.direction = Scrollbar.Direction.BottomToTop;
        }
        var rect = root as RectTransform;
        rect.anchorMin = new Vector2(1f, 0f);
        rect.anchorMax = Vector2.one;
        rect.pivot = new Vector2(1f, 0.5f);
        rect.offsetMin = new Vector2(-12f, 2f);
        rect.offsetMax = new Vector2(-1f, -2f);
        root.SetAsLastSibling();
        scroll.verticalScrollbar = root.GetComponent<Scrollbar>();
        // Wheel over the scrollbar track must be just as precise as over slots.
        var wheel = root.GetComponent<C16FineScrollWheel>();
        if (wheel == null) wheel = root.gameObject.AddComponent<C16FineScrollWheel>();
        wheel.Bind(scroll);
        scroll.verticalScrollbarVisibility = ScrollRect.ScrollbarVisibility.Permanent;
        scroll.verticalScrollbarSpacing = 0f;
    }

    private void ConfigureLootPanel()
    {
        var root = loot.transform;
        SetChildActive(root, "C6DragHeader", false);
        if (loot.closeButton != null) loot.closeButton.gameObject.SetActive(false);
        var visual = loot.lootPanel.transform as RectTransform;
        if (visual != null)
        {
            visual.anchorMin = Vector2.zero;
            visual.anchorMax = Vector2.one;
            visual.offsetMin = Vector2.zero;
            visual.offsetMax = Vector2.zero;
            visual.localScale = Vector3.one;
        }
        // Linhas de loot compactas: menos buracos entre itens e mais
        // espaço para navegar sem perder a linha selecionada.
        var layout = loot.itemsContainer.GetComponent<VerticalLayoutGroup>();
        if (layout != null)
        {
            layout.spacing = 3f;
            layout.padding = new RectOffset(4, 4, 4, 4);
        }
        var scroll = loot.itemsContainer.GetComponentInParent<ScrollRect>();
        if (scroll != null)
        {
            var scrollRect = scroll.transform as RectTransform;
            if (scrollRect != null)
            {
                scrollRect.anchorMin = Vector2.zero;
                scrollRect.anchorMax = Vector2.one;
                // 16 px de puxador + ação TODOS acima, ambos fora do viewport.
                scrollRect.offsetMin = new Vector2(5f, 46f);
                scrollRect.offsetMax = new Vector2(-5f, -5f);
            }
            if (scroll.viewport != null)
            {
                var vr = scroll.viewport;
                vr.anchorMin = Vector2.zero;
                vr.anchorMax = Vector2.one;
                vr.offsetMin = Vector2.zero;
                vr.offsetMax = new Vector2(-14f, 0f);
            }
            scroll.horizontal = false;
            scroll.vertical = true;
            scroll.scrollSensitivity = 1f;
            scroll.inertia = false;
            EnsureVerticalScrollbar(scroll, "C15LootScrollbar");
        }
        if (loot.takeAllButton != null)
        {
            var all = loot.takeAllButton.transform as RectTransform;
            if (all != null)
            {
                all.anchorMin = new Vector2(0.38f, 0f);
                all.anchorMax = new Vector2(0.96f, 0f);
                all.offsetMin = new Vector2(0f, 19f);
                all.offsetMax = new Vector2(0f, 44f);
            }
            var label = loot.takeAllButton.GetComponentInChildren<TextMeshProUGUI>(true);
            if (label != null)
            {
                label.fontSize = 12f;
                label.enableAutoSizing = true;
                label.fontSizeMin = 10f;
                label.fontSizeMax = 12f;
                label.raycastTarget = false;
            }
        }
        var image = loot.GetComponent<Image>();
        if (image != null) image.raycastTarget = false;
    }

    private static C16PanelResizeHandle CreateResizeHandle(
        RectTransform panel, bool bag)
    {
        if (panel == null) return null;
        var existing = panel.Find("C16BottomResizeGrip");
        var obj = existing != null ? existing.gameObject :
            new GameObject("C16BottomResizeGrip",
                typeof(RectTransform), typeof(Image), typeof(C16PanelResizeHandle));
        if (existing == null) obj.transform.SetParent(panel, false);
        var rect = (RectTransform)obj.transform;
        rect.anchorMin = new Vector2(0f, 0f);
        rect.anchorMax = new Vector2(1f, 0f);
        rect.pivot = new Vector2(0.5f, 0f);
        rect.offsetMin = new Vector2(0f, 0f);
        rect.offsetMax = new Vector2(0f, 16f);
        var image = obj.GetComponent<Image>();
        image.color = C11VisualTheme.BronzeDark;
        image.raycastTarget = true;
        var labelObject = obj.transform.Find("Hint");
        if (labelObject == null)
        {
            var labelGo = new GameObject("Hint",
                typeof(RectTransform), typeof(TextMeshProUGUI));
            labelGo.transform.SetParent(obj.transform, false);
            labelObject = labelGo.transform;
        }
        var hint = labelObject.GetComponent<TextMeshProUGUI>();
        hint.text = "↕  PUXE PARA AJUSTAR  ↕";
        hint.fontSize = 9f;
        hint.color = C11VisualTheme.Text;
        hint.alignment = TextAlignmentOptions.Center;
        hint.raycastTarget = false;
        var labelRect = hint.rectTransform;
        labelRect.anchorMin = Vector2.zero; labelRect.anchorMax = Vector2.one;
        labelRect.offsetMin = labelRect.offsetMax = Vector2.zero;
        obj.transform.SetAsLastSibling(); // sem cobrir slots/rodapé
        var grip = obj.GetComponent<C16PanelResizeHandle>();
        grip.Bind(Instance, bag);
        return grip;
    }

    public bool TryBeginResize(bool bag, out RectTransform host, out float height)
    {
        host = bag ? bagHost : corpseHost;
        var panel = bag ? inventoryBackup.rect : lootBackup.rect;
        height = panel != null ? panel.rect.height : 0f;
        return docked && host != null && panel != null &&
            (bag ? inventory != null && inventory.IsInventoryOpen :
                loot != null && loot.IsLootOpen);
    }

    public void ResizePanel(bool bag, float height)
    {
        float maximum = bag ? BagContentHeight() : LootContentHeight();
        if (bag)
            requestedBagHeight = Mathf.Clamp(height, MinBagHeight, maximum);
        else
            requestedLootHeight = Mathf.Clamp(height, MinLootHeight, maximum);
        ApplyVisibility();
    }

    public void FinishResize(bool bag)
    {
        PlayerPrefs.SetFloat(bag ? BagHeightKey : LootHeightKey,
            bag ? requestedBagHeight : requestedLootHeight);
        PlayerPrefs.Save();
    }

    private float BagContentHeight()
    {
        // O total de slots é informado pelo Node, incluindo posições vazias.
        int slots = inventory != null ? Mathf.Max(4, inventory.BagSlots) : 4;
        int rows = Mathf.CeilToInt(slots / 2f);
        return Mathf.Max(MinBagHeight, 59f + rows * 50f +
            Mathf.Max(0, rows - 1) * 3f);
    }

    private float LootContentHeight()
    {
        int rows = loot != null ? Mathf.Max(1, loot.VisibleLootItemCount) : 1;
        // VerticalLayoutGroup: 36px por linha, spacing 3px, padding 8px.
        return Mathf.Max(MinLootHeight, 59f + rows * 36f +
            Mathf.Max(0, rows - 1) * 3f);
    }

    private static void SetChildActive(Transform root, string name, bool active)
    {
        var child = root.Find(name);
        if (child != null) child.gameObject.SetActive(active);
    }

    // Sem barra de abas, TODOS duplicado, texto ou setas < > visuais.
    private Button quickBackpackButton;

    private void WireBackpackIcon()
    {
        var icon = shell.QuickAccessHost != null
            ? shell.QuickAccessHost.Find("BackpackIcon") : null;
        if (icon == null) return;
        var image = icon.GetComponent<Image>();
        if (image != null) image.raycastTarget = true;
        quickBackpackButton = icon.GetComponent<Button>();
        if (quickBackpackButton == null)
            quickBackpackButton = icon.gameObject.AddComponent<Button>();
        quickBackpackButton.onClick.RemoveListener(OpenBackpackTab);
        quickBackpackButton.onClick.AddListener(OpenBackpackTab);
    }

    public void OnStatusVisibilityChanged(bool opened)
    {
        if (!docked) return;
        if (opened) selected = Tab.Stats;
        else if (selected == Tab.Stats)
            selected = loot != null && loot.IsLootOpen ? Tab.Loot :
                inventory != null && inventory.IsInventoryOpen ? Tab.Backpack : Tab.None;
        ApplyVisibility();
    }

    public void OnInventoryVisibilityChanged(bool opened)
    {
        if (!docked) return;
        if (opened)
        {
            StatusManager.Instance?.ClosePanel();
            selected = Tab.Backpack;
        }
        else if (selected == Tab.Backpack)
            selected = loot != null && loot.IsLootOpen ? Tab.Loot : Tab.None;
        ApplyVisibility();
    }

    public void OnLootOpened()
    {
        if (!docked) return;
        StatusManager.Instance?.ClosePanel();
        selected = Tab.Loot;
        ApplyVisibility();
    }

    public void OnLootClosed()
    {
        if (!docked) return;
        if (selected == Tab.Loot)
            selected = inventory != null && inventory.IsInventoryOpen
                ? Tab.Backpack : Tab.None;
        ApplyVisibility();
    }

    private void OpenBackpackTab()
    {
        if (inventory == null) return;
        StatusManager.Instance?.ClosePanel();
        inventory.ToggleBackpack();
        selected = Tab.Backpack;
        ApplyVisibility();
    }

    private void OpenLootTab()
    {
        if (loot == null || !loot.IsLootOpen) return;
        selected = Tab.Loot;
        ApplyVisibility();
    }

    private void CloseLoot()
    {
        if (loot != null && loot.IsLootOpen)
            loot.CloseLootWindow();
    }

    private void ApplyVisibility()
    {
        if (!docked) return;
        bool connected = NetworkManager.Instance != null &&
            NetworkManager.Instance.isConnected;
        bool showBag = connected && inventory != null &&
            inventory.IsInventoryOpen && inventory.HasEquippedBag;
        bool showLoot = connected && loot != null && loot.IsLootOpen;
        bool statsActive = StatusManager.Instance != null &&
            StatusManager.Instance.IsOpen;
        if (statsActive)
        {
            showBag = false;
            showLoot = false;
        }
        float freeHeight = bagHost != null ? bagHost.rect.height : 0f;
        bool sameHost = bagHost != null && bagHost == corpseHost;
        // Em colunas pequenas, exibir uma ABA completa (4 slots na Bag)
        // ao invés de duas janelas com metade dos itens escondidos.
        if (sameHost && showBag && showLoot)
        {
            if (selected == Tab.Backpack) showLoot = false;
            else showBag = false;
        }
        var host = bagHost;
        if (host != null)
        {
            float h = Mathf.Max(0f, host.rect.height);
            float lootSpace = corpseHost != null ?
                Mathf.Max(0f, corpseHost.rect.height) : h;
            float bagMax = showBag ? Mathf.Min(BagContentHeight(),
                Mathf.Max(0f, h - (sameHost && showLoot ? MinLootHeight + PanelGap : 0f))) : 0f;
            float bagHeight = showBag ? Mathf.Min(bagMax,
                Mathf.Max(MinBagHeight, requestedBagHeight)) : 0f;
            float lootMax = showLoot ? Mathf.Min(LootContentHeight(),
                Mathf.Max(0f, lootSpace -
                    (sameHost && showBag ? bagHeight + PanelGap : 0f))) : 0f;
            float lootHeight = showLoot ? Mathf.Min(lootMax,
                Mathf.Max(MinLootHeight, requestedLootHeight)) : 0f;
            float lootTop = sameHost && showBag && showLoot
                ? bagHeight + PanelGap : 0f;
            if (inventoryBackup.rect != null)
            {
                var r = inventoryBackup.rect;
                r.anchorMin = new Vector2(0f, 1f);
                r.anchorMax = new Vector2(1f, 1f);
                r.pivot = new Vector2(0.5f, 1f);
                r.offsetMin = new Vector2(0f, -bagHeight);
                r.offsetMax = Vector2.zero;
            }
            if (lootBackup.rect != null)
            {
                var r = lootBackup.rect;
                // O root do Loot tem ALTURA fixa. Antes anchorMin=(0,1)
                // e anchorMax=(1,1), mas offsetMin partia da BASE do host,
                // criando uma janela maior que a altura calculada.
                // Corrigir as duas âncoras no topo garante que os slots e
                // o RectMask2D usem exatamente a faixa reservada.
                r.anchorMin = new Vector2(0f, 1f);
                r.anchorMax = new Vector2(1f, 1f);
                r.pivot = new Vector2(0.5f, 1f);
                r.offsetMax = new Vector2(0f, -lootTop);
                r.offsetMin = new Vector2(0f, -lootTop - lootHeight);
            }
        }
        if (inventoryGroup != null)
        {
            inventoryGroup.alpha = showBag ? 1f : 0f;
            inventoryGroup.interactable = showBag;
            inventoryGroup.blocksRaycasts = showBag;
        }
        if (lootGroup != null)
        {
            lootGroup.alpha = showLoot ? 1f : 0f;
            lootGroup.interactable = showLoot;
            lootGroup.blocksRaycasts = showLoot;
        }
    }

    /// <summary>
    /// Antes de destruir uma coluna configurável, salva os RectTransforms reais
    /// no host principal. O recálculo seguinte pode encaixá-los em outra coluna.
    /// </summary>
    public void ReturnToPrimaryHost()
    {
        if (!docked || shell == null || shell.DynamicHost == null) return;
        if (inventoryBackup.rect != null &&
            inventoryBackup.rect.parent != shell.DynamicHost)
            inventoryBackup.rect.SetParent(shell.DynamicHost,false);
        if (lootBackup.rect != null &&
            lootBackup.rect.parent != shell.DynamicHost)
            lootBackup.rect.SetParent(shell.DynamicHost,false);
        bagHost = corpseHost = shell.DynamicHost;
        lastWidth=-1f;
    }

    /// <summary>
    /// Chamado pelo C8SidebarShell antes de destruir o Canvas, para nao
    /// destruir os painéis reais que foram reparentados para a sidebar.
    /// </summary>
    public void Undock()
    {
        if (!docked) return;
        docked = false;
        loot?.SetSidebarDocked(false);
        if (inventoryGroup != null)
        {
            inventoryGroup.alpha = 1f;
            inventoryGroup.blocksRaycasts = true;
            inventoryGroup.interactable = true;
        }
        if (lootGroup != null)
        {
            lootGroup.alpha = 1f;
            lootGroup.blocksRaycasts = true;
            lootGroup.interactable = true;
        }
        Restore(inventoryBackup);
        Restore(lootBackup);
        if (quickBackpackButton != null)
            quickBackpackButton.onClick.RemoveListener(OpenBackpackTab);
        StatusManager.Instance?.DetachFromSidebar();
        tabBarObject = null;
        tabBar = null;
        shell?.SetDynamicDocked(false);
    }

    private void OnDestroy()
    {
        Undock();
        if (Instance == this) Instance = null;
    }
}
