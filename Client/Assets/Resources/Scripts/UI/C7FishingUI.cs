using TMPro;
using UnityEngine;
using UnityEngine.EventSystems;
using UnityEngine.InputSystem;
using UnityEngine.UI;

/// <summary>
/// C7: HUD de pesca criado automaticamente, sem alterar a cena serializada.
/// O timer só desenha uma previsão; conclusão, itens e iscas são do Node.
/// Atalho R abre uma tentativa (quando não digita); clique cancela no servidor.
/// </summary>
public sealed class C7FishingUI : MonoBehaviour
{
    public static C7FishingUI Instance { get; private set; }
    private GameObject root;
    private Image progressFill;
    private TextMeshProUGUI feedback;
    private Button startButton;
    private Button stopButton;
    private bool fishing;
    private bool waitingForAck;
    private float startedAt;
    private float duration;
    private float lastRequestAt = -1f;

    private void Awake()
    {
        if (Instance != null && Instance != this) { Destroy(this); return; }
        Instance = this;
    }

    private void Start()
    {
        BuildUi();
    }

    private static TextMeshProUGUI Label(Transform parent, string name, string value,
        Vector2 min, Vector2 max, int fontSize)
    {
        var go = new GameObject(name, typeof(RectTransform), typeof(TextMeshProUGUI));
        go.transform.SetParent(parent, false);
        var rt = (RectTransform)go.transform;
        rt.anchorMin = min; rt.anchorMax = max;
        rt.offsetMin = Vector2.zero; rt.offsetMax = Vector2.zero;
        var text = go.GetComponent<TextMeshProUGUI>();
        text.text = value; text.fontSize = fontSize;
        text.color = new Color32(233, 236, 239, 255);
        text.alignment = TextAlignmentOptions.Center;
        text.enableAutoSizing = true;
        text.fontSizeMin = 12; text.fontSizeMax = fontSize;
        text.raycastTarget = false;
        return text;
    }

    private static Button MakeButton(Transform parent, string name, string text,
        Vector2 min, Vector2 max)
    {
        var go = new GameObject(name, typeof(RectTransform), typeof(Image), typeof(Button));
        go.transform.SetParent(parent, false);
        var rt = (RectTransform)go.transform;
        rt.anchorMin = min; rt.anchorMax = max;
        rt.offsetMin = Vector2.zero; rt.offsetMax = Vector2.zero;
        go.GetComponent<Image>().color = new Color32(50, 74, 84, 250);
        Label(go.transform, "Label", text, Vector2.zero, Vector2.one, 15);
        return go.GetComponent<Button>();
    }

    private void BuildUi()
    {
        root = new GameObject("C7FishingCanvas", typeof(RectTransform), typeof(Canvas),
            typeof(CanvasScaler), typeof(GraphicRaycaster));
        var canvas = root.GetComponent<Canvas>();
        canvas.renderMode = RenderMode.ScreenSpaceOverlay;
        canvas.overrideSorting = true;
        canvas.sortingOrder = 420; // acima do mundo, abaixo do logout (500).
        var scaler = root.GetComponent<CanvasScaler>();
        scaler.uiScaleMode = CanvasScaler.ScaleMode.ScaleWithScreenSize;
        scaler.referenceResolution = new Vector2(1920, 1080);
        scaler.matchWidthOrHeight = 0.5f;

        var panel = new GameObject("FishingPanel", typeof(RectTransform), typeof(Image));
        panel.transform.SetParent(root.transform, false);
        var rect = (RectTransform)panel.transform;
        rect.anchorMin = rect.anchorMax = rect.pivot = new Vector2(1, 0);
        rect.anchoredPosition = new Vector2(-18, 83);
        rect.sizeDelta = new Vector2(330, 140);
        panel.GetComponent<Image>().color = new Color32(20, 29, 42, 244);

        Label(panel.transform, "Title", "PESCA  •  [R] iniciar",
            new Vector2(0.06f,0.73f),new Vector2(0.94f,0.97f),17);
        feedback = Label(panel.transform, "FishingStatus", "Vara e água próxima necessárias.",
            new Vector2(0.06f,0.46f),new Vector2(0.94f,0.72f),13);

        var track = new GameObject("ProgressTrack", typeof(RectTransform), typeof(Image));
        track.transform.SetParent(panel.transform, false);
        var t = (RectTransform)track.transform;
        t.anchorMin = new Vector2(0.06f,0.35f); t.anchorMax = new Vector2(0.94f,0.42f);
        t.offsetMin = t.offsetMax = Vector2.zero;
        track.GetComponent<Image>().color = new Color32(49, 58, 66, 255);
        track.GetComponent<Image>().raycastTarget = false;
        var fill = new GameObject("ProgressFill", typeof(RectTransform), typeof(Image));
        fill.transform.SetParent(track.transform, false);
        progressFill = fill.GetComponent<Image>();
        progressFill.color = new Color32(64, 177, 170, 255);
        progressFill.raycastTarget = false;
        SetProgress(0);
        startButton = MakeButton(panel.transform, "StartFishing", "Pescar",
            new Vector2(0.06f,0.06f),new Vector2(0.47f,0.30f));
        stopButton = MakeButton(panel.transform, "CancelFishing", "Cancelar",
            new Vector2(0.53f,0.06f),new Vector2(0.94f,0.30f));
        startButton.onClick.AddListener(StartFishing);
        stopButton.onClick.AddListener(CancelFishing);
        UpdateButtons();
        root.SetActive(false);
        GetComponent<C7UiAccessibility>()?.ApplyCurrent();
    }

