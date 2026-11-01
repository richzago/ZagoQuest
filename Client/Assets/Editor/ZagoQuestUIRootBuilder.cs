#if UNITY_EDITOR
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;
using UnityEngine.SceneManagement;

/// <summary>
/// U02: gera somente um prefab de Hierarchy inativo.
/// Nao modifica a cena aberta, nem substitui a UI em execucao.
/// </summary>
public static class ZagoQuestUIRootBuilder
{
    public const string PrefabPath =
        "Assets/UI/Prefabs/Shell/ZQ_UIRoot_LayoutPreview.prefab";
    private const string ThemePath =
        "Assets/UI/Themes/ZagoQuestObsidianBronze.asset";

    [MenuItem("ZagoQuest/UI/U02 - 1. Criar prefab de Hierarchy")]
    public static void Build()
    {
        if (Application.isPlaying)
        {
            Debug.LogWarning("[U02] Saia do Play Mode.");
            return;
        }
        if (AssetDatabase.LoadAssetAtPath<GameObject>(PrefabPath) != null)
        {
            Debug.Log("[U02] Prefab ja existe; nada foi sobrescrito.");
            return;
        }

        var theme = AssetDatabase.LoadAssetAtPath<ZagoQuestUIThemeAsset>(ThemePath);
        if (theme == null)
        {
            Debug.LogError("[U02] Execute U01 antes. Tema ausente: " + ThemePath);
            return;
        }

        Scene temporaryScene = EditorSceneManager.NewPreviewScene();
        try
        {
            var root = new GameObject("ZQ_UIRoot_LayoutPreview",
                typeof(RectTransform), typeof(ZagoQuestUIComposition));
            SceneManager.MoveGameObjectToScene(root, temporaryScene);
            Fill((RectTransform)root.transform);
            root.SetActive(false);

            var left = Dock(root.transform, "LeftDockRoot", true);
            var right = Dock(root.transform, "RightDockRoot", false);
            var leftColumns = Columns(left, "Left", true);
            var rightColumns = Columns(right, "Right", false);
            var center = Child(root.transform, "CenterHudRoot");
            var bottom = Child(root.transform, "BottomRoot");
            bottom.anchorMin = Vector2.zero;
            bottom.anchorMax = new Vector2(1f, 0f);
            bottom.pivot = new Vector2(.5f, 0f);
            bottom.sizeDelta = new Vector2(0f, 160f);
            bottom.anchoredPosition = Vector2.zero;
            var modal = Child(root.transform, "ModalRoot");
            var tooltip = Child(root.transform, "TooltipRoot");

            root.GetComponent<ZagoQuestUIComposition>().Configure(
                theme, left, right, center, bottom, modal, tooltip,
                leftColumns, rightColumns);

            if (PrefabUtility.SaveAsPrefabAsset(root, PrefabPath) == null)
            {
                Debug.LogError("[U02] Falha ao salvar prefab.");
                return;
            }
            AssetDatabase.SaveAssets();
            Debug.Log("[U02] Prefab inativo criado: " + PrefabPath);
        }
        finally
        {
            EditorSceneManager.ClosePreviewScene(temporaryScene);
        }
    }

    private static RectTransform Child(Transform parent, string name)
    {
        var obj = new GameObject(name, typeof(RectTransform));
        obj.transform.SetParent(parent, false);
        var rect = (RectTransform)obj.transform;
        Fill(rect);
        return rect;
    }

    private static RectTransform Dock(Transform parent, string name, bool left)
    {
        var rect = Child(parent, name);
        float x = left ? 0f : 1f;
        rect.anchorMin = new Vector2(x, 0f);
        rect.anchorMax = new Vector2(x, 1f);
        rect.pivot = new Vector2(x, .5f);
        rect.anchoredPosition = Vector2.zero;
        rect.sizeDelta = Vector2.zero;
        return rect;
    }

    private static RectTransform[] Columns(Transform parent,
        string prefix, bool left)
    {
        var result = new RectTransform[3];
        float x = left ? 0f : 1f;
        for (int i = 0; i < result.Length; i++)
        {
            var rect = Child(parent, prefix + "Column" + (i + 1));
            rect.anchorMin = new Vector2(x, 0f);
            rect.anchorMax = new Vector2(x, 1f);
            rect.pivot = new Vector2(x, .5f);
            rect.anchoredPosition = new Vector2(
                (left ? 1f : -1f) * i * 180f, 0f);
            rect.sizeDelta = new Vector2(172f, -8f);
            result[i] = rect;
        }
        return result;
    }

    private static void Fill(RectTransform rect)
    {
        rect.anchorMin = Vector2.zero;
        rect.anchorMax = Vector2.one;
        rect.pivot = new Vector2(.5f, .5f);
        rect.offsetMin = rect.offsetMax = Vector2.zero;
        rect.localScale = Vector3.one;
    }
}
#endif
