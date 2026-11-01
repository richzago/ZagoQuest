using TMPro;
using UnityEngine;
using UnityEngine.UI;

/// <summary>
/// C8 / UI 2A: sidebar minimalista com quatro zonas.
/// Reusa o EquipmentPanel REAL da cena (com os dez EquipmentSlotUI originais),
/// sem clonar UI, alterar handlers, lógica da câmera, pesca ou gameplay.
/// World input: Canvas raiz SEM Graphic; apenas superficies visiveis bloqueiam.
/// </summary>
[DisallowMultipleComponent]
public sealed class C8SidebarShell : MonoBehaviour
{
    // Tela de configurações controla a largura; padrão ~25% menor que C8.
    private const float SidebarWidth = C10ClientLayoutSettings.MainCompactWidth;
    private const float EquipmentSlotSize = 50f;
    private const float EquipmentStepX = 62f;
    private const float EquipmentStepY = 53f;

    private static readonly Color Background = new Color32(18, 27, 39, 249);
    private static readonly Color Inner = new Color32(29, 41, 56, 244);
    private static readonly Color Inset = new Color32(23, 34, 48, 247);
    private static readonly Color Gold = new Color32(175, 139, 80, 230);
    private static readonly Color Text = new Color32(235, 233, 226, 255);
    private static readonly Color Muted = new Color32(170, 188, 202, 255);

    private GameObject canvasRoot;
    private RectTransform sidebarSurface;
    private RectTransform miniMapSection;
    private RectTransform equipmentSectionRect;
    private RectTransform settingsSectionRect;
    private RectTransform quickAccessHost;
    public RectTransform QuickAccessHost => quickAccessHost;
    private RectTransform miniMapCircleRect;
    private Sprite miniMapSprite;
    private Texture2D miniMapTexture;
    private float lastSidebarHeight = -1f;
    private RectTransform equipmentHost;
    private RectTransform dynamicHost;
    private RectTransform dynamicSection;
    private GameObject dynamicHint;
    private bool dynamicDocked;
    private float lastDynamicHeight = -1f;
    private EquipmentUI dockedEquipment;
    private Transform originalEquipmentParent;
    private Vector2 previousAnchorMin, previousAnchorMax, previousPivot;
    private Vector2 previousOffsetMin, previousOffsetMax;
    private Vector3 previousLocalScale;
    private bool previousDragVisible, previousCloseVisible;
    private bool previousHierarchyTitleVisible, previousHelpVisible;
    private float lastEquipmentWidth = -1f;

    // Contrato para futura etapa de loot/backpack: host existe mas NENHUM
    // panel e movido para ele nesta fase de homologacao do equipamento.
    public RectTransform DynamicHost => dynamicHost;
    public RectTransform DynamicSection => dynamicSection;

    public void SetDynamicDocked(bool docked)
    {
        dynamicDocked = docked;
        if (dynamicHint != null) dynamicHint.SetActive(!docked);
    }
    // Coordenada visual da margem esquerda REAL da sidebar,
    // usada por C8PlayfieldViewport (sem adivinhar CanvasScaler/F10).
    public RectTransform SidebarSurface => sidebarSurface;

    private void Start()
    {
        BuildShell();
        GetComponent<C7UiAccessibility>()?.ApplyCurrent();
        RefreshVisibility();
    }

    private void Update() => RefreshVisibility();

    private void LateUpdate()
    {
        // EquipmentUI.Start aplica C6InventoryEquipmentLayout e reparenta
        // a HUD. Esperar o C6DragHeader existir evita corrida de Start().
        if (equipmentHost == null) return;
        RefreshResponsiveLayout();
        AdjustDynamicPlaceholder();
        if (dockedEquipment == null)
            TryDockExistingEquipment();

        if (dockedEquipment != null)
        {
            var panel = dockedEquipment.equipmentPanel;
            // O painel e permanente na sidebar. Botao legado de toggle
            // nao deve deixa-lo invisivel depois de clicado.
            if (panel != null && !panel.activeSelf && canvasRoot != null &&
                canvasRoot.activeSelf)
                panel.SetActive(true);
            float width = equipmentHost.rect.width;
            if (Mathf.Abs(width - lastEquipmentWidth) > 0.5f)
            {
                LayoutExistingSlots(dockedEquipment);
                lastEquipmentWidth = width;
            }
        }
    }

