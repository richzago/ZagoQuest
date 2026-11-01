using UnityEngine;

/// <summary>
/// C8/2A hotfix de visibilidade: reserva a coluna direita para a sidebar,
/// reduzindo SOMENTE o viewport da camera principal ja existente.
/// Nao cria Cameras, RenderTextures, tilemaps, layers nem altera zoom/follow.
/// A coordenada e medida em PIXELS da SidebarSurface real: funciona no F10.
/// </summary>
[DisallowMultipleComponent]
public sealed class C8PlayfieldViewport : MonoBehaviour
{
    private C8SidebarShell sidebar;
    private Camera worldCamera;
    private Rect initialViewport;
    private bool originalCaptured;
    private bool applied;
    private float lastWidth = -1f;
    private float lastStart = -1f;
    private int lastScreenWidth = -1;
    private int lastScreenHeight = -1;
    private readonly Vector3[] worldCorners = new Vector3[4];

    private void Awake()
    {
        sidebar = GetComponent<C8SidebarShell>();
    }

    private void LateUpdate()
    {
        if (sidebar == null) sidebar = GetComponent<C8SidebarShell>();
        var network = NetworkManager.Instance;
        if (sidebar == null || sidebar.SidebarSurface == null ||
            network == null || !network.isConnected ||
            !sidebar.SidebarSurface.gameObject.activeInHierarchy)
        {
            RestoreViewport();
            return;
        }
        if (worldCamera == null)
        {
            worldCamera = Camera.main;
            originalCaptured = false;
        }
        if (worldCamera == null || !worldCamera.orthographic ||
            worldCamera.targetTexture != null || Screen.width <= 0 || Screen.height <= 0)
            return;

        if (!originalCaptured)
        {
            initialViewport = worldCamera.rect;
            originalCaptured = true;
        }

        // Overlay Canvas: os cantos do RectTransform estao em unidades
        // de tela. WorldToScreenPoint(null, ..) evita supor escala 100%:
        // o F10 altera o CanvasScaler, mas nao a coordenada real da barra.
        sidebar.SidebarSurface.GetWorldCorners(worldCorners);
        float leftEdgePx = RectTransformUtility.WorldToScreenPoint(null, worldCorners[0]).x;
        if (float.IsNaN(leftEdgePx) || float.IsInfinity(leftEdgePx)) return;

        // C10 pode reservar até três colunas de cada lado.
        // A câmera principal é recortada dos DOIS lados, sem câmera extra.
        float leftReserved = 0f, rightExtra = 0f;
        if (C10ClientLayoutSettings.Instance != null)
            C10ClientLayoutSettings.Instance.GetPixelMargins(out leftReserved,out rightExtra);
        float rightReserved = Mathf.Max(Screen.width - leftEdgePx,rightExtra);
        float availableWidth = Mathf.Max(1f,Screen.width-leftReserved-rightReserved);
        float viewportStart = leftReserved / Screen.width;
        float viewportWidth = availableWidth / Screen.width;
        if (viewportWidth < 0.30f)
        {
            // Uma Game View extremamente estreita nao e validavel para
            // gameplay. Preferir mundo inteiro a um viewport degenerado.
            RestoreViewport();
            return;
        }

        if (applied && lastScreenWidth == Screen.width &&
            lastScreenHeight == Screen.height &&
            Mathf.Abs(lastWidth - viewportWidth) < 0.0005f &&
            Mathf.Abs(lastStart - viewportStart) < 0.0005f)
            return;

        // Somente Camera.main recebe o recorte. Nao editar CameraFollow
        // nem instanciar outra Camera: evita o "mapa fantasma" do C7.1.
        worldCamera.rect = new Rect(viewportStart, 0f, viewportWidth, 1f);
        // A projecao precisa corresponder ao NOVO retangulo real para
        // impedir esticamento do mapa e manter ClampToWorld correto.
        worldCamera.aspect = availableWidth / Screen.height;
        applied = true;
        lastWidth = viewportWidth;
        lastStart = viewportStart;
        lastScreenWidth = Screen.width;
        lastScreenHeight = Screen.height;

#if UNITY_EDITOR
        Debug.Log($"[C8Viewport] Camera principal usa {availableWidth:F0}/{Screen.width}px " +
            $"(area jogavel {viewportWidth:P1}); sidebar fora do mundo, F10 respeitado.");
#endif
    }

    private void RestoreViewport()
    {
        if (!applied || worldCamera == null) return;
        if (originalCaptured) worldCamera.rect = initialViewport;
        // A Camera da cena usa aspecto automatico; ResetAspect desativa
        // o override usado enquanto o dock estava presente.
        worldCamera.ResetAspect();
        applied = false;
        lastWidth = -1f;
        lastStart = -1f;
        lastScreenWidth = -1;
        lastScreenHeight = -1;
    }

    private void OnDisable() => RestoreViewport();
    private void OnDestroy() => RestoreViewport();
}
