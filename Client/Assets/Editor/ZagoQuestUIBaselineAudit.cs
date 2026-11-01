#if UNITY_EDITOR
using System.Text;
using UnityEditor;
using UnityEngine;
using UnityEngine.EventSystems;
using UnityEngine.SceneManagement;
using UnityEngine.UI;

/// <summary>
/// U00: auditoria SOMENTE LEITURA da cena ativa. Nao altera a Hierarchy,
/// componentes, prefabs, player prefs nem grava arquivos.
/// </summary>
public static class ZagoQuestUIBaselineAudit
{
    [MenuItem("ZagoQuest/UI/U00 - Auditar cena aberta (somente leitura)")]
    private static void InspectActiveScene()
    {
        Scene scene = SceneManager.GetActiveScene();
        if (!scene.IsValid() || !scene.isLoaded)
        {
            Debug.LogWarning("[ZQ-UI/U00] Abra a scenebasic antes de auditar.");
            return;
        }

        int gameObjects = 0;
        int missingScripts = 0;
        int canvases = 0;
        int cameras = 0;
        int mainCameras = 0;
        int eventSystems = 0;
        int graphicsWithRaycast = 0;
        int allGraphics = 0;
        bool hasHud = false;
        var log = new StringBuilder();
        log.AppendLine("[ZQ-UI/U00] AUDITORIA SOMENTE LEITURA");
        log.AppendLine("Cena: " + scene.path);
        log.AppendLine("Unity: " + Application.unityVersion);

        foreach (GameObject root in scene.GetRootGameObjects())
        {
            foreach (Transform node in root.GetComponentsInChildren<Transform>(true))
            {
                gameObjects++;
                GameObject go = node.gameObject;
                if (go.name == "HUD") hasHud = true;

                foreach (Component component in go.GetComponents<Component>())
                    if (component == null) missingScripts++;

                if (go.TryGetComponent<Canvas>(out _)) canvases++;
                if (go.TryGetComponent<EventSystem>(out _)) eventSystems++;
                if (go.TryGetComponent<Camera>(out _))
                {
                    cameras++;
                    if (go.CompareTag("MainCamera")) mainCameras++;
                }
                foreach (Graphic graphic in go.GetComponents<Graphic>())
                {
                    allGraphics++;
                    if (graphic.raycastTarget) graphicsWithRaycast++;
                }
            }
        }

        log.AppendLine("GameObjects: " + gameObjects);
        log.AppendLine("HUD encontrado: " + hasHud);
        log.AppendLine("Canvas / Camera / MainCamera: " +
            canvases + " / " + cameras + " / " + mainCameras);
        log.AppendLine("EventSystem: " + eventSystems);
        log.AppendLine("Graphics / raycastTarget ativos: " +
            allGraphics + " / " + graphicsWithRaycast);
        log.AppendLine("Componentes sem script: " + missingScripts);
        log.AppendLine("Observacao: Canvases criados em Play Mode nao aparecem " +
            "na auditoria executada em Edit Mode.");

        if (!scene.path.EndsWith("/scenebasic.unity",
                System.StringComparison.OrdinalIgnoreCase))
            log.AppendLine("ATENCAO: a cena ativa nao e scenebasic.unity.");
        if (!hasHud || missingScripts > 0 || eventSystems != 1 ||
            mainCameras != 1)
            log.AppendLine("ATENCAO: verifique a Hierarchy/Console antes de U02.");

        Debug.Log(log.ToString());
    }
}
#endif
