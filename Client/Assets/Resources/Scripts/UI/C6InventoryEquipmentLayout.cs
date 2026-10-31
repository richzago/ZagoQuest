using TMPro;
using UnityEngine;
using UnityEngine.Events;
using UnityEngine.EventSystems;
using UnityEngine.UI;

/// <summary>
/// C6: organiza a UI existente durante o Play Mode. A cena e os prefabs
/// serializados continuam intactos; o Node segue autoritativo.
/// </summary>
public static class C6InventoryEquipmentLayout
{
    private static readonly Color Panel = new Color32(19, 27, 39, 247);
    private static readonly Color Inner = new Color32(32, 45, 60, 245);
    private static readonly Color Gold = new Color32(235, 191, 109, 255);
    private static readonly Color Text = new Color32(232, 233, 228, 255);

    private static void Dock(GameObject panel, float width, float right)
    {
        var canvas = panel.GetComponentInParent<Canvas>();
        if (canvas == null) return;
        // EquipmentPanel na cena é filho de TopRight (400x300).
        // Reparentar em runtime evita que o layout maior seja recortado.
        if (panel.transform.parent != canvas.transform)
            panel.transform.SetParent(canvas.transform, false);
        var rt = panel.GetComponent<RectTransform>();
        rt.anchorMin = rt.anchorMax = rt.pivot = Vector2.one;
        rt.sizeDelta = new Vector2(width, 500);
        rt.anchoredPosition = new Vector2(-right, -72);
        rt.localScale = Vector3.one;
        var image = panel.GetComponent<Image>();
        if (image != null)
        {
            image.enabled = true;
            image.color = Panel;
            image.raycastTarget = true;
        }
        var outline = panel.GetComponent<Outline>();
        if (outline == null) outline = panel.AddComponent<Outline>();
        outline.effectColor = Gold;
        outline.effectDistance = new Vector2(1, -1);
    }

    private static void Label(Transform parent, string name, string value, int font,
        Vector2 min, Vector2 max, Vector2 offsetMin, Vector2 offsetMax,
        TextAlignmentOptions alignment)
    {
        var existing = parent.Find(name);
        var go = existing != null ? existing.gameObject :
            new GameObject(name, typeof(RectTransform), typeof(TextMeshProUGUI));
        if (existing == null) go.transform.SetParent(parent, false);
        var rect = (RectTransform)go.transform;
        rect.anchorMin = min;
        rect.anchorMax = max;
        rect.offsetMin = offsetMin;
        rect.offsetMax = offsetMax;
        var text = go.GetComponent<TextMeshProUGUI>();
        text.text = value;
        text.fontSize = font;
        text.color = Text;
        text.alignment = alignment;
        text.raycastTarget = false;
    }

    private static void Header(GameObject panel, string title, UnityAction close)
    {
        Label(panel.transform, "C6Title", title, 21,
            new Vector2(0, 1), Vector2.one,
            new Vector2(16, -60), new Vector2(-52, -11),
            TextAlignmentOptions.MidlineLeft);
        var header = panel.transform.Find("C6Title").GetComponent<TextMeshProUGUI>();
        header.color = Gold;
        if (panel.transform.Find("C6CloseButton") != null) return;
        var go = new GameObject("C6CloseButton", typeof(RectTransform), typeof(Image), typeof(Button));
        go.transform.SetParent(panel.transform, false);
        var rt = (RectTransform)go.transform;
        rt.anchorMin = rt.anchorMax = rt.pivot = Vector2.one;
        rt.anchoredPosition = new Vector2(-12, -12);
        rt.sizeDelta = new Vector2(32, 30);
        go.GetComponent<Image>().color = new Color32(85, 57, 61, 255);
        go.GetComponent<Button>().onClick.AddListener(close);
        Label(go.transform, "CloseText", "×", 23, Vector2.zero, Vector2.one,
            Vector2.zero, Vector2.zero, TextAlignmentOptions.Center);
    }

