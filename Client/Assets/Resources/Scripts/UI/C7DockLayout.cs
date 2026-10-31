using System.Collections.Generic;
using TMPro;
using UnityEngine;
using UnityEngine.UI;

/// <summary>
/// C7.1 — Barra lateral de MMORPG: janelas ordenadas por VerticalLayoutGroup,
/// largura FIXA, altura ajustável e rolagem quando não couberem na tela.
/// A câmera desenha SOMENTE na área livre; o jogador nunca fica atrás das caixas.
/// Objetos são realocados em runtime; cenas e prefabs continuam intocados.
/// </summary>
public sealed class C7DockLayout : MonoBehaviour
{
    public static C7DockLayout Instance { get; private set; }
    private const float SidebarWidth = 314f;
    private const float ChatHeight = 222f;
    private const float Spacing = 7f;
    private Canvas mainCanvas;
    private RectTransform viewport;
    private RectTransform content;
    private ScrollRect scroll;
    private Camera worldCamera;
    private readonly Dictionary<RectTransform, LayoutElement> registered = new();
    private readonly Dictionary<RectTransform, string> keys = new();
    private float nextSync;
    private int lastWidth = -1, lastHeight = -1;
    private const string KeyPrefix = "ZagoQuest.C7.Dock.";

    private void Awake()
    {
        if (Instance != null && Instance != this) { Destroy(this); return; }
        Instance = this;
    }

    private void Start() { TryBuild(); }

    private void TryBuild()
    {
        if (content != null) return;
        foreach (var candidate in FindObjectsByType<Canvas>(FindObjectsInactive.Include,
            FindObjectsSortMode.None))
        {
            if (!candidate.isRootCanvas || candidate.overrideSorting ||
                candidate.renderMode != RenderMode.ScreenSpaceOverlay) continue;
            mainCanvas = candidate;
            break;
        }
        if (mainCanvas == null) return;

        var sidebar = new GameObject("C7DockSidebar", typeof(RectTransform),
            typeof(Image), typeof(ScrollRect));
        sidebar.transform.SetParent(mainCanvas.transform, false);
        viewport = sidebar.GetComponent<RectTransform>();
        viewport.anchorMin = new Vector2(1, 0);
        viewport.anchorMax = Vector2.one;
        viewport.pivot = new Vector2(1, 0.5f);
        viewport.offsetMin = new Vector2(-SidebarWidth, 0);
        viewport.offsetMax = Vector2.zero;
        sidebar.GetComponent<Image>().color = new Color32(19, 27, 38, 250);
        // O fundo não deve capturar eventos no mundo fora da barra.
        sidebar.GetComponent<Image>().raycastTarget = true;

        var view = new GameObject("Viewport", typeof(RectTransform), typeof(Image),
            typeof(RectMask2D));
        view.transform.SetParent(sidebar.transform, false);
        var vr = (RectTransform)view.transform;
        vr.anchorMin = Vector2.zero; vr.anchorMax = Vector2.one;
        vr.offsetMin = new Vector2(6, 7);
        vr.offsetMax = new Vector2(-6, -7);
        var vi = view.GetComponent<Image>();
        vi.color = new Color(0, 0, 0, 0);
        vi.raycastTarget = true;

        var body = new GameObject("C7DockContent", typeof(RectTransform),
            typeof(VerticalLayoutGroup), typeof(ContentSizeFitter));
        body.transform.SetParent(view.transform, false);
        content = body.GetComponent<RectTransform>();
        content.anchorMin = new Vector2(0, 1);
        content.anchorMax = Vector2.one;
        content.pivot = new Vector2(0.5f, 1);
        content.anchoredPosition = Vector2.zero;
        content.sizeDelta = Vector2.zero;
        var group = body.GetComponent<VerticalLayoutGroup>();
        group.padding = new RectOffset(3, 3, 3, 3);
        group.spacing = Spacing;
        group.childAlignment = TextAnchor.UpperCenter;
        group.childControlWidth = true;
        group.childControlHeight = true;
        group.childForceExpandWidth = true;
        group.childForceExpandHeight = false;
        var fitter = body.GetComponent<ContentSizeFitter>();
        fitter.horizontalFit = ContentSizeFitter.FitMode.Unconstrained;
        fitter.verticalFit = ContentSizeFitter.FitMode.PreferredSize;

        scroll = sidebar.GetComponent<ScrollRect>();
        scroll.viewport = vr;
        scroll.content = content;
        scroll.horizontal = false; scroll.vertical = true;
        scroll.movementType = ScrollRect.MovementType.Clamped;
        scroll.scrollSensitivity = 34f;

        // A barra lateral deve permanecer acima dos demais Canvas da cena,
        // mas o login/logout (Canvas próprio 500) conserva prioridade.
        sidebar.transform.SetAsLastSibling();
        worldCamera = Camera.main;
    }