    private void RefreshVisibility()
    {
        if (canvasRoot == null) return;
        var net = NetworkManager.Instance;
        bool connected = net != null && net.isConnected;
        if (canvasRoot.activeSelf != connected) canvasRoot.SetActive(connected);
    }

    private void BuildShell()
    {
        if (canvasRoot != null) return;
        // A raiz ocupa a tela como Canvas, SEM Image nem qualquer Graphic:
        // nunca criar uma hitbox transparente sobre combate/loot!
        canvasRoot = new GameObject("C8SidebarCanvas", typeof(RectTransform),
            typeof(Canvas), typeof(CanvasScaler), typeof(GraphicRaycaster));
        var canvas = canvasRoot.GetComponent<Canvas>();
        canvas.renderMode = RenderMode.ScreenSpaceOverlay;
        canvas.overrideSorting = true;
        // A UI da cena usa sorting 0 e algumas imagens transparentes que
        // precediam o hit de EquipmentSlotUI no EventSystem. A sidebar precisa
        // estar ACIMA do HUD para equip/unequip, mas abaixo de pesca (420)
        // e login (500). Fora da faixa nao ha Graphic para bloquear o mundo.
        canvas.sortingOrder = 110;

        var scaler = canvasRoot.GetComponent<CanvasScaler>();
        scaler.uiScaleMode = CanvasScaler.ScaleMode.ScaleWithScreenSize;
        scaler.referenceResolution = new Vector2(1920, 1080);
        scaler.matchWidthOrHeight = 0.5f;

        var surface = new GameObject("SidebarSurface", typeof(RectTransform), typeof(Image));
        surface.transform.SetParent(canvasRoot.transform, false);
        var sr = (RectTransform)surface.transform;
        sr.anchorMin = new Vector2(1f, 0f);
        sr.anchorMax = new Vector2(1f, 1f);
        sr.pivot = new Vector2(1f, 0.5f);
        // Coluna fixa ao topo, base e borda direita; nenhum vão residual.
        sr.anchoredPosition = Vector2.zero;
        sr.sizeDelta = new Vector2(SidebarWidth, 0f);
        sidebarSurface = sr;
        var background = surface.GetComponent<Image>();
        background.color = Background;
        background.raycastTarget = true; // somente dentro da barra visivel
        AddOutline(surface, Gold);

        AddText(surface.transform, "Brand", "ZAGOQUEST", 14, 28, 18, Gold);
        AddText(surface.transform, "Subtitle", "INTERFACE  •  AVENTUREIRO", 43, 24, 11, Muted);
        AddLine(surface.transform, "TopDivider", 75, Gold);

        // 1. MINIMAPA FUTURO — formato circular; sem dados de mapa.
        var map = Card(surface.transform, "MiniMapSection", 62, 164);
        miniMapSection = (RectTransform)map.transform;
        AddText(map.transform, "MapTitle", "MINIMAPA", 8, 25, 13, Text);
        miniMapTexture = CreateCircularMiniMapTexture();
        miniMapSprite = Sprite.Create(miniMapTexture,
            new Rect(0, 0, miniMapTexture.width, miniMapTexture.height),
            new Vector2(0.5f, 0.5f), 100f);
        var circle = new GameObject("MiniMapCircularPreview",
            typeof(RectTransform), typeof(Image));
        circle.transform.SetParent(map.transform, false);
        miniMapCircleRect = (RectTransform)circle.transform;
        miniMapCircleRect.anchorMin = miniMapCircleRect.anchorMax = new Vector2(0.5f, 1f);
        miniMapCircleRect.pivot = new Vector2(0.5f, 1f);
        var mapImage = circle.GetComponent<Image>();
        mapImage.sprite = miniMapSprite;
        mapImage.color = Color.white;
        mapImage.preserveAspect = true;
        mapImage.raycastTarget = false;
        AddCenterText(circle.transform, "MapWaiting", "EM BREVE", 11f, Muted);

        // 2. EQUIPAMENTOS — reutiliza o painel e os slots reais.
        var equipmentSection = Card(surface.transform, "EquipmentSection", 234, 265);
        equipmentSectionRect = (RectTransform)equipmentSection.transform;
        AddText(equipmentSection.transform, "EquipmentTitle", "EQUIPAMENTOS", 7, 28, 15, Text);
        // Sem texto "arraste para equipar/retirar": menos poluicao visual.
        equipmentHost = Holder(equipmentSection.transform, "EquipmentHost",
            Vector2.zero, Vector2.one, new Vector2(8f, 6f), new Vector2(-8f, -36f));

        // 3. ACESSOS FUTUROS — pictogramas, nunca siglas ou botões falsos.
        var settings = Card(surface.transform, "SettingsIconsSection", 507, 58);
        settingsSectionRect = (RectTransform)settings.transform;
        AddText(settings.transform, "SettingsTitle", "ACESSO RÁPIDO", 3, 20, 11, Muted);
        var icons = Holder(settings.transform, "SettingsIconsPlaceholder",
            Vector2.zero, Vector2.one, new Vector2(8f, 5f), new Vector2(-8f, -24f));
        quickAccessHost = icons;
        AddIcon(icons, "SettingsIcon", 0, 6);
        AddIcon(icons, "SoundIcon", 1, 6);
        AddIcon(icons, "ChatIcon", 2, 6);
        AddIcon(icons, "BackpackIcon", 3, 6);
        AddIcon(icons, "MapIcon", 4, 6);
        AddIcon(icons, "HelpIcon", 5, 6);

        // 4. HOST DINAMICO RESERVADO para futuro Loot/Backpack.
        // Nenhum callback de loot/backpack e alterado aqui.
        var dynamicSection = new GameObject("DynamicContentSection",
            typeof(RectTransform), typeof(Image));
        dynamicSection.transform.SetParent(surface.transform, false);
        var dr = (RectTransform)dynamicSection.transform;
        this.dynamicSection = dr;
        dr.anchorMin = Vector2.zero;
        dr.anchorMax = Vector2.one;
        dr.offsetMin = new Vector2(12f, 0f);
        dr.offsetMax = new Vector2(-12f, -574f);
        var di = dynamicSection.GetComponent<Image>();
        di.color = Inner;
        di.raycastTarget = false;
        AddText(dynamicSection.transform, "DynamicTitle", "MOCHILAS  /  LOOT", 9, 30, 14, Text);
        AddText(dynamicSection.transform, "DynamicHint",
            "Espaco reservado para janelas dinamicas", 39, 45, 11, Muted);
        dynamicHint = dynamicSection.transform.Find("DynamicHint").gameObject;
        dynamicHost = Holder(dynamicSection.transform, "SidebarDynamicHost",
            Vector2.zero, Vector2.one, new Vector2(10, 9), new Vector2(-10, -91));
        // Container vazio: sem Image, sem CanvasGroup e SEM raycast.
    }

