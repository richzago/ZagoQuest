#if UNITY_EDITOR
using TMPro;
using UnityEditor;
using UnityEngine;
using UnityEngine.UI;

/// <summary>
/// U01: cria assets de design system editáveis, em paths novos.
/// NUNCA altera scene, Prefabs existentes, controllers ou gameplay.
/// Só executa por MenuItem e não sobrescreve assets já criados.
/// </summary>
public static class ZagoQuestUIThemeSetup
{
    private const string Root = "Assets/UI";
    private const string Themes = Root + "/Themes";
    private const string Prefabs = Root + "/Prefabs";
    private const string Shell = Prefabs + "/Shell";
    private const string Widgets = Prefabs + "/Widgets";
    private const string ThemePath = Themes + "/ZagoQuestObsidianBronze.asset";

    [MenuItem("ZagoQuest/UI/U01 - Criar tema e prefabs de exemplo (seguro)")]
    public static void CreateVisualFoundation()
    {
        EnsureFolder("Assets", "UI");
        EnsureFolder(Root, "Themes");
        EnsureFolder(Root, "Prefabs");
        EnsureFolder(Prefabs, "Shell");
        EnsureFolder(Prefabs, "Widgets");

        var theme = AssetDatabase.LoadAssetAtPath<ZagoQuestUIThemeAsset>(ThemePath);
        if (theme == null)
        {
            theme = ScriptableObject.CreateInstance<ZagoQuestUIThemeAsset>();
            AssetDatabase.CreateAsset(theme, ThemePath);
        }

        CreatePanelFrame(theme);
        CreateUtilityIcon(theme);
        CreateProgressBar(theme);
        CreateEquipmentSlot(theme);

        AssetDatabase.SaveAssets();
        AssetDatabase.Refresh();
        Debug.Log("[ZQ-UI/U01] Tokens e prefabs de exemplo prontos em Assets/UI. " +
            "Cena e interface ativa permanecem INALTERADAS. " +
            "Edite o ScriptableObject e Prefabs via Inspector.");
    }

    private static void EnsureFolder(string parent, string name)
    {
        string path = parent + "/" + name;
        if (!AssetDatabase.IsValidFolder(path))
            AssetDatabase.CreateFolder(parent, name);
    }

    private static GameObject RectObject(string name, Transform parent, Color color,
        bool raycast, Vector2 size)
    {
        var obj = new GameObject(name, typeof(RectTransform), typeof(Image));
        if (parent != null) obj.transform.SetParent(parent, false);
        var r = (RectTransform)obj.transform;
        r.sizeDelta = size;
        var image = obj.GetComponent<Image>();
        image.color = color;
        image.raycastTarget = raycast;
        return obj;
    }

    private static void Stretch(RectTransform r, Vector2 min, Vector2 max)
    {
        r.anchorMin = Vector2.zero;
        r.anchorMax = Vector2.one;
        r.offsetMin = min;
        r.offsetMax = max;
    }

    private static void Border(GameObject obj, Color color)
    {
        var outline = obj.AddComponent<Outline>();
        outline.effectColor = color;
        outline.effectDistance = new Vector2(1f, -1f);
        outline.useGraphicAlpha = true;
    }

    private static void SaveNewPrefab(GameObject root, string path)
    {
        if (AssetDatabase.LoadAssetAtPath<GameObject>(path) != null)
        {
            Object.DestroyImmediate(root);
            Debug.Log("[ZQ-UI/U01] Prefab existente preservado: " + path);
            return;
        }

        PrefabUtility.SaveAsPrefabAsset(root, path);
        Object.DestroyImmediate(root);
    }

