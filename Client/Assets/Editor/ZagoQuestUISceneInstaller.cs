#if UNITY_EDITOR
using System;
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;
using UnityEngine.SceneManagement;

/// <summary>
/// U02: instala uma instancia DESATIVADA do prefab dentro do HUD original.
/// Nao duplica Canvas, managers, cameras, input nem elementos funcionais.
/// </summary>
public static class ZagoQuestUISceneInstaller
{
    [MenuItem("ZagoQuest/UI/U02 - 2. Instalar estrutura INATIVA na scenebasic")]
    public static void Install()
    {
        if (Application.isPlaying)
        {
            Debug.LogWarning("[U02] Saia do Play Mode antes de instalar.");
            return;
        }

        Scene scene = SceneManager.GetActiveScene();
        if (!scene.IsValid() || !scene.isLoaded ||
            !scene.path.EndsWith("/scenebasic.unity",
                StringComparison.OrdinalIgnoreCase))
        {
            Debug.LogError("[U02] Abra Assets/scenebasic.unity para instalar.");
            return;
        }

        GameObject prefab = AssetDatabase.LoadAssetAtPath<GameObject>(
            ZagoQuestUIRootBuilder.PrefabPath);
        if (prefab == null)
        {
            Debug.LogError("[U02] Execute primeiro o menu U02 - 1.");
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
            Debug.LogError("[U02] Canvas HUD nao encontrado. Nada foi alterado.");
            return;
        }

        const string name = "ZQ_UIRoot_LayoutPreview";
        if (hud.transform.Find(name) != null)
        {
            Debug.Log("[U02] Instancia ja presente; nao sera duplicada.");
            return;
        }

        var go = PrefabUtility.InstantiatePrefab(prefab, hud.transform)
            as GameObject;
        if (go == null)
        {
            Debug.LogError("[U02] Nao foi possivel instanciar o prefab.");
            return;
        }

        go.name = name;
        go.SetActive(false);
        Undo.RegisterCreatedObjectUndo(go, "Instalar estrutura de UI U02");
        EditorSceneManager.MarkSceneDirty(scene);
        Debug.Log("[U02] Estrutura INATIVA instalada em HUD/" +
            name + ". Salve a cena com Ctrl+S.");
    }
}
#endif