    public void ApplyClientDensity()
    {
        if (sidebarSurface == null) return;
        var prefs = C10ClientLayoutSettings.Instance;
        bool compactMode = prefs == null || prefs.Compact;
        float desired = compactMode
            ? C10ClientLayoutSettings.MainCompactWidth
            : C10ClientLayoutSettings.MainComfortWidth;
        sidebarSurface.SetSizeWithCurrentAnchors(RectTransform.Axis.Horizontal, desired);
        lastSidebarHeight = -1f;
        RefreshResponsiveLayout();
    }

    private void RefreshResponsiveLayout()
    {
        if (sidebarSurface == null || miniMapSection == null ||
            equipmentSectionRect == null || settingsSectionRect == null ||
            dynamicSection == null) return;
        float height = sidebarSurface.rect.height;
        if (Mathf.Abs(height - lastSidebarHeight) < 1f) return;
        lastSidebarHeight = height;

        // Em resolucoes menores ou escala F10 alta, reserva mais espaco
        // para o host dinamico, sem ampliar cards sobre o mundo.
        bool compact = (C10ClientLayoutSettings.Instance == null ||
            C10ClientLayoutSettings.Instance.Compact) || height < 760f;
        PlaceTop(miniMapSection, compact ? 43f : 62f,
            compact ? 91f : 164f, 8f, 8f);
        PlaceTop(equipmentSectionRect, compact ? 142f : 234f,
            compact ? 216f : 265f, 8f, 8f);
        PlaceTop(settingsSectionRect, compact ? 363f : 507f,
            compact ? 48f : 58f, 8f, 8f);
        float diameter = compact ? 58f : 112f;
        if (miniMapCircleRect != null)
        {
            miniMapCircleRect.sizeDelta = new Vector2(diameter, diameter);
            miniMapCircleRect.anchoredPosition = new Vector2(0f, compact ? -38f : -39f);
        }
        dynamicSection.offsetMin = new Vector2(12f, 0f);
        // Nunca inverter a area dinamica: rolagem/resize funcional fica
        // para outra etapa, mas a base sempre cabe na sidebar.
        float dynamicTop = compact ? 419f : 574f;
        dynamicSection.offsetMax = new Vector2(-12f,
            -Mathf.Min(dynamicTop, Mathf.Max(0f, height - 22f)));
        lastDynamicHeight = -1f;
    }