    private static void CreatePanelFrame(ZagoQuestUIThemeAsset theme)
    {
        var root = RectObject("ZQPanelFrame", null, theme.surface, true,
            new Vector2(230f, 280f));
        Border(root, theme.bronzeDark);

        var header = RectObject("Header", root.transform, theme.recess,
            false, new Vector2(0f, theme.panelHeaderHeight));
        var hr = (RectTransform)header.transform;
        hr.anchorMin = new Vector2(0f, 1f);
        hr.anchorMax = Vector2.one;
        hr.pivot = new Vector2(0.5f, 1f);
        hr.offsetMin = new Vector2(theme.panelPadding, -theme.panelHeaderHeight);
        hr.offsetMax = new Vector2(-theme.panelPadding, -theme.panelPadding * 0.5f);

        var title = new GameObject("Title", typeof(RectTransform),
            typeof(TextMeshProUGUI));
        title.transform.SetParent(header.transform, false);
        var titleRect = (RectTransform)title.transform;
        Stretch(titleRect, new Vector2(8f, 0f), new Vector2(-8f, 0f));
        var label = title.GetComponent<TextMeshProUGUI>();
        label.text = "PANEL";
        label.fontSize = 13f;
        if (theme.titleFont != null) label.font = theme.titleFont;
        label.fontStyle = FontStyles.Bold;
        label.color = theme.bronzeLight;
        label.alignment = TextAlignmentOptions.MidlineLeft;
        label.raycastTarget = false;

        var content = new GameObject("Content", typeof(RectTransform));
        content.transform.SetParent(root.transform, false);
        Stretch((RectTransform)content.transform,
            new Vector2(theme.panelPadding, theme.panelPadding),
            new Vector2(-theme.panelPadding,
                -theme.panelHeaderHeight - theme.panelPadding));
        SaveNewPrefab(root, Shell + "/ZQPanelFrame.prefab");
    }

    private static void CreateUtilityIcon(ZagoQuestUIThemeAsset theme)
    {
        float size = theme.utilityIconSize;
        var root = RectObject("ZQIconButton", null, theme.recess, true,
            new Vector2(size, size));
        Border(root, theme.bronzeDark);
        var button = root.AddComponent<Button>();
        button.targetGraphic = root.GetComponent<Image>();
        button.transition = Selectable.Transition.ColorTint;
        var colors = button.colors;
        colors.normalColor = Color.white;
        colors.highlightedColor = theme.bronzeLight;
        colors.pressedColor = theme.bronze;
        colors.selectedColor = theme.cyanAccent;
        colors.disabledColor = new Color32(90, 94, 98, 160);
        button.colors = colors;

        var icon = RectObject("IconSprite", root.transform, Color.white, false,
            new Vector2(16f, 16f));
        var iconR = (RectTransform)icon.transform;
        iconR.anchorMin = iconR.anchorMax = new Vector2(0.5f, 0.5f);
        iconR.anchoredPosition = Vector2.zero;
        var image = icon.GetComponent<Image>();
        image.sprite = null;
        image.enabled = false; // conectar sprite original no Inspector
        SaveNewPrefab(root, Widgets + "/ZQIconButton.prefab");
    }

    private static void CreateProgressBar(ZagoQuestUIThemeAsset theme)
    {
        var root = RectObject("ZQProgressBar", null, theme.recess, false,
            new Vector2(185f, Mathf.Max(4f, theme.progressBarHeight)));
        Border(root, theme.bronzeDark);

        var fill = RectObject("Fill", root.transform, theme.skillProgress,
            false, new Vector2(0f, 0f));
        Stretch((RectTransform)fill.transform, Vector2.zero, Vector2.zero);
        var image = fill.GetComponent<Image>();
        image.type = Image.Type.Filled;
        image.fillMethod = Image.FillMethod.Horizontal;
        image.fillOrigin = (int)Image.OriginHorizontal.Left;
        image.fillAmount = 0.65f; // apenas PREVIEW do prefab, sem dado de servidor
        SaveNewPrefab(root, Widgets + "/ZQProgressBar.prefab");
    }

    private static void CreateEquipmentSlot(ZagoQuestUIThemeAsset theme)
    {
        var root = RectObject("ZQEquipmentSlotVisual", null, theme.recess, true,
            new Vector2(theme.equipmentSlotSize, theme.equipmentSlotSize));
        Border(root, theme.bronzeDark);
        var image = RectObject("ItemIcon", root.transform, Color.white, false,
            new Vector2(0f, 0f));
        Stretch((RectTransform)image.transform,
            new Vector2(3f, 3f), new Vector2(-3f, -3f));
        image.GetComponent<Image>().enabled = false;
        // Somente visual. EquipmentSlotUI REAL sera integrado em U04;
        // aqui nao cria manager, enum, item ficticio ou drag/drop duplicado.
        SaveNewPrefab(root, Widgets + "/ZQEquipmentSlotVisual.prefab");
    }
}
#endif
