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
    public static readonly Color Background = C11VisualTheme.Surface;
    public static readonly Color Row = C11VisualTheme.Row;
    public static readonly Color RowAlternate = C11VisualTheme.RowAlternate;
    public static readonly Color Label = C11VisualTheme.Text;
    public static readonly Color Muted = C11VisualTheme.Muted;
    public static readonly Color Gold = C11VisualTheme.Bronze;

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

    /// <summary>Garante rótulo em janela criada a partir da Hierarchy atual.</summary>
    public static TextMeshProUGUI EnsureLabel(Transform parent, string name,
        string value, int fontSize, Color color)
    {
        if (parent == null) return null;
        var existing = parent.Find(name);
        var obj = existing != null ? existing.gameObject :
            new GameObject(name, typeof(RectTransform), typeof(TextMeshProUGUI));
        if (existing == null) obj.transform.SetParent(parent, false);
        var label = obj.GetComponent<TextMeshProUGUI>();
        label.text = value;
        label.fontSize = fontSize;
        label.color = color;
        label.alignment = TextAlignmentOptions.MidlineLeft;
        label.raycastTarget = false;
        return label;
    }

    /// <summary>
    /// Caixa movível ao estilo MMORPG. Configuração/posição é puramente local
    /// via PlayerPrefs; nunca afeta gameplay ou autoridade do servidor.
    /// Não exige modificar a cena, inspector nem prefabs serializados.
    /// </summary>
    public static void MakeDraggable(GameObject panel, string title, string key)
    {
        if (panel == null) return;
        var existing = panel.transform.Find("C6DragHeader");
        var obj = existing != null ? existing.gameObject :
            new GameObject("C6DragHeader", typeof(RectTransform), typeof(Image),
                typeof(C6WindowDragHandle));
        if (existing == null) obj.transform.SetParent(panel.transform, false);
        // Cabeçalho acima das áreas de scroll: de outro modo Loot/Shop
        // capturam o raycast e o jogador não consegue arrastar a janela.
        obj.transform.SetAsLastSibling();
        // Botões existentes precisam continuar clicáveis sobre o cabeçalho.
        var directButtons = panel.GetComponentsInChildren<Button>(true);
        foreach (var button in directButtons)
            if (button.transform.parent == panel.transform)
                button.transform.SetAsLastSibling();
        var rect = obj.GetComponent<RectTransform>();
        rect.anchorMin = new Vector2(0, 1);
        rect.anchorMax = Vector2.one;
        rect.pivot = new Vector2(0.5f, 1);
        rect.offsetMin = new Vector2(0, -29);
        rect.offsetMax = Vector2.zero;
        var image = obj.GetComponent<Image>();
        image.color = new Color32(43, 55, 67, 245);
        image.raycastTarget = true;
        var handle = obj.GetComponent<C6WindowDragHandle>();
        handle.Bind(panel.GetComponent<RectTransform>(), key);
        var label = EnsureLabel(obj.transform, "Title", title, 15, Gold);
        label.alignment = TextAlignmentOptions.Center;
        Place(label.rectTransform, 0.04f, 0, 0.96f, 1);
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