    private static Texture2D CreateCircularMiniMapTexture()
    {
        // Placeholder circular real, gerado localmente sem prefab nem asset
        // de minimapa. Todos os pixels fora do circulo sao transparentes.
        const int size = 128;
        var texture = new Texture2D(size, size, TextureFormat.RGBA32, false);
        texture.name = "C8MiniMapCirclePlaceholder";
        texture.filterMode = FilterMode.Bilinear;
        texture.wrapMode = TextureWrapMode.Clamp;
        var pixels = new Color32[size * size];
        for (int y = 0; y < size; y++)
        for (int x = 0; x < size; x++)
        {
            float dx = (x + 0.5f - size * 0.5f) / (size * 0.5f);
            float dy = (y + 0.5f - size * 0.5f) / (size * 0.5f);
            float radius = Mathf.Sqrt(dx * dx + dy * dy);
            byte alpha = (byte)Mathf.RoundToInt(
                255f * Mathf.Clamp01((1f - radius) * size * 0.35f));
            Color32 color = radius > 0.925f
                ? new Color32(175, 139, 80, alpha)
                : radius > 0.86f
                    ? new Color32(39, 55, 72, alpha)
                    : new Color32(22, 37, 52, alpha);
            pixels[y * size + x] = color;
        }
        texture.SetPixels32(pixels);
        texture.Apply(false, false);
        return texture;
    }

    private void AdjustDynamicPlaceholder()
    {
        if (dynamicSection == null || dynamicHost == null) return;
        // F10 chega a 130%. A altura util do Canvas diminui: nunca
        // deixar offset de host invertido em 1280x720 / 1920x1080.
        float height = dynamicSection.rect.height;
        if (Mathf.Abs(height - lastDynamicHeight) <= 0.5f) return;
        lastDynamicHeight = height;
        float header = Mathf.Min(91f, Mathf.Max(39f, height - 10f));
        dynamicHost.offsetMax = new Vector2(-10f, -header);
        if (dynamicHint != null) dynamicHint.SetActive(!dynamicDocked && height >= 125f);
    }

    private void TryDockExistingEquipment()
    {
        var ui = EquipmentUI.Instance;
        if (ui == null || ui.equipmentPanel == null || ui.slotsContainer == null)
            return;
        var panel = ui.equipmentPanel;
        // C6InventoryEquipmentLayout.Equipment prepara o grid/labels uma vez.
        if (panel.transform.Find("C6DragHeader") == null) return;

        var rect = panel.GetComponent<RectTransform>();
        if (rect == null) return;
        originalEquipmentParent = rect.parent;
        previousAnchorMin = rect.anchorMin;
        previousAnchorMax = rect.anchorMax;
        previousPivot = rect.pivot;
        previousOffsetMin = rect.offsetMin;
        previousOffsetMax = rect.offsetMax;
        previousLocalScale = rect.localScale;
        previousDragVisible = panel.transform.Find("C6DragHeader")?.gameObject.activeSelf ?? false;
        previousCloseVisible = panel.transform.Find("C6CloseButton")?.gameObject.activeSelf ?? false;
        // Titulo legado vem do proprio scenebasic.unity: EquipmentPanel/Equipaments.
        previousHierarchyTitleVisible = panel.transform.Find("Equipaments")?.gameObject.activeSelf ?? false;
        previousHelpVisible = panel.transform.Find("C6Help")?.gameObject.activeSelf ?? false;
        rect.SetParent(equipmentHost, false); // MESMO GameObject/slots, nao clonagem
        rect.anchorMin = Vector2.zero;
        rect.anchorMax = Vector2.one;
        rect.pivot = new Vector2(0.5f, 0.5f);
        rect.offsetMin = Vector2.zero;
        rect.offsetMax = Vector2.zero;
        rect.localScale = Vector3.one;

        // Equipamento agora e fixo na barra: desabilitar alca e X antigos
        // para nao arrastar o panel nem fechar acidentalmente os slots.
        var drag = panel.transform.Find("C6DragHeader");
        if (drag != null) drag.gameObject.SetActive(false);
        var close = panel.transform.Find("C6CloseButton");
        if (close != null) close.gameObject.SetActive(false);
        var oldTitle = panel.transform.Find("C6Title");
        if (oldTitle != null) oldTitle.gameObject.SetActive(false);
        var hierarchyTitle = panel.transform.Find("Equipaments");
        if (hierarchyTitle != null) hierarchyTitle.gameObject.SetActive(false);
        var help = panel.transform.Find("C6Help");
        if (help != null) help.gameObject.SetActive(false);

        var image = panel.GetComponent<Image>();
        if (image != null)
        {
            image.color = Inset;
            // E um painel opaco LEGITIMO; bloqueia somente a propria area.
            image.raycastTarget = true;
        }

        ui.SetSidebarDocked(true);
        dockedEquipment = ui;
        LayoutExistingSlots(ui);
        lastEquipmentWidth = equipmentHost.rect.width;
        Debug.Log("[C8Sidebar] Equipamentos originais encaixados na sidebar.");
    }

