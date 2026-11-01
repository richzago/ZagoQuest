using TMPro;
using UnityEngine;
using UnityEngine.UI;

/// <summary>
/// UI etapa 1/4: casca VISUAL de sidebar independente, sem docking.
/// Nao move paineis atuais, nao altera camera/mapa e nao envia gameplay.
/// Mantenha a regra de clique C7: SOMENTE a superficie visivel recebe raycast.
/// </summary>
[DisallowMultipleComponent]
public sealed class C8SidebarShell : MonoBehaviour
{
    private const float SidebarWidth = 286f;
    private GameObject canvasRoot;

    private static readonly Color Background = new Color32(18, 27, 39, 247);
    private static readonly Color Inner = new Color32(29, 41, 56, 238);
    private static readonly Color Border = new Color32(175, 139, 80, 188);
    private static readonly Color Text = new Color32(235, 233, 226, 255);
    private static readonly Color Muted = new Color32(170, 188, 202, 255);

    private void Start()
    {
        BuildShell();
        // A C7 ja gerencia a escala global 100/115/130% (F10).
        // Incluir a sidebar sem mexer no sistema de acessibilidade.
        GetComponent<C7UiAccessibility>()?.ApplyCurrent();
        if (canvasRoot != null)
            canvasRoot.SetActive(NetworkManager.Instance != null &&
                NetworkManager.Instance.isConnected);
    }

    private void Update()
    {
        if (canvasRoot == null) return;
        var network = NetworkManager.Instance;
        bool visible = network != null && network.isConnected;
        if (canvasRoot.activeSelf != visible)
            canvasRoot.SetActive(visible);
    }

    private void BuildShell()
    {
        if (canvasRoot != null) return; // reconexao nao duplica Canvas

        // Canvas raiz SEM Image/Graphic: a tela inteira nao recebe raycasts!
        canvasRoot = new GameObject("C8SidebarCanvas", typeof(RectTransform),
            typeof(Canvas), typeof(CanvasScaler), typeof(GraphicRaycaster));
        var canvas = canvasRoot.GetComponent<Canvas>();
        canvas.renderMode = RenderMode.ScreenSpaceOverlay;
        canvas.overrideSorting = true;
        // A HUD antiga continua acima (sortingOrder 0) ate o encaixe futuro.
        // Tambem fica abaixo da UI de pesca (420) e login (500).
        canvas.sortingOrder = -5;

        var scaler = canvasRoot.GetComponent<CanvasScaler>();
        scaler.uiScaleMode = CanvasScaler.ScaleMode.ScaleWithScreenSize;
        scaler.referenceResolution = new Vector2(1920, 1080);
        scaler.matchWidthOrHeight = 0.5f;

        // UNICO Graphic com raycastTarget=true nesta arvore.
        // O clique e bloqueado apenas dentro da sidebar opaca VISIVEL.
        var surface = new GameObject("SidebarSurface", typeof(RectTransform), typeof(Image));
        surface.transform.SetParent(canvasRoot.transform, false);
        var rect = surface.GetComponent<RectTransform>();
        rect.anchorMin = new Vector2(1f, 0f);
        rect.anchorMax = new Vector2(1f, 1f);
        rect.pivot = new Vector2(1f, 0.5f);
        rect.anchoredPosition = new Vector2(-12f, 0f);
        rect.sizeDelta = new Vector2(SidebarWidth, -24f);

        var image = surface.GetComponent<Image>();
        image.color = Background;
        image.raycastTarget = true;
        var outline = surface.AddComponent<Outline>();
        outline.effectColor = Border;
        outline.effectDistance = new Vector2(-1.5f, -1.5f);

        AddText(surface.transform, "Brand", "ZAGOQUEST", 18f, 27f, 16f, Border);
        AddText(surface.transform, "Title", "BARRA LATERAL", 52f, 34f, 20f, Text);
        AddText(surface.transform, "Phase", "UI  01 / 04  •  ESTRUTURA", 89f, 27f, 12f, Muted);
        AddAccent(surface.transform, 126f);

        var intro = AddDecorativeCard(surface.transform, "Introduction", 150f, 132f);
        AddText(intro.transform, "IntroTitle", "ÁREA INDEPENDENTE", 14f, 31f, 14f, Text);
        AddText(intro.transform, "IntroBody",
            "Nesta etapa, os painéis continuam flutuantes. O encaixe será testado separadamente.",
            46f, 73f, 13f, Muted);

        AddText(surface.transform, "PreviewTitle", "ESPAÇO PARA PAINÉIS", 308f, 28f, 14f, Text);
        AddPreview(surface.transform, "ReservedOne", "ÁREA RESERVADA 01", 352f);
        AddPreview(surface.transform, "ReservedTwo", "ÁREA RESERVADA 02", 427f);
        AddPreview(surface.transform, "ReservedThree", "ÁREA RESERVADA 03", 502f);

        // Rodape ancorado ao fim da sidebar; apenas texto, sem hitbox.
        AddBottomText(surface.transform, "Footer",
            "Sem alterações no mapa ou na câmera", 16f, 42f);
    }

