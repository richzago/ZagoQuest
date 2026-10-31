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
    private const float SidebarWidth = 304f;
    private const float EquipmentSlotSize = 56f;
    private const float EquipmentStepX = 74f;
    private const float EquipmentStepY = 67f;

    private static readonly Color Background = new Color32(18, 27, 39, 249);
    private static readonly Color Inner = new Color32(29, 41, 56, 244);
    private static readonly Color Inset = new Color32(23, 34, 48, 247);
    private static readonly Color Gold = new Color32(175, 139, 80, 230);
    private static readonly Color Text = new Color32(235, 233, 226, 255);
    private static readonly Color Muted = new Color32(170, 188, 202, 255);

    private GameObject canvasRoot;
    private RectTransform equipmentHost;
    private RectTransform dynamicHost;
    private RectTransform dynamicSection;
    private GameObject dynamicHint;
    private float lastDynamicHeight = -1f;
    private EquipmentUI dockedEquipment;
    private Transform originalEquipmentParent;
    private Vector2 previousAnchorMin, previousAnchorMax, previousPivot;
    private Vector2 previousOffsetMin, previousOffsetMax;
    private Vector3 previousLocalScale;
    private bool previousDragVisible, previousCloseVisible;
    private float lastEquipmentWidth = -1f;

    // Contrato para futura etapa de loot/backpack: host existe mas NENHUM
    // panel e movido para ele nesta fase de homologacao do equipamento.
    public RectTransform DynamicHost => dynamicHost;

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
        sr.anchoredPosition = new Vector2(-12f, 0f);
        sr.sizeDelta = new Vector2(SidebarWidth, -24f);
        var background = surface.GetComponent<Image>();
        background.color = Background;
        background.raycastTarget = true; // somente dentro da barra visivel
        AddOutline(surface, Gold);

        AddText(surface.transform, "Brand", "ZAGOQUEST", 14, 28, 18, Gold);
        AddText(surface.transform, "Subtitle", "INTERFACE  •  AVENTUREIRO", 43, 24, 11, Muted);
        AddLine(surface.transform, "TopDivider", 75, Gold);

        // 1. FUTURO MINIMAPA — apenas representacao, sem sistema de mapa.
        var map = Card(surface.transform, "MiniMapSection", 89, 141);
        AddText(map.transform, "MapTitle", "MINIMAPA", 8, 25, 14, Text);
        AddText(map.transform, "MapSubtitle", "Visao do mundo  •  em breve", 34, 23, 11, Muted);
        var preview = Card(map.transform, "MapPreview", 62, 68, 10, 10, Inset);
        AddText(preview.transform, "MapWait", "MAPA EM DESENVOLVIMENTO", 19, 31, 11, Muted);
        AddLine(preview.transform, "MapLine", 6, Gold);

        // 2. EQUIPAMENTOS — usa o equipamento REAL, slots e eventos originais.
        var equipmentSection = Card(surface.transform, "EquipmentSection", 241, 369);
        AddText(equipmentSection.transform, "EquipmentTitle", "EQUIPAMENTOS", 10, 29, 15, Text);
        AddText(equipmentSection.transform, "EquipmentHint", "Arraste os itens para equipar", 37, 22, 11, Muted);
        equipmentHost = Holder(equipmentSection.transform, "EquipmentHost",
            new Vector2(0f, 0f), Vector2.one, new Vector2(8f, 10f), new Vector2(-8f, -65f));

        // 3. CONFIGURACOES — placeholders discretos, NAO interativos.
        var settings = Card(surface.transform, "SettingsIconsSection", 622, 68);
        AddText(settings.transform, "SettingsTitle", "ACESSO RAPIDO", 5, 26, 12, Text);
        var icons = Holder(settings.transform, "SettingsIconsPlaceholder",
            new Vector2(0f, 0f), Vector2.one, new Vector2(10, 7), new Vector2(-10, -31));
        AddIcon(icons, "Settings", "CFG", 0);
        AddIcon(icons, "Sound", "SOM", 1);
        AddIcon(icons, "Help", "AJUDA", 2);
        AddIcon(icons, "Extra", "···", 3);

        // 4. HOST DINAMICO RESERVADO para futuro Loot/Backpack.
        // Nenhum callback de loot/backpack e alterado aqui.
        var dynamicSection = new GameObject("DynamicContentSection",
            typeof(RectTransform), typeof(Image));
        dynamicSection.transform.SetParent(surface.transform, false);
        var dr = (RectTransform)dynamicSection.transform;
        this.dynamicSection = dr;
        dr.anchorMin = Vector2.zero;
        dr.anchorMax = Vector2.one;
        dr.offsetMin = new Vector2(13f, 15f);
        dr.offsetMax = new Vector2(-13f, -702f);
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
        if (dynamicHint != null) dynamicHint.SetActive(height >= 125f);
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
        // 3 slots de 56, separados em passos de 74: 204, centralizado.
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
                -12f - row * EquipmentStepY);
            rect.sizeDelta = new Vector2(EquipmentSlotSize, EquipmentSlotSize);
            rect.localScale = Vector3.one;
            if (slot.slotText != null)
            {
                slot.slotText.enableAutoSizing = true;
                slot.slotText.fontSizeMin = 8f;
                slot.slotText.fontSizeMax = 11f;
                slot.slotText.raycastTarget = false;
            }
            // O Image de cada slot conserva raycastTarget=true para o drop.
        }

        var help = panel.Find("C6Help");
        if (help != null)
        {
            var rt = help as RectTransform;
            if (rt != null)
            {
                rt.anchorMin = new Vector2(0f, 0f);
                rt.anchorMax = new Vector2(1f, 0f);
                rt.pivot = new Vector2(0.5f, 0f);
                rt.offsetMin = new Vector2(8f, 3f);
                rt.offsetMax = new Vector2(-8f, 24f);
            }
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

    private static void AddIcon(RectTransform parent, string name, string label, int index)
    {
        var obj = new GameObject(name, typeof(RectTransform), typeof(Image));
        obj.transform.SetParent(parent, false);
        var rect = (RectTransform)obj.transform;
        rect.anchorMin = new Vector2(index * 0.25f + 0.01f, 0f);
        rect.anchorMax = new Vector2((index + 1) * 0.25f - 0.01f, 1f);
        rect.offsetMin = rect.offsetMax = Vector2.zero;
        var image = obj.GetComponent<Image>();
        image.color = Inset;
        image.raycastTarget = false; // TODO: configurar callbacks somente em etapa futura
        AddText(obj.transform, "IconLabel", label, 5f, 24f, 11f, Muted);
        var text = obj.transform.Find("IconLabel").GetComponent<TextMeshProUGUI>();
        text.alignment = TextAlignmentOptions.Center;
        text.enableWordWrapping = false;
        text.rectTransform.offsetMin = new Vector2(3f, text.rectTransform.offsetMin.y);
        text.rectTransform.offsetMax = new Vector2(-3f, text.rectTransform.offsetMax.y);
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
            dockedEquipment.SetSidebarDocked(false);
        }
        if (canvasRoot != null) Destroy(canvasRoot);
        canvasRoot = null;
        equipmentHost = null;
        dynamicHost = null;
        dynamicSection = null;
        dynamicHint = null;
    }
}