    private void LayoutExistingSlots(EquipmentUI ui)
    {
        if (ui == null || ui.slotsContainer == null || equipmentHost == null)
            return;
        var panel = ui.equipmentPanel.GetComponent<RectTransform>();
        var slots = ui.slotsContainer as RectTransform;
        if (panel == null || slots == null) return;

        slots.anchorMin = Vector2.zero;
        slots.anchorMax = Vector2.one;
        slots.offsetMin = Vector2.zero;
        slots.offsetMax = Vector2.zero;

        float total = EquipmentSlotSize + EquipmentStepX * 2f;
        // 3 slots de 50, com passos de 62: 174, centralizados no painel.
        float x0 = Mathf.Max(8f, (panel.rect.width - total) * 0.5f);
        foreach (Transform child in ui.slotsContainer)
        {
            var slot = child.GetComponent<EquipmentSlotUI>();
            var rect = child as RectTransform;
            if (slot == null || rect == null) continue;
            int col, row;
            switch (slot.slotType)
            {
                case EquipmentSlot.AMULET: col = 0; row = 0; break;
                case EquipmentSlot.HELMET: col = 1; row = 0; break;
                case EquipmentSlot.BACKPACK: col = 2; row = 0; break;
                case EquipmentSlot.WEAPON: col = 0; row = 1; break;
                case EquipmentSlot.ARMOR: col = 1; row = 1; break;
                case EquipmentSlot.SHIELD: col = 2; row = 1; break;
                case EquipmentSlot.RING: col = 0; row = 2; break;
                case EquipmentSlot.LEGS: col = 1; row = 2; break;
                case EquipmentSlot.USEFUL: col = 2; row = 2; break;
                default: col = 1; row = 3; break; // BOOTS
            }
            rect.anchorMin = rect.anchorMax = new Vector2(0f, 1f);
            rect.pivot = new Vector2(0f, 1f);
            rect.anchoredPosition = new Vector2(x0 + col * EquipmentStepX,
                -4f - row * EquipmentStepY);
            rect.sizeDelta = new Vector2(EquipmentSlotSize, EquipmentSlotSize);
            rect.localScale = Vector3.one;
            if (slot.slotText != null)
            {
                slot.slotText.enableAutoSizing = true;
                slot.slotText.fontSizeMin = 7.5f;
                slot.slotText.fontSizeMax = 10.5f;
                slot.slotText.enableWordWrapping = true;
                slot.slotText.raycastTarget = false;
            }
            // O Image de cada slot conserva raycastTarget=true para o drop.
        }

    }

    private static GameObject Card(Transform parent, string name, float top,
        float height, float left = 13f, float right = 13f, Color? color = null)
    {
        var obj = new GameObject(name, typeof(RectTransform), typeof(Image));
        obj.transform.SetParent(parent, false);
        PlaceTop((RectTransform)obj.transform, top, height, left, right);
        var image = obj.GetComponent<Image>();
        image.color = color ?? Inner;
        image.raycastTarget = false; // pai SidebarSurface ja bloqueia UI
        return obj;
    }

