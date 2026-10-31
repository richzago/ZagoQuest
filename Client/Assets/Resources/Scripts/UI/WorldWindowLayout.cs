using TMPro;
using UnityEngine;
using UnityEngine.UI;

/// <summary>
/// C5: layout responsivo para janelas do mundo. Não altera prefabs de mapa,
/// EventSystem, a cena serializada nem decisões do servidor.
/// Os componentes são configurados uma vez em Awake/Start; o conteúdo é
/// gerenciado por um único VerticalLayoutGroup e ScrollRect existente.
/// </summary>
public static class WorldWindowLayout
{
    public static readonly Color Background = new Color32(20, 29, 42, 246);
    public static readonly Color Row = new Color32(34, 47, 61, 242);
    public static readonly Color RowAlternate = new Color32(40, 55, 70, 242);
    public static readonly Color Label = new Color32(235, 233, 226, 255);
    public static readonly Color Muted = new Color32(181, 196, 207, 255);
    public static readonly Color Gold = new Color32(235, 190, 107, 255);

    public static void PreparePanel(GameObject panel, float width, float height)
    {
        if (panel == null) return;
        var rect = panel.GetComponent<RectTransform>();
        if (rect != null)
        {
            rect.anchorMin = rect.anchorMax = new Vector2(0.5f, 0.5f);
            rect.pivot = new Vector2(0.5f, 0.5f);
            rect.anchoredPosition = Vector2.zero;
            rect.sizeDelta = new Vector2(width, height);
        }
        var image = panel.GetComponent<Image>();
        if (image != null) image.color = Background;
    }

    public static void PrepareList(Transform container)
    {
        if (container == null) return;
        var rect = container as RectTransform;
        if (rect == null) return;

        var group = container.GetComponent<VerticalLayoutGroup>();
        if (group == null) group = container.gameObject.AddComponent<VerticalLayoutGroup>();
        group.padding = new RectOffset(8, 8, 8, 8);
        group.spacing = 8;
        group.childAlignment = TextAnchor.UpperCenter;
        group.childControlWidth = true;
        group.childControlHeight = true;
        group.childForceExpandWidth = true;
        group.childForceExpandHeight = false;

        var fitter = container.GetComponent<ContentSizeFitter>();
        if (fitter == null) fitter = container.gameObject.AddComponent<ContentSizeFitter>();
        fitter.horizontalFit = ContentSizeFitter.FitMode.Unconstrained;
        fitter.verticalFit = ContentSizeFitter.FitMode.PreferredSize;

        rect.anchorMin = new Vector2(0, 1);
        rect.anchorMax = new Vector2(1, 1);
        rect.pivot = new Vector2(0.5f, 1);
        rect.anchoredPosition = Vector2.zero;
        rect.sizeDelta = new Vector2(0, rect.sizeDelta.y);

        var scroll = container.GetComponentInParent<ScrollRect>();
        if (scroll != null)
        {
            scroll.content = rect;
            scroll.horizontal = false;
            scroll.vertical = true;
            scroll.movementType = ScrollRect.MovementType.Clamped;
            scroll.scrollSensitivity = 28f;
        }
    }

    public static void PrepareRow(GameObject rowObject, float height, bool alternate)
    {
        if (rowObject == null) return;
        var rect = rowObject.GetComponent<RectTransform>();
        if (rect != null)
        {
            rect.anchorMin = new Vector2(0, 1);
            rect.anchorMax = new Vector2(1, 1);
            rect.pivot = new Vector2(0.5f, 1);
            rect.anchoredPosition = Vector2.zero;
            rect.sizeDelta = new Vector2(0, height);
            rect.localScale = Vector3.one;
        }
        var layout = rowObject.GetComponent<LayoutElement>();
        if (layout == null) layout = rowObject.AddComponent<LayoutElement>();
        layout.minHeight = height;
        layout.preferredHeight = height;
        layout.flexibleHeight = 0;
        var image = rowObject.GetComponent<Image>();
        if (image == null) image = rowObject.AddComponent<Image>();
        image.color = alternate ? RowAlternate : Row;
        image.raycastTarget = true;
    }

    public static void Place(TextMeshProUGUI text, float x0, float y0, float x1, float y1, int size, Color color)
    {
        if (text == null) return;
        var rect = text.rectTransform;
        rect.anchorMin = new Vector2(x0, y0);
        rect.anchorMax = new Vector2(x1, y1);
        rect.offsetMin = Vector2.zero;
        rect.offsetMax = Vector2.zero;
        rect.localScale = Vector3.one;
        text.fontSize = size;
        text.enableAutoSizing = true;
        text.fontSizeMin = Mathf.Max(11, size - 3);
        text.fontSizeMax = size;
        text.color = color;
        text.alignment = TextAlignmentOptions.MidlineLeft;
        // Labels must not intercept pointer events intended for the row/button.
        text.raycastTarget = false;
    }

    public static void Place(RectTransform rect, float x0, float y0, float x1, float y1)
    {
        if (rect == null) return;
        rect.anchorMin = new Vector2(x0, y0);
        rect.anchorMax = new Vector2(x1, y1);
        rect.offsetMin = Vector2.zero;
        rect.offsetMax = Vector2.zero;
        rect.localScale = Vector3.one;
    }

    public static void StyleButton(Button button)
    {
        if (button == null) return;
        var image = button.GetComponent<Image>();
        if (image != null) image.color = new Color32(55, 73, 88, 255);
        var colors = button.colors;
        colors.normalColor = Color.white;
        colors.highlightedColor = new Color32(210, 226, 235, 255);
        colors.pressedColor = new Color32(195, 163, 114, 255);
        colors.selectedColor = Color.white;
        colors.disabledColor = new Color32(112, 119, 125, 145);
        button.colors = colors;
        foreach (var text in button.GetComponentsInChildren<TextMeshProUGUI>(true))
        {
            text.color = Label;
            text.raycastTarget = false;
            text.fontSize = Mathf.Min(17f, text.fontSize);
        }
    }
}