    private static GameObject AddDecorativeCard(Transform parent, string name,
        float top, float height)
    {
        var card = new GameObject(name, typeof(RectTransform), typeof(Image));
        card.transform.SetParent(parent, false);
        PlaceTop((RectTransform)card.transform, top, height, 15f, 15f);
        var image = card.GetComponent<Image>();
        image.color = Inner;
        image.raycastTarget = false; // o parent opaco faz o bloqueio
        return card;
    }

    private static void AddPreview(Transform parent, string name, string label, float top)
    {
        var card = AddDecorativeCard(parent, name, top, 59f);
        // Reservas sao so decorativas; nao fingir que ha paineis acoplados.
        AddText(card.transform, "Label", label, 17f, 25f, 12f, Muted);
    }

    private static void AddAccent(Transform parent, float top)
    {
        var bar = new GameObject("Accent", typeof(RectTransform), typeof(Image));
        bar.transform.SetParent(parent, false);
        PlaceTop((RectTransform)bar.transform, top, 2f, 16f, 16f);
        var image = bar.GetComponent<Image>();
        image.color = Border;
        image.raycastTarget = false;
    }

    private static void AddText(Transform parent, string name, string value,
        float top, float height, float fontSize, Color color)
    {
        var go = new GameObject(name, typeof(RectTransform), typeof(TextMeshProUGUI));
        go.transform.SetParent(parent, false);
        PlaceTop((RectTransform)go.transform, top, height, 22f, 22f);
        var label = go.GetComponent<TextMeshProUGUI>();
        label.text = value;
        label.color = color;
        label.fontSize = fontSize;
        label.enableWordWrapping = true;
        label.alignment = TextAlignmentOptions.TopLeft;
        label.raycastTarget = false; // texto nunca pode roubar clique do mundo
    }

    private static void AddBottomText(Transform parent, string name,
        string value, float bottom, float height)
    {
        var go = new GameObject(name, typeof(RectTransform), typeof(TextMeshProUGUI));
        go.transform.SetParent(parent, false);
        var rt = (RectTransform)go.transform;
        rt.anchorMin = new Vector2(0f, 0f);
        rt.anchorMax = new Vector2(1f, 0f);
        rt.pivot = new Vector2(0.5f, 0f);
        rt.offsetMin = new Vector2(20f, bottom);
        rt.offsetMax = new Vector2(-20f, bottom + height);
        var label = go.GetComponent<TextMeshProUGUI>();
        label.text = value;
        label.color = Muted;
        label.fontSize = 11;
        label.alignment = TextAlignmentOptions.BottomLeft;
        label.raycastTarget = false;
    }

    private static void PlaceTop(RectTransform rect, float top, float height,
        float insetLeft, float insetRight)
    {
        rect.anchorMin = new Vector2(0f, 1f);
        rect.anchorMax = new Vector2(1f, 1f);
        rect.pivot = new Vector2(0.5f, 1f);
        rect.offsetMin = new Vector2(insetLeft, -top - height);
        rect.offsetMax = new Vector2(-insetRight, -top);
    }

    private void OnDestroy()
    {
        if (canvasRoot != null) Destroy(canvasRoot);
        canvasRoot = null;
    }
}