    public static void Inventory(GameObject panel, Transform slots, TMP_Text gold, UnityAction close)
    {
        if (panel == null || slots == null) return;
        Dock(panel, 360, 308);
        Header(panel, "INVENTÁRIO", close);
        var existing = panel.transform.Find("C6InventoryViewport");
        var viewport = existing != null ? existing.gameObject :
            new GameObject("C6InventoryViewport", typeof(RectTransform),
                typeof(Image), typeof(RectMask2D), typeof(ScrollRect),
                typeof(C6InventoryDropTarget));
        if (existing == null) viewport.transform.SetParent(panel.transform, false);
        var rect = (RectTransform)viewport.transform;
        rect.anchorMin = Vector2.zero;
        rect.anchorMax = Vector2.one;
        rect.offsetMin = new Vector2(16, 73);
        rect.offsetMax = new Vector2(-16, -73);
        viewport.GetComponent<Image>().color = Inner;
        viewport.GetComponent<Image>().raycastTarget = true;
        if (slots.parent != rect) slots.SetParent(rect, false);

        var content = slots as RectTransform;
        if (content == null) return;
        content.anchorMin = new Vector2(0, 1);
        content.anchorMax = Vector2.one;
        content.pivot = new Vector2(0.5f, 1);
        content.anchoredPosition = Vector2.zero;
        content.sizeDelta = Vector2.zero;
        var grid = slots.GetComponent<GridLayoutGroup>();
        if (grid == null) grid = slots.gameObject.AddComponent<GridLayoutGroup>();
        grid.constraint = GridLayoutGroup.Constraint.FixedColumnCount;
        grid.constraintCount = 3;
        grid.cellSize = new Vector2(92, 92);
        grid.spacing = new Vector2(8, 8);
        grid.padding = new RectOffset(10, 10, 10, 10);
        grid.childAlignment = TextAnchor.UpperCenter;
        var fitter = slots.GetComponent<ContentSizeFitter>();
        if (fitter == null) fitter = slots.gameObject.AddComponent<ContentSizeFitter>();
        fitter.horizontalFit = ContentSizeFitter.FitMode.Unconstrained;
        fitter.verticalFit = ContentSizeFitter.FitMode.PreferredSize;
        var scroll = viewport.GetComponent<ScrollRect>();
        scroll.viewport = rect;
        scroll.content = content;
        scroll.horizontal = false;
        scroll.vertical = true;
        scroll.scrollSensitivity = 32;
        scroll.movementType = ScrollRect.MovementType.Clamped;

        // Placeholder antigo ItemContainer não é um item de inventory.
        foreach (Transform child in slots)
            if (child.GetComponent<InventorySlot>() == null)
                child.gameObject.SetActive(false);

        if (gold != null)
        {
            var gr = gold.rectTransform;
            gr.anchorMin = new Vector2(0, 0);
            gr.anchorMax = new Vector2(1, 0);
            gr.pivot = new Vector2(0.5f, 0);
            gr.offsetMin = new Vector2(16, 33);
            gr.offsetMax = new Vector2(-16, 63);
            gold.fontSize = 17;
            gold.color = Gold;
            gold.alignment = TextAlignmentOptions.MidlineLeft;
            gold.raycastTarget = false;
        }
        Label(panel.transform, "C6Help", "Duplo clique: equipar  ·  Botão direito: usar", 12,
            Vector2.zero, new Vector2(1, 0),
            new Vector2(16, 6), new Vector2(-16, 30),
            TextAlignmentOptions.MidlineLeft);
    }

    public static void Equipment(GameObject panel, Transform slots, UnityAction close)
    {
        if (panel == null || slots == null) return;
        Dock(panel, 276, 16);
        // Equipamentos no CENTRO DIREITO. O canto superior direito fica
        // reservado ao minimapa futuro (sem criar placeholder ou alterar .unity).
        // Inventário segue à esquerda: ambos permanecem clicáveis quando abertos.
        var equipmentRect = panel.GetComponent<RectTransform>();
        equipmentRect.anchorMin = equipmentRect.anchorMax =
            equipmentRect.pivot = new Vector2(1f, 0.5f);
        equipmentRect.anchoredPosition = new Vector2(-12f, 0f);
        Header(panel, "EQUIPAMENTOS", close);
        var container = slots as RectTransform;
        if (container == null) return;
        container.anchorMin = Vector2.zero;
        container.anchorMax = Vector2.one;
        container.offsetMin = Vector2.zero;
        container.offsetMax = new Vector2(0, -74);

        foreach (Transform child in slots)
        {
            var slot = child.GetComponent<EquipmentSlotUI>();
            var rt = child as RectTransform;
            if (slot == null || rt == null) continue;
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
            rt.anchorMin = rt.anchorMax = new Vector2(0, 1);
            rt.pivot = new Vector2(0, 1);
            rt.anchoredPosition = new Vector2(16 + col * 82, -18 - row * 82);
            rt.sizeDelta = new Vector2(70, 70);
            rt.localScale = Vector3.one;
            var background = child.GetComponent<Image>();
            if (background == null) background = child.gameObject.AddComponent<Image>();
            background.enabled = true;
            background.color = Inner;
            background.raycastTarget = true;
            if (slot.slotText == null) continue;
            var label = slot.slotText;
            label.rectTransform.anchorMin = Vector2.zero;
            label.rectTransform.anchorMax = Vector2.one;
            label.rectTransform.offsetMin = new Vector2(3, 3);
            label.rectTransform.offsetMax = new Vector2(-3, -3);
            label.enableAutoSizing = true;
            label.fontSizeMin = 9;
            label.fontSizeMax = 12;
            label.alignment = TextAlignmentOptions.Center;
            label.raycastTarget = false;
        }
        Label(panel.transform, "C6Help", "Arraste para equipar ou retirar", 12,
            Vector2.zero, new Vector2(1, 0),
            new Vector2(12, 14), new Vector2(-12, 42),
            TextAlignmentOptions.Center);
    }
}
