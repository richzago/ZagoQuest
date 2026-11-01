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

    private enum Tab { None, Backpack, Loot }
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
    private Button previousLootButton, nextLootButton;
    private TextMeshProUGUI backpackLabel, lootLabel;
    private RectTransform tabBar;
    private GameObject tabBarObject;
    private float lastWidth = -1f;
    private readonly Color32 idle = new Color32(28, 42, 55, 255);
    private readonly Color32 active = new Color32(83, 66, 43, 255);
    private readonly Color32 letters = new Color32(235, 233, 226, 255);
    private readonly Color32 disabled = new Color32(116, 129, 140, 240);

    private void Awake()
    {
        if (Instance != null && Instance != this) { Destroy(this); return; }
        Instance = this;
        shell = GetComponent<C8SidebarShell>();
    }

    private void LateUpdate()
    {
        if (!docked) TryDock();
        if (!docked) return;
        if (shell == null || shell.DynamicHost == null) return;
        float width = shell.DynamicHost.rect.width;
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
        BuildTabs();

        shell.SetDynamicDocked(true);
        loot.SetSidebarDocked(true);
        docked = true;

        if (loot.IsLootOpen) selected = Tab.Loot;
        else if (inventory.IsInventoryOpen) selected = Tab.Backpack;
        ApplyVisibility();
        Debug.Log("[C8DynamicDock] Mochila e Loot originais encaixados na sidebar.");
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
            viewport.offsetMin = new Vector2(5f, 35f);
            viewport.offsetMax = new Vector2(-5f, -5f);
        }
        if (inventory.goldText != null)
        {
            var gold = inventory.goldText.rectTransform;
            gold.anchorMin = new Vector2(0f, 0f);
            gold.anchorMax = new Vector2(1f, 0f);
            gold.pivot = new Vector2(0.5f, 0f);
            gold.offsetMin = new Vector2(8f, 4f);
            gold.offsetMax = new Vector2(-8f, 29f);
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
            shell.DynamicHost == null) return;
        var grid = inventory.slotsGrid.GetComponent<GridLayoutGroup>();
        if (grid == null) return;
        // 3 colunas de 92px estouravam a largura da barra (~240px).
        // 2 colunas preservam nome + ícone e scroll vertical do inventário.
        grid.constraint = GridLayoutGroup.Constraint.FixedColumnCount;
        grid.constraintCount = 2;
        float available = Mathf.Max(180f, shell.DynamicHost.rect.width - 24f);
        // Linhas baixas e margem curta: o scroll não "pula" os itens
        // finais da Bag pequena. A altura deixa espaço ao Loot abaixo.
        float width = Mathf.Clamp((available - 15f) * 0.5f, 72f, 108f);
        grid.cellSize = new Vector2(width, 62f);
        grid.spacing = new Vector2(4f, 3f);
        grid.padding = new RectOffset(4, 4, 4, 4);
        var bagScroll = inventory.slotsGrid.GetComponentInParent<ScrollRect>();
        if (bagScroll != null)
        {
            bagScroll.scrollSensitivity = 9f;
            bagScroll.inertia = false;
            bagScroll.movementType = ScrollRect.MovementType.Clamped;
        }
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
        var scroll = loot.itemsContainer.GetComponentInParent<ScrollRect>();
        if (scroll != null)
        {
            var scrollRect = scroll.transform as RectTransform;
            if (scrollRect != null)
            {
                scrollRect.anchorMin = new Vector2(0.02f, 0.04f);
                scrollRect.anchorMax = new Vector2(0.98f, 0.98f);
                scrollRect.offsetMin = scrollRect.offsetMax = Vector2.zero;
            }
            if (scroll.viewport != null)
            {
                var vr = scroll.viewport;
                vr.anchorMin = Vector2.zero;
                vr.anchorMax = new Vector2(0.92f, 1f);
                vr.offsetMin = vr.offsetMax = Vector2.zero;
            }
            scroll.horizontal = false;
            scroll.vertical = true;
            scroll.scrollSensitivity = 9f;
            scroll.inertia = false;
        }
        if (loot.takeAllButton != null)
        {
            var all = loot.takeAllButton.transform as RectTransform;
            if (all != null)
            {
                all.anchorMin = new Vector2(0.38f, 0.02f);
                all.anchorMax = new Vector2(0.96f, 0.18f);
                all.offsetMin = all.offsetMax = Vector2.zero;
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

    private static void SetChildActive(Transform root, string name, bool active)
    {
        var child = root.Find(name);
        if (child != null) child.gameObject.SetActive(active);
    }

    private void BuildTabs()
    {
        var section = shell.DynamicSection;
        tabBarObject = new GameObject("C8DynamicTabs", typeof(RectTransform));
        tabBarObject.transform.SetParent(section, false);
        tabBar = (RectTransform)tabBarObject.transform;
        tabBar.anchorMin = new Vector2(0f, 1f);
        tabBar.anchorMax = new Vector2(1f, 1f);
        tabBar.pivot = new Vector2(0.5f, 1f);
        tabBar.offsetMin = new Vector2(8f, -84f);
        tabBar.offsetMax = new Vector2(-8f, -45f);

        backpackButton = ButtonAt("BackpackTab", "BACKPACK", 0f, 0.44f,
            OpenBackpackTab, out backpackLabel);
        lootButton = ButtonAt("LootTab", "LOOT", 0.455f, 0.86f,
            OpenLootTab, out lootLabel);
        TextMeshProUGUI ignore;
        closeLootButton = ButtonAt("CloseLoot", "×", 0.89f, 1f,
            CloseLoot, out ignore);
        // Pequeno seletor de cadáveres: mantém múltiplas janelas de loot
        // acessíveis, sempre revalidando conteúdo pelo Node ao trocar.
        var prevObj = new GameObject("PreviousCorpse", typeof(RectTransform),
            typeof(Image), typeof(Button));
        var nextObj = new GameObject("NextCorpse", typeof(RectTransform),
            typeof(Image), typeof(Button));
        previousLootButton = NavigationButton(prevObj, "<", 0.78f,
            () => loot?.NavigateLoot(-1));
        nextLootButton = NavigationButton(nextObj, ">", 0.89f,
            () => loot?.NavigateLoot(1));
    }

    private Button ButtonAt(string name, string title, float left, float right,
        UnityEngine.Events.UnityAction action, out TextMeshProUGUI label)
    {
        var obj = new GameObject(name, typeof(RectTransform), typeof(Image), typeof(Button));
        obj.transform.SetParent(tabBar, false);
        var rect = (RectTransform)obj.transform;
        rect.anchorMin = new Vector2(left, 0f);
        rect.anchorMax = new Vector2(right, 1f);
        rect.offsetMin = rect.offsetMax = Vector2.zero;
        var image = obj.GetComponent<Image>();
        image.color = idle;
        image.raycastTarget = true; // botão visível APENAS na sidebar
        var button = obj.GetComponent<Button>();
        button.onClick.AddListener(action);
        var titleObj = new GameObject("Label", typeof(RectTransform), typeof(TextMeshProUGUI));
        titleObj.transform.SetParent(rect, false);
        label = titleObj.GetComponent<TextMeshProUGUI>();
        label.text = title;
        label.fontSize = title == "×" ? 20f : 12f;
        label.color = letters;
        label.alignment = TextAlignmentOptions.Center;
        label.raycastTarget = false;
        var lr = label.rectTransform;
        lr.anchorMin = Vector2.zero;
        lr.anchorMax = Vector2.one;
        lr.offsetMin = lr.offsetMax = Vector2.zero;
        return button;
    }

    private Button NavigationButton(GameObject obj, string glyph,
        float left, UnityEngine.Events.UnityAction action)
    {
        obj.transform.SetParent(shell.DynamicSection, false);
        var rect = (RectTransform)obj.transform;
        rect.anchorMin = new Vector2(left, 1f);
        rect.anchorMax = new Vector2(left + 0.09f, 1f);
        rect.pivot = new Vector2(0.5f, 1f);
        rect.offsetMin = new Vector2(0f, -36f);
        rect.offsetMax = new Vector2(0f, -8f);
        var img = obj.GetComponent<Image>();
        img.color = idle;
        img.raycastTarget = true;
        var button = obj.GetComponent<Button>();
        button.onClick.AddListener(action);
        var labelObj = new GameObject("Symbol", typeof(RectTransform), typeof(TextMeshProUGUI));
        labelObj.transform.SetParent(obj.transform, false);
        var label = labelObj.GetComponent<TextMeshProUGUI>();
        label.text = glyph;
        label.fontSize = 17f;
        label.color = letters;
        label.alignment = TextAlignmentOptions.Center;
        label.raycastTarget = false;
        var lr = label.rectTransform;
        lr.anchorMin = Vector2.zero;
        lr.anchorMax = Vector2.one;
        lr.offsetMin = lr.offsetMax = Vector2.zero;
        return button;
    }

    public void OnInventoryVisibilityChanged(bool opened)
    {
        if (!docked) return;
        if (opened) selected = Tab.Backpack;
        else if (selected == Tab.Backpack)
            selected = loot != null && loot.IsLootOpen ? Tab.Loot : Tab.None;
        ApplyVisibility();
    }

    public void OnLootOpened()
    {
        if (!docked) return;
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
        inventory.OpenInventory();
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
        float freeHeight = shell != null && shell.DynamicHost != null
            ? shell.DynamicHost.rect.height : 0f;
        // Game View baixa/F10 130%: só a aba mais nova recebe a área;
        // não criar dois painéis inutilizáveis com altura de 20px.
        if (showBag && showLoot && freeHeight < 245f)
        {
            if (selected == Tab.Backpack) showLoot = false;
            else showBag = false;
        }
        // Não são mais abas que se ocultam mutuamente: Bag compacta acima,
        // Loot no restante do host. Dois (ou mais) cadáveres ficam navegáveis.
        var host = shell != null ? shell.DynamicHost : null;
        if (host != null)
        {
            float h = host.rect.height;
            float bagHeight = showBag ? Mathf.Min(142f, Mathf.Max(78f, h * 0.40f)) : 0f;
            float lootHeight = showLoot ? Mathf.Min(176f,
                Mathf.Max(64f, h - bagHeight - 5f)) : 0f;
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
                r.anchorMin = new Vector2(0f, 1f);
                r.anchorMax = Vector2.one;
                r.pivot = new Vector2(0.5f, 1f);
                r.offsetMax = new Vector2(0f, -bagHeight - (showBag && showLoot ? 5f : 0f));
                r.offsetMin = new Vector2(0f, -bagHeight -
                    (showBag && showLoot ? 5f : 0f) - lootHeight);
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
        if (lootButton != null) lootButton.interactable =
            connected && loot != null && loot.IsLootOpen;
        if (backpackButton != null)
            backpackButton.interactable = connected && inventory != null &&
                inventory.HasEquippedBag;
        if (previousLootButton != null)
            previousLootButton.interactable = connected && loot != null &&
                loot.OpenedLootCount > 1;
        if (nextLootButton != null)
            nextLootButton.interactable = connected && loot != null &&
                loot.OpenedLootCount > 1;
        if (backpackLabel != null && inventory != null)
            backpackLabel.text = inventory.HasEquippedBag
                ? (inventory.EquippedBagId != null &&
                    inventory.EquippedBagId.Contains("simple_bag") ? "BAG" : "BACKPACK")
                : "SEM BAG";
        if (closeLootButton != null)
            closeLootButton.gameObject.SetActive(connected && loot != null && loot.IsLootOpen);
        if (backpackButton != null)
            backpackButton.GetComponent<Image>().color = showBag ? active : idle;
        if (lootButton != null)
            lootButton.GetComponent<Image>().color = showLoot ? active : idle;
        if (lootLabel != null)
            lootLabel.color = lootButton != null && lootButton.interactable ? letters : disabled;
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
        if (tabBarObject != null) Destroy(tabBarObject);
        if (previousLootButton != null) Destroy(previousLootButton.gameObject);
        if (nextLootButton != null) Destroy(nextLootButton.gameObject);
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
