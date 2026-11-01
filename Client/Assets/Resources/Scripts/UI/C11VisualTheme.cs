using UnityEngine;
using UnityEngine.UI;

/// <summary>
/// ZagoQuest / Obsidian & Bronze — identidade original.
/// Inspiração estrutural: MMO clássico com painéis compactos e bordas
/// metálicas; não reutiliza arte, sprites, marcas ou assets do Cyleria.
/// O sistema não controla input, servidor ou cenas.
/// </summary>
public static class C11VisualTheme
{
    public static readonly Color32 Surface = new Color32(16, 19, 24, 248);
    public static readonly Color32 Recess = new Color32(23, 28, 34, 248);
    public static readonly Color32 Row = new Color32(30, 36, 43, 248);
    public static readonly Color32 RowAlternate = new Color32(36, 42, 49, 248);
    public static readonly Color32 Bronze = new Color32(151, 115, 65, 252);
    public static readonly Color32 BronzeDark = new Color32(84, 63, 42, 245);
    public static readonly Color32 Accent = new Color32(108, 165, 172, 255);
    public static readonly Color32 Text = new Color32(231, 226, 213, 255);
    public static readonly Color32 Muted = new Color32(163, 170, 170, 255);

    /// <summary>Contorno fino, sem criar superfície de raycast extra.</summary>
    public static void Frame(GameObject go)
    {
        if (go == null) return;
        var outline = go.GetComponent<Outline>();
        if (outline == null) outline = go.AddComponent<Outline>();
        outline.effectColor = BronzeDark;
        outline.effectDistance = new Vector2(1f, -1f);
        outline.useGraphicAlpha = true;
    }

    public static void StyleButton(Button button)
    {
        if (button == null) return;
        if (button.TryGetComponent<Image>(out var image)) image.color = Recess;
        Frame(button.gameObject);
        var colors = button.colors;
        colors.normalColor = Color.white;
        colors.highlightedColor = new Color32(217, 205, 175, 255);
        colors.pressedColor = new Color32(175, 152, 116, 255);
        colors.disabledColor = new Color32(100, 105, 109, 170);
        button.colors = colors;
    }
}
