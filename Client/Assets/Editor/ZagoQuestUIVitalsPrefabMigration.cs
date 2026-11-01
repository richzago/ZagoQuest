#if UNITY_EDITOR
using System;
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;
using UnityEngine.SceneManagement;

/// <summary>
/// U02-B: converte o TopCenter REAL em Prefab conectado, sem clonar HUD
/// ou criar outro PlayerHUD. Mantem os sliders/TMP e referencias da scene.
/// Executa somente por menu e somente depois de revisao no Editor.
/// </summary>
public static class ZagoQuestUIVitalsPrefabMigration
{
    private const string Folder = "Assets/UI/Prefabs/Panels";
    private const string PrefabPath = Folder + "/ZQPlayerVitals.prefab";

    [MenuItem("ZagoQuest/UI/U02 - 3. Converter TopCenter REAL em Prefab")]
    public static void ConvertTopCenter()
    {
        if (Application.isPlaying)
        {
            Debug.LogWarning("[U02-B] Saia do Play Mode antes de migrar.");
            return;
        }

        Scene scene = SceneManager.GetActiveScene();
        if (!scene.IsValid() || !scene.isLoaded ||
            !scene.path.EndsWith("/scenebasic.unity",
                StringComparison.OrdinalIgnoreCase))
        {
            Debug.LogError("[U02-B] Abra Assets/scenebasic.unity em Edit Mode.");
            return;
        }

        GameObject hudRoot = null;
        foreach (GameObject root in scene.GetRootGameObjects())
        {
            Canvas canvas = root.GetComponentInChildren<Canvas>(true);
            if (canvas != null && canvas.gameObject.name == "HUD")
            {
                hudRoot = canvas.gameObject;
                break;
            }
        }

        if (hudRoot == null)
        {
            Debug.LogError("[U02-B] Canvas HUD original nao encontrado.");
            return;
        }

        PlayerHUD hud = hudRoot.GetComponent<PlayerHUD>();
        Transform topCenter = hudRoot.transform.Find("TopCenter");
        if (hud == null || topCenter == null ||
            hud.playerNameText == null || hud.hpSlider == null ||
            hud.manaSlider == null || hud.xpSlider == null ||
            hud.hpText == null || hud.manaText == null ||
            hud.levelText == null || hud.xpText == null)
        {
            Debug.LogError("[U02-B] PlayerHUD, TopCenter ou bindings " +
                "HP/MP/XP incompletos. Nenhum objeto foi modificado.");
            return;
        }

        if (hud.playerNameText.transform.parent != topCenter ||
            !hud.hpSlider.transform.IsChildOf(topCenter) ||
            !hud.manaSlider.transform.IsChildOf(topCenter) ||
            !hud.xpSlider.transform.IsChildOf(topCenter))
        {
            Debug.LogError("[U02-B] Hierarchy de PlayerBars difere da " +
                "baseline U00. Migracao abortada sem alteracoes.");
            return;
        }

        if (PrefabUtility.IsPartOfPrefabInstance(topCenter.gameObject) ||
            AssetDatabase.LoadAssetAtPath<GameObject>(PrefabPath) != null)
        {
            Debug.LogWarning("[U02-B] TopCenter ou Prefab de destino ja " +
                "foi convertido. Nao sobrescrever, nao criar duplicata.");
            return;
        }

        if (!EditorUtility.DisplayDialog(
            "ZagoQuest U02-B",
            "Converter o TopCenter REAL em um Prefab editavel?\n\n" +
            "O menu aplica UMA VEZ o layout legado no Editor, conecta o " +
            "GameObject existente ao Prefab e desativa apenas a " +
            "reestilizacao do PlayerHUD.Start.\n\n" +
            "O HUD, sliders, textos e snapshots permanecem os mesmos. " +
            "A cena deve ser salva e testada antes de commit.",
            "Converter", "Cancelar"))
            return;

        if (!AssetDatabase.IsValidFolder("Assets/UI/Prefabs/Panels"))
        {
            if (!AssetDatabase.IsValidFolder("Assets/UI/Prefabs"))
            {
                Debug.LogError("[U02-B] Pasta U01 ausente. Abortando.");
                return;
            }
            AssetDatabase.CreateFolder("Assets/UI/Prefabs", "Panels");
        }

        Undo.RegisterFullObjectHierarchyUndo(topCenter.gameObject,
            "U02-B estilizar TopCenter antes da conversao");
        Undo.RecordObject(hud, "U02-B manter visuais do Prefab em runtime");

        // Captura a aparencia ja aprovada como baseline, ainda dentro
        // do TopCenter REAL, sem prefab clone e sem alterar PlayerHUD bindings.
        hud.ApplyLegacyVitalsLayoutForEditor();

        GameObject connected = PrefabUtility.SaveAsPrefabAssetAndConnect(
            topCenter.gameObject, PrefabPath, InteractionMode.UserAction);
        if (connected == null)
        {
            Debug.LogError("[U02-B] Falha ao converter para Prefab. " +
                "Revise a scene com Undo antes de repetir.");
            return;
        }

        SerializedObject player = new SerializedObject(hud);
        SerializedProperty flag = player.FindProperty("useInspectorVitalsLayout");
        if (flag == null)
        {
            Debug.LogError("[U02-B] Flag de layout serializado ausente. " +
                "Reverta no Editor; NAO comite a cena.");
            return;
        }
        flag.boolValue = true;
        player.ApplyModifiedProperties();

        EditorUtility.SetDirty(hud);
        EditorSceneManager.MarkSceneDirty(scene);
        AssetDatabase.SaveAssets();

        Debug.Log("[U02-B] TopCenter REAL conectado ao Prefab " +
            PrefabPath + ". Nao foi criado outro PlayerHUD. " +
            "Salve a scene (Ctrl+S), valide bindings/HP/MP/XP " +
            "e teste Play Mode antes do commit.");
    }

    [MenuItem("ZagoQuest/UI/U02 - 4. Verificar migracao de vitais")]
    public static void ValidateVitals()
    {
        Scene scene = SceneManager.GetActiveScene();
        if (!scene.IsValid() || !scene.isLoaded) return;

        PlayerHUD hud = null;
        foreach (var root in scene.GetRootGameObjects())
        {
            var item = root.GetComponentInChildren<PlayerHUD>(true);
            if (item != null) { hud = item; break; }
        }
        if (hud == null)
        {
            Debug.LogError("[U02-B] PlayerHUD ausente.");
            return;
        }

        Transform topCenter = hud.VitalsVisualRoot;
        bool connected = topCenter != null &&
            PrefabUtility.IsPartOfPrefabInstance(topCenter.gameObject);
        bool bars = topCenter != null &&
            hud.hpSlider != null && hud.manaSlider != null &&
            hud.xpSlider != null &&
            hud.hpSlider.transform.IsChildOf(topCenter) &&
            hud.manaSlider.transform.IsChildOf(topCenter) &&
            hud.xpSlider.transform.IsChildOf(topCenter);
        int total = 0;
        foreach (GameObject root in scene.GetRootGameObjects())
            total += root.GetComponentsInChildren<PlayerHUD>(true).Length;

        string result = "Prefab conectado: " + connected +
            " | Bindings HP/MP/XP: " + bars +
            " | Usar Inspector: " + hud.UsesInspectorVitalsLayout +
            " | PlayerHUD(s): " + total;
        if (connected && bars && total == 1 &&
            hud.UsesInspectorVitalsLayout)
            Debug.Log("[U02-B] OK — " + result);
        else
            Debug.LogWarning("[U02-B] REVISAO NECESSARIA — " + result);
    }
}
#endif