    private void Update()
    {
        var network = NetworkManager.Instance;
        bool connected = network != null && network.isConnected;
        if (root != null && root.activeSelf != connected) root.SetActive(connected);
        if (!connected)
        {
            fishing = false; waitingForAck = false;
            return;
        }
        if (Keyboard.current != null && Keyboard.current.rKey.wasPressedThisFrame &&
            !ChatUI.IsChatActive && !IsInputFocused())
            StartFishing();

        if (fishing && duration > 0f)
        {
            // Visual estimado. Nunca completa no cliente antes do ACK do Node.
            float progress = Mathf.Clamp01((Time.unscaledTime - startedAt) / duration);
            SetProgress(progress);
        }
        UpdateButtons();
    }

    private static bool IsInputFocused()
    {
        var selected = EventSystem.current != null
            ? EventSystem.current.currentSelectedGameObject : null;
        return selected != null && selected.GetComponentInParent<TMP_InputField>() != null;
    }

    private void UpdateButtons()
    {
        if (startButton != null) startButton.interactable = !fishing && !waitingForAck;
        if (stopButton != null) stopButton.interactable = fishing;
    }

    private void SetProgress(float fraction)
    {
        if (progressFill == null) return;
        var rt = (RectTransform)progressFill.transform;
        rt.anchorMin = Vector2.zero;
        rt.anchorMax = new Vector2(Mathf.Clamp01(fraction), 1);
        rt.offsetMin = rt.offsetMax = Vector2.zero;
    }

    private void StartFishing()
    {
        var net = NetworkManager.Instance;
        if (net == null || !net.isConnected || net.Fishing == null ||
            fishing || waitingForAck) return;
        if (lastRequestAt >= 0f && Time.unscaledTime - lastRequestAt < 0.35f) return;
        lastRequestAt = Time.unscaledTime;
        waitingForAck = true;
        feedback.text = "Solicitando pescaria ao servidor...";
        net.Fishing.StartFishing();
        UpdateButtons();
    }

    private void CancelFishing()
    {
        var net = NetworkManager.Instance;
        if (net == null || !net.isConnected || net.Fishing == null || !fishing) return;
        net.Fishing.CancelFishing();
        stopButton.interactable = false;
    }

    public void HandleFishingStatus(string state, string message, int durationMs)
    {
        waitingForAck = false;
        fishing = state == "started";
        if (fishing)
        {
            duration = Mathf.Max(0.1f, durationMs / 1000f);
            startedAt = Time.unscaledTime;
            SetProgress(0);
        }
        else if (state == "completed") SetProgress(1);
        else SetProgress(0);
        if (feedback != null) feedback.text = message;
        ChatUI.Instance?.AddMessage("Pesca: " + message);
        UpdateButtons();
    }

    private void OnDestroy()
    {
        if (startButton != null) startButton.onClick.RemoveListener(StartFishing);
        if (stopButton != null) stopButton.onClick.RemoveListener(CancelFishing);
        if (root != null) Destroy(root);
        if (Instance == this) Instance = null;
    }
}
