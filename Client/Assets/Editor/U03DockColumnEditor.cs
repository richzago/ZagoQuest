#if UNITY_EDITOR
using System;
using TMPro;
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;
using UnityEngine.SceneManagement;
using UnityEngine.UI;

/// <summary>
/// U03-A: gera a moldura visual da coluna e configura opt-in
/// no Canvas HUD existente. Nao cria Canvas/Camera/controller ou itens.
/// </summary>
public static class U03DockColumnEditor
{
    public const string PrefabPath =
        "Assets/UI/Prefabs/Shell/ZQDockColumn.prefab";
    private const string ThemePath =
        "Assets/UI/Themes/ZagoQuestObsidianBronze.asset";

    [MenuItem("ZagoQuest/UI/U03 - 1. Criar prefab editavel de coluna")]
    public static void CreateDockPrefab()
    {
        if (Application.isPlaying)
        {
            Debug.LogWarning("[U03] Saia do Play Mode.");
            return;
        }
        if (AssetDatabase.LoadAssetAtPath<GameObject>(PrefabPath) != null)
        {
            Debug.Log("[U03] Prefab existente preservado (sem sobrescrita): " +
                PrefabPath);
            return;
        }

        var theme = AssetDatabase.LoadAssetAtPath<ZagoQuestUIThemeAsset>(ThemePath);
        if (theme == null || !AssetDatabase.IsValidFolder("Assets/UI/Prefabs/Shell"))
        {
            Debug.LogError("[U03] Tema e pasta Shell da U01 ausentes.");
            return;
        }

        Scene preview = EditorSceneManager.NewPreviewScene();
        try
        {
            var root = new GameObject("ZQDockColumn",
                typeof(RectTransform), typeof(Image), typeof(Outline));
            SceneManager.MoveGameObjectToScene(root, preview);

            var rect = (RectTransform)root.transform;
            rect.sizeDelta = new Vector2(172f, 600f);
            rect.pivot = new Vector2(0f, 0.5f);
            rect.localScale = Vector3.one;

            var image = root.GetComponent<Image>();
            image.color = theme.surface;
            image.raycastTarget = true; // rail visivel, fora do mundo

            var outline = root.GetComponent<Outline>();
            outline.effectColor = theme.bronzeDark;
            outline.effectDistance = new Vector2(1f, -1f);
            outline.useGraphicAlpha = true;

            var header = new GameObject("Header",
                typeof(RectTransform), typeof(Image));
            header.transform.SetParent(root.transform, false);
            var hr = (RectTransform)header.transform;
            hr.anchorMin = new Vector2(0f, 1f);
            hr.anchorMax = Vector2.one;
            hr.pivot = new Vector2(0.5f, 1f);
            hr.offsetMin = new Vector2(4f, -34f);
            hr.offsetMax = new Vector2(-4f, -4f);
            var headerImage = header.GetComponent<Image>();
            headerImage.color = theme.recess;
            headerImage.raycastTarget = false;

            var titleObj = new GameObject("LaneTitle",
                typeof(RectTransform), typeof(TextMeshProUGUI));
            titleObj.transform.SetParent(root.transform, false);
            var titleRect = (RectTransform)titleObj.transform;
            titleRect.anchorMin = new Vector2(0f, 1f);
            titleRect.anchorMax = Vector2.one;
            titleRect.offsetMin = new Vector2(6f, -32f);
            titleRect.offsetMax = new Vector2(-6f, -5f);
            var title = titleObj.GetComponent<TextMeshProUGUI>();
            title.text = "PAINEL LATERAL";
            title.fontSize = 11f;
            if (theme.titleFont != null) title.font = theme.titleFont;
            title.color = theme.bronzeLight;
            title.alignment = TextAlignmentOptions.Center;
            title.raycastTarget = false;

            var content = new GameObject("ContentHost",
                typeof(RectTransform), typeof(RectMask2D));
            content.transform.SetParent(root.transform, false);
            var host = (RectTransform)content.transform;
            host.anchorMin = Vector2.zero;
            host.anchorMax = Vector2.one;
            host.offsetMin = new Vector2(4f, 4f);
            host.offsetMax = new Vector2(-4f, -36f);

            if (PrefabUtility.SaveAsPrefabAsset(root, PrefabPath) == null)
                Debug.LogError("[U03] Falha ao salvar prefab.");
            else
            {
                AssetDatabase.SaveAssets();
                Debug.Log("[U03] Criado " + PrefabPath +
                    ". Edite no Prefab Mode. Ainda nao altera o jogo.");
            }
        }
        finally
        {
            EditorSceneManager.ClosePreviewScene(preview);
        }
    }

    [MenuItem("ZagoQuest/UI/U03 - 2. Habilitar prefab de colunas na scenebasic")]
    public static void EnableInScene()
    {
        if (Application.isPlaying)
        {
            Debug.LogWarning("[U03] Saia do Play Mode.");
            return;
        }

        Scene scene = SceneManager.GetActiveScene();
        if (!scene.IsValid() || !scene.isLoaded ||
            !scene.path.EndsWith("/scenebasic.unity",
                StringComparison.OrdinalIgnoreCase))
        {
            Debug.LogError("[U03] Abra Assets/scenebasic.unity antes.");
            return;
        }

        GameObject prefab = AssetDatabase.LoadAssetAtPath<GameObject>(PrefabPath);
        if (prefab == null || prefab.transform.Find("ContentHost") == null ||
            prefab.GetComponent<RectTransform>() == null)
        {
            Debug.LogError("[U03] Execute o comando U03 - 1 e confira o prefab.");
            return;
        }

        Canvas hud = null;
        foreach (GameObject root in scene.GetRootGameObjects())
        {
            foreach (Canvas candidate in root.GetComponentsInChildren<Canvas>(true))
            {
                if (candidate.gameObject.name == "HUD")
                {
                    hud = candidate;
                    break;
                }
            }
            if (hud != null) break;
        }
        if (hud == null)
        {
            Debug.LogError("[U03] Canvas HUD nao encontrado. Nada mudou.");
            return;
        }

        var config = hud.GetComponent<U03DockColumnConfig>();
        if (config != null)
        {
            Debug.Log("[U03] Configuracao ja instalada; " +
                "as escolhas atuais do Inspector foram preservadas.");
            return;
        }

        if (!EditorUtility.DisplayDialog("ZagoQuest U03",
            "Usar o novo Prefab de colunas nas barras laterais EXISTENTES?\n\n" +
            "O layout do C10 e os dados de Backpack/Loot permanecem os mesmos. " +
            "Apenas as superficies das colunas extras serao instanciadas " +
            "a partir do Prefab editavel. Salve e teste antes de commitar.",
            "Habilitar", "Cancelar"))
            return;

        config = Undo.AddComponent<U03DockColumnConfig>(hud.gameObject);
        var so = new SerializedObject(config);
        so.FindProperty("dockColumnPrefab").objectReferenceValue = prefab;
        so.FindProperty("useAuthoredColumns").boolValue = true;
        so.ApplyModifiedProperties();
        EditorUtility.SetDirty(config);
        EditorSceneManager.MarkSceneDirty(scene);
        Debug.Log("[U03] Configuracao visual adicionada no Canvas HUD. " +
            "Salve Ctrl+S e rode Play Mode. O modo pode ser desmarcado " +
            "no Inspector sem remover o componente.");
    }
}
#endif