    private void LateUpdate()
    {
        TryBuild();
        if (content == null) return;
        bool connected = NetworkManager.Instance != null &&
            NetworkManager.Instance.isConnected;
        if (worldCamera == null) worldCamera = Camera.main;
        UpdateWorldViewport(connected);
        if (Time.unscaledTime < nextSync) return;
        nextSync = Time.unscaledTime + 0.20f;

        foreach (var handle in FindObjectsByType<C6WindowDragHandle>(
            FindObjectsInactive.Include, FindObjectsSortMode.None))
        {
            if (handle == null || handle.transform.parent == null) continue;
            var panel = handle.transform.parent as RectTransform;
            if (panel == null || registered.ContainsKey(panel)) continue;
            if (panel.GetComponent<ChatUI>() != null) continue; // Chat: dock inferior esquerdo.
            Register(panel);
        }

        foreach (var entry in registered)
        {
            var panel = entry.Key;
            if (panel == null) continue;
            bool show = panel.gameObject.activeSelf;
            var loot = panel.GetComponent<LootUI>();
            if (loot != null) show = show && loot.lootPanel != null &&
                loot.lootPanel.activeSelf;
            entry.Value.ignoreLayout = !show;
            var group = panel.GetComponent<CanvasGroup>();
            if (loot != null && group != null)
            {
                group.alpha = show ? 1f : 0f;
                group.blocksRaycasts = show;
                group.interactable = show;
            }
        }
        LayoutRebuilder.MarkLayoutForRebuild(content);
    }

    private void Register(RectTransform panel)
    {
        var key = panel.name;
        float initialHeight = Mathf.Clamp(panel.rect.height, 156, 500);
        panel.SetParent(content, false);
        panel.localScale = Vector3.one;
        var layout = panel.GetComponent<LayoutElement>();
        if (layout == null) layout = panel.gameObject.AddComponent<LayoutElement>();
        layout.minHeight = 145;
        layout.preferredHeight = Mathf.Clamp(
            PlayerPrefs.GetFloat(KeyPrefix + key + ".Height", initialHeight), 145, 650);
        layout.flexibleHeight = 0;
        layout.flexibleWidth = 1;
        registered[panel] = layout;
        keys[panel] = key;
        panel.anchorMin = new Vector2(0, 1);
        panel.anchorMax = new Vector2(1, 1);
        panel.pivot = new Vector2(0.5f, 1);
        panel.anchoredPosition = Vector2.zero;
        panel.sizeDelta = new Vector2(0, layout.preferredHeight);

        if (panel.GetComponent<LootUI>() != null &&
            panel.GetComponent<CanvasGroup>() == null)
            panel.gameObject.AddComponent<CanvasGroup>();
        AddResizeGrip(panel);
        var header = panel.Find("C6DragHeader/Title")?.GetComponent<TextMeshProUGUI>();
        if (header != null) header.text += "  ↕";
        Debug.Log("[C7Dock] Registrado: " + key);
    }