    private static RectTransform Holder(Transform parent, string name,
        Vector2 min, Vector2 max, Vector2 offsetMin, Vector2 offsetMax)
    {
        var obj = new GameObject(name, typeof(RectTransform));
        obj.transform.SetParent(parent, false);
        var r = (RectTransform)obj.transform;
        r.anchorMin = min;
        r.anchorMax = max;
        r.offsetMin = offsetMin;
        r.offsetMax = offsetMax;
        return r;
    }

    private static void AddIcon(RectTransform parent, string name,
        int index, int count)
    {
        // Pictogramas geométricos de UI, sem siglas e sem dependencias
        // de glifos unicode ou sprites externos. Tudo decorativo.
        var obj = new GameObject(name, typeof(RectTransform), typeof(Image));
        obj.transform.SetParent(parent, false);
        var rect = (RectTransform)obj.transform;
        float gap = 0.008f;
        rect.anchorMin = new Vector2(index / (float)count + gap, 0f);
        rect.anchorMax = new Vector2((index + 1) / (float)count - gap, 1f);
        rect.offsetMin = rect.offsetMax = Vector2.zero;
        var image = obj.GetComponent<Image>();
        image.color = Inset;
        image.raycastTarget = false;

        switch (index)
        {
            case 0: // engrenagem abstrata: núcleo e quatro dentes
                Shape(obj.transform, "GearCore", 0, 0, 10, 10, Gold);
                Shape(obj.transform, "GearTop", 0, 9, 4, 6, Muted);
                Shape(obj.transform, "GearBottom", 0, -9, 4, 6, Muted);
                Shape(obj.transform, "GearLeft", -9, 0, 6, 4, Muted);
                Shape(obj.transform, "GearRight", 9, 0, 6, 4, Muted);
                break;
            case 1: // audio
                Shape(obj.transform, "SoundBase", -7, -1, 6, 10, Muted);
                Shape(obj.transform, "SoundOne", 2, 0, 3, 13, Gold);
                Shape(obj.transform, "SoundTwo", 9, 0, 3, 20, Gold);
                break;
            case 2: // chat
                Shape(obj.transform, "ChatTop", 0, 8, 20, 2, Gold);
                Shape(obj.transform, "ChatBottom", -2, -8, 16, 2, Gold);
                Shape(obj.transform, "ChatLeft", -10, 0, 2, 16, Gold);
                Shape(obj.transform, "ChatRight", 10, 0, 2, 16, Gold);
                Shape(obj.transform, "ChatTail", -8, -12, 4, 5, Gold);
                break;
            case 3: // mochila
                Shape(obj.transform, "BagTop", 0, 11, 10, 3, Gold);
                Shape(obj.transform, "BagLeft", -9, -1, 3, 20, Gold);
                Shape(obj.transform, "BagRight", 9, -1, 3, 20, Gold);
                Shape(obj.transform, "BagBottom", 0, -11, 18, 3, Gold);
                break;
            case 4: // mapa/rosa dos ventos
                Shape(obj.transform, "CompassVertical", 0, 0, 3, 21, Gold);
                Shape(obj.transform, "CompassHorizontal", 0, 0, 21, 3, Gold);
                Shape(obj.transform, "CompassCenter", 0, 0, 7, 7, Muted);
                break;
            default: // ajuda: pontuacao reconhecivel, nao sigla
                AddCenterText(obj.transform, "HelpSymbol", "?", 20f, Gold);
                break;
        }
    }

    private static void Shape(Transform parent, string name,
        float x, float y, float width, float height, Color color)
    {
        var obj = new GameObject(name, typeof(RectTransform), typeof(Image));
        obj.transform.SetParent(parent, false);
        var rect = (RectTransform)obj.transform;
        rect.anchorMin = rect.anchorMax = new Vector2(0.5f, 0.5f);
        rect.pivot = new Vector2(0.5f, 0.5f);
        rect.anchoredPosition = new Vector2(x, y);
        rect.sizeDelta = new Vector2(width, height);
        var image = obj.GetComponent<Image>();
        image.color = color;
        image.raycastTarget = false;
    }

