using UnityEngine;
using UnityEngine.InputSystem;

/// <summary>
/// C7 — câmera 2D: acompanha só posições confirmadas do jogador, nunca
/// envia movimentos ao Node. Suavização temporal estável em 30/60/120 FPS.
/// Zoom +/- e limites do mapa usam unidades de tiles (1 tile = 1 world unit).
/// </summary>
[RequireComponent(typeof(Camera))]
public class CameraFollow : MonoBehaviour
{
    public Transform target;
    [Range(0.001f, 1f)] public float smoothSpeed = 0.125f;
    public Vector3 offset = new Vector3(0, 0, -10);

    [Header("C7 — Zoom ortográfico")]
    [SerializeField, Range(3, 14)] private float initialZoom = 6.5f;
    [SerializeField] private float minZoom = 3.5f;
    [SerializeField] private float maxZoom = 12f;
    [SerializeField] private float zoomStep = 0.5f;
    [SerializeField] private bool constrainToLoadedMap = true;
    [SerializeField] private bool pixelSnap = false;
    [SerializeField, Min(1f)] private float pixelsPerUnit = 32f;
    [SerializeField, Min(1f)] private float teleportSnapDistance = 7f;

    private Camera cameraComponent;
    private bool followedOnce;
    private const string ZoomPreference = "ZagoQuest.C7.CameraZoom";
    public float Zoom => cameraComponent != null ? cameraComponent.orthographicSize : initialZoom;

    private void Awake()
    {
        cameraComponent = GetComponent<Camera>();
    }

    private void Start()
    {
        if (cameraComponent != null && cameraComponent.orthographic)
            SetZoom(PlayerPrefs.GetFloat(ZoomPreference, initialZoom), false);
    }

    private void Update()
    {
        if (cameraComponent == null || !cameraComponent.orthographic ||
            Keyboard.current == null || ChatUI.IsChatActive) return;
        // +/- são atalhos opcionais e não interceptam mouse/scroll de inventários.
        if (Keyboard.current.equalsKey.wasPressedThisFrame ||
            Keyboard.current.numpadPlusKey.wasPressedThisFrame)
            SetZoom(Zoom - zoomStep);
        else if (Keyboard.current.minusKey.wasPressedThisFrame ||
                 Keyboard.current.numpadMinusKey.wasPressedThisFrame)
            SetZoom(Zoom + zoomStep);
    }

    public void SetZoom(float requested, bool save = true)
    {
        if (cameraComponent == null || !cameraComponent.orthographic) return;
        cameraComponent.orthographicSize = Mathf.Clamp(requested,
            Mathf.Max(1f, minZoom), Mathf.Max(minZoom, maxZoom));
        if (save) PlayerPrefs.SetFloat(ZoomPreference, cameraComponent.orthographicSize);
    }

    public void ResetCamera()
    {
        PlayerPrefs.DeleteKey(ZoomPreference);
        SetZoom(initialZoom, false);
        followedOnce = false;
    }

    private void LateUpdate()
    {
        if (target == null && PlayerController.Instance != null)
            target = PlayerController.Instance.transform;
        if (target == null) { followedOnce = false; return; }

        // Reconexão/respawn: evita perseguir por segundos uma posição antiga.
        Vector3 desired = target.position + offset;
        // Enquadramento da área utilizável, sem mudar Camera.rect nem o mapa.
        // A compensação é em unidades de mundo, independentemente da resolução/F10.
        if (cameraComponent != null && cameraComponent.orthographic &&
            Screen.height > 0 &&
            C7DockLayout.TryGetWorldInsets(out float rightPixels, out float bottomPixels))
        {
            float unitsPerPixel = 2f * cameraComponent.orthographicSize / Screen.height;
            desired.x += rightPixels * 0.5f * unitsPerPixel;
            desired.y -= bottomPixels * 0.5f * unitsPerPixel;
        }
        float delta = Vector3.Distance(new Vector3(transform.position.x,
            transform.position.y, 0), new Vector3(desired.x, desired.y, 0));
        if (!followedOnce || delta >= teleportSnapDistance)
        {
            transform.position = ClampToWorld(desired);
            followedOnce = true;
            return;
        }

        // A suavização legada 0.125 por frame é mantida a 60 FPS e
        // convertida para coeficiente dependente do deltaTime nos demais.
        float rate = Mathf.Clamp(smoothSpeed, 0.001f, 1f);
        float alpha = 1f - Mathf.Pow(1f - rate, Time.deltaTime * 60f);
        Vector3 next = Vector3.LerpUnclamped(transform.position, desired, alpha);
        transform.position = ClampToWorld(next);
    }

    private Vector3 ClampToWorld(Vector3 position)
    {
        if (cameraComponent != null && constrainToLoadedMap &&
            GameManager.Instance != null && GameManager.Instance.HasLoadedMap)
        {
            float halfHeight = cameraComponent.orthographicSize;
            // PixelRect considera o dock lateral e chat inferior: a câmera
            // deve calcular seus limites pelo viewport REAL, não pela tela cheia.
            float aspect = cameraComponent.pixelHeight > 0
                ? cameraComponent.pixelWidth / (float)cameraComponent.pixelHeight
                : cameraComponent.aspect;
            float halfWidth = halfHeight * aspect;
            float mapWidth = GameManager.Instance.MapWidth;
            float mapHeight = GameManager.Instance.MapHeight;
            position.x = mapWidth <= halfWidth * 2f
                ? (mapWidth - 1f) * 0.5f
                : Mathf.Clamp(position.x, halfWidth - 0.5f,
                    mapWidth - 0.5f - halfWidth);
            position.y = mapHeight <= halfHeight * 2f
                ? (mapHeight - 1f) * 0.5f
                : Mathf.Clamp(position.y, halfHeight - 0.5f,
                    mapHeight - 0.5f - halfHeight);
        }
        // O clamp tradicional do mapa pode, perto da margem direita/inferior,
        // empurrar o avatar para debaixo do HUD. Esta segunda restrição trata
        // a região segura como prioritária. Em bordas extremas pode sobrar fundo
        // vazio (sem inventar tiles nem repetir sprites do mapa).
        if (target != null && cameraComponent != null && cameraComponent.orthographic &&
            Screen.width > 0 && Screen.height > 0 &&
            C7DockLayout.TryGetWorldInsets(out float rightPx, out float bottomPx))
        {
            float unitsPerPixel = 2f * cameraComponent.orthographicSize / Screen.height;
            float margin = Mathf.Min(16f, Mathf.Min(Screen.width, Screen.height) * 0.018f);
            float halfScreenWidth = Screen.width * 0.5f;
            float halfScreenHeight = Screen.height * 0.5f;
            float maxTargetDx = (halfScreenWidth - rightPx - margin) * unitsPerPixel;
            float minTargetDx = (-halfScreenWidth + margin) * unitsPerPixel;
            float maxTargetDy = (halfScreenHeight - margin) * unitsPerPixel;
            float minTargetDy = (bottomPx + margin - halfScreenHeight) * unitsPerPixel;
            position.x = Mathf.Clamp(position.x,
                target.position.x - maxTargetDx, target.position.x - minTargetDx);
            position.y = Mathf.Clamp(position.y,
                target.position.y - maxTargetDy, target.position.y - minTargetDy);
        }
        if (pixelSnap && pixelsPerUnit > 0f)
        {
            position.x = Mathf.Round(position.x * pixelsPerUnit) / pixelsPerUnit;
            position.y = Mathf.Round(position.y * pixelsPerUnit) / pixelsPerUnit;
        }
        position.z = offset.z; // orthographic camera stays in front of sprites
        return position;
    }
}