    private void AddResizeGrip(RectTransform panel)
    {
        var existing = panel.Find("C7HeightGrip");
        if (existing != null) return;
        var go = new GameObject("C7HeightGrip", typeof(RectTransform),
            typeof(Image), typeof(C7DockResizeGrip));
        go.transform.SetParent(panel, false);
        var rt = (RectTransform)go.transform;
        rt.anchorMin = new Vector2(0, 0);
        rt.anchorMax = new Vector2(1, 0);
        rt.pivot = new Vector2(0.5f, 0);
        rt.offsetMin = new Vector2(4, 0);
        rt.offsetMax = new Vector2(-4, 13);
        var image = go.GetComponent<Image>();
        image.color = new Color32(49, 75, 85, 255);
        image.raycastTarget = true;
        go.GetComponent<C7DockResizeGrip>().Bind(panel, mainCanvas);
        var text = WorldWindowLayout.EnsureLabel(go.transform,"Hint",
            "↕  ARRASTE PARA AJUSTAR ALTURA  ↕",11,WorldWindowLayout.Muted);
        text.alignment = TextAlignmentOptions.Center;
        WorldWindowLayout.Place(text.rectTransform,0,0,1,1);
        go.transform.SetAsLastSibling();
    }

    private void UpdateWorldViewport(bool connected)
    {
        if (worldCamera == null || Screen.width <= 0 || Screen.height <= 0) return;
        if (!connected)
        {
            if (worldCamera.rect != new Rect(0, 0, 1, 1))
                worldCamera.rect = new Rect(0, 0, 1, 1);
            return;
        }
        float scale = mainCanvas != null ? Mathf.Max(mainCanvas.scaleFactor, 0.5f) : 1;
        float right = SidebarWidth * scale;
        float bottom = ChatHeight * scale;
        float width = Mathf.Clamp01((Screen.width - right) / Screen.width);
        float y = Mathf.Clamp01(bottom / Screen.height);
        Rect desired = new Rect(0, y, width, 1f - y);
        if (Screen.width != lastWidth || Screen.height != lastHeight ||
            worldCamera.rect != desired)
        {
            worldCamera.rect = desired;
            lastWidth = Screen.width; lastHeight = Screen.height;
        }
        // O chat é uma barra inferior, não uma janela flutuante sobre o player.
        if (ChatUI.Instance != null)
        {
            var chat = ChatUI.Instance.transform as RectTransform;
            if (chat != null)
            {
                chat.anchorMin = chat.anchorMax = chat.pivot = Vector2.zero;
                chat.anchoredPosition = new Vector2(8, 4);
                chat.sizeDelta = new Vector2(
                    Mathf.Min(680f, Screen.width / scale - SidebarWidth - 16f),
                    ChatHeight - 8f);
            }
        }
    }

    public static bool IsDocked(RectTransform panel) =>
        Instance != null && panel != null && Instance.registered.ContainsKey(panel);

    public static void Resize(RectTransform panel, float delta)
    {
        if (!IsDocked(panel)) return;
        var manager = Instance;
        var layout = manager.registered[panel];
        float maxHeight = Mathf.Max(240f, Screen.height /
            Mathf.Max(0.5f, manager.mainCanvas.scaleFactor) - 40f);
        layout.preferredHeight = Mathf.Clamp(layout.preferredHeight + delta,145,maxHeight);
        PlayerPrefs.SetFloat(KeyPrefix + manager.keys[panel] + ".Height",
            layout.preferredHeight);
        LayoutRebuilder.MarkLayoutForRebuild(manager.content);
    }

    public static void Reorder(RectTransform panel, float verticalDrag)
    {
        if (!IsDocked(panel) || Mathf.Abs(verticalDrag) < 18f) return;
        int current = panel.GetSiblingIndex();
        int last = Instance.content.childCount - 1;
        int steps = Mathf.Max(1,Mathf.RoundToInt(Mathf.Abs(verticalDrag) / 90f));
        panel.SetSiblingIndex(Mathf.Clamp(current + (verticalDrag < 0 ? steps : -steps),
            0,last));
        LayoutRebuilder.MarkLayoutForRebuild(Instance.content);
    }

    public static void ResetHeight(RectTransform panel)
    {
        if (!IsDocked(panel)) return;
        PlayerPrefs.DeleteKey(KeyPrefix + Instance.keys[panel] + ".Height");
        Instance.registered[panel].preferredHeight = 310;
        LayoutRebuilder.MarkLayoutForRebuild(Instance.content);
    }

    private void OnDestroy()
    {
        if (worldCamera != null) worldCamera.rect = new Rect(0, 0, 1, 1);
        if (Instance == this) Instance = null;
    }
}