    private static void AddCenterText(Transform parent, string name,
        string value, float size, Color color)
    {
        var obj = new GameObject(name, typeof(RectTransform), typeof(TextMeshProUGUI));
        obj.transform.SetParent(parent, false);
        var rect = (RectTransform)obj.transform;
        rect.anchorMin = Vector2.zero;
        rect.anchorMax = Vector2.one;
        rect.offsetMin = rect.offsetMax = Vector2.zero;
        var label = obj.GetComponent<TextMeshProUGUI>();
        label.text = value;
        label.fontSize = size;
        label.enableAutoSizing = false;
        label.color = color;
        label.alignment = TextAlignmentOptions.Center;
        label.raycastTarget = false;
    }

    private static void AddLine(Transform parent, string name, float top, Color color)
    {
        var obj = new GameObject(name, typeof(RectTransform), typeof(Image));
        obj.transform.SetParent(parent, false);
        PlaceTop((RectTransform)obj.transform, top, 1.2f, 18f, 18f);
        var image = obj.GetComponent<Image>();
        image.color = color;
        image.raycastTarget = false;
    }

    private static void AddText(Transform parent, string name, string value,
        float top, float height, float size, Color color)
    {
        var obj = new GameObject(name, typeof(RectTransform), typeof(TextMeshProUGUI));
        obj.transform.SetParent(parent, false);
        PlaceTop((RectTransform)obj.transform, top, height, 17f, 17f);
        var label = obj.GetComponent<TextMeshProUGUI>();
        label.text = value;
        label.fontSize = size;
        label.color = color;
        label.alignment = TextAlignmentOptions.TopLeft;
        label.enableWordWrapping = true;
        label.raycastTarget = false;
    }

    private static void PlaceTop(RectTransform rect, float top, float height,
        float left, float right)
    {
        rect.anchorMin = new Vector2(0f, 1f);
        rect.anchorMax = new Vector2(1f, 1f);
        rect.pivot = new Vector2(0.5f, 1f);
        rect.offsetMin = new Vector2(left, -top - height);
        rect.offsetMax = new Vector2(-right, -top);
    }

    private static void AddOutline(GameObject obj, Color color)
    {
        var outline = obj.AddComponent<Outline>();
        outline.effectColor = color;
        outline.effectDistance = new Vector2(-1f, -1f);
        outline.useGraphicAlpha = true;
    }

    private void OnDestroy()
    {
        // Devolver loot/inventario antes que o Canvas seja destruido.
        GetComponent<C8SidebarDynamicDock>()?.Undock();
        // Se a sidebar for destruida isoladamente, o EquipmentPanel da
        // cena NAO pode ser destruido junto: devolver ao Canvas anterior.
        if (dockedEquipment != null && dockedEquipment.equipmentPanel != null &&
            originalEquipmentParent != null)
        {
            var panel = dockedEquipment.equipmentPanel;
            var rt = panel.GetComponent<RectTransform>();
            if (rt != null)
            {
                rt.SetParent(originalEquipmentParent, false);
                rt.anchorMin = previousAnchorMin;
                rt.anchorMax = previousAnchorMax;
                rt.pivot = previousPivot;
                rt.offsetMin = previousOffsetMin;
                rt.offsetMax = previousOffsetMax;
                rt.localScale = previousLocalScale;
            }
            var drag = panel.transform.Find("C6DragHeader");
            if (drag != null) drag.gameObject.SetActive(previousDragVisible);
            var close = panel.transform.Find("C6CloseButton");
            if (close != null) close.gameObject.SetActive(previousCloseVisible);
            var hierarchyTitle = panel.transform.Find("Equipaments");
            if (hierarchyTitle != null) hierarchyTitle.gameObject.SetActive(previousHierarchyTitleVisible);
            var help = panel.transform.Find("C6Help");
            if (help != null) help.gameObject.SetActive(previousHelpVisible);
            dockedEquipment.SetSidebarDocked(false);
        }
        if (canvasRoot != null) Destroy(canvasRoot);
        canvasRoot = null;
        equipmentHost = null;
        dynamicHost = null;
        dynamicSection = null;
        dynamicHint = null;
        sidebarSurface = null;
        miniMapSection = null;
        equipmentSectionRect = null;
        settingsSectionRect = null;
        quickAccessHost = null;
        miniMapCircleRect = null;
        if (miniMapSprite != null) Destroy(miniMapSprite);
        if (miniMapTexture != null) Destroy(miniMapTexture);
    }
}
