using UnityEngine;
using UnityEngine.UI;
using TMPro;

/// <summary>
/// Painel de status visual: apresenta apenas snapshots do Node.
/// Isolado da janela de login (que desaparece na sessão autenticada).
/// </summary>
public class StatusManager : MonoBehaviour
{
    public static StatusManager Instance { get; private set; }

    [Header("Panel")]
    [SerializeField] private GameObject statusPanel;
    [Header("Texts")]
    [SerializeField] private TextMeshProUGUI levelText;
    [SerializeField] private TextMeshProUGUI experienceText;
    [SerializeField] private TextMeshProUGUI hpText;
    [SerializeField] private TextMeshProUGUI manaText;
    [SerializeField] private TextMeshProUGUI attackText;
    [SerializeField] private TextMeshProUGUI defenseText;
    [SerializeField] private TextMeshProUGUI armorText;
    [Header("Sliders")]
    [SerializeField] private Slider hpSlider;
    [SerializeField] private Slider manaSlider;
    [SerializeField] private Slider experienceSlider;
    [Header("Buttons")]
    [SerializeField] private Button closeButton;

    private bool isOpen;
    private RectTransform statsContent;
    private Transform originalStatusParent;
    private int originalStatusSibling;
    private Button statsIconButton;
    private bool dockedInSidebar;
    private TextMeshProUGUI satietyText;
    private TextMeshProUGUI fishingLevelText;
    public bool IsOpen => isOpen;

    private static readonly Color Gold = new Color32(235, 191, 109, 255);
    private static readonly Color Light = new Color32(230, 236, 241, 255);
    private static readonly Color HpRed = new Color32(198, 70, 69, 255);
    private static readonly Color ManaBlue = new Color32(69, 144, 219, 255);

    private void Awake()
    {
        if (Instance != null && Instance != this)
        {
            Destroy(gameObject);
            return;
        }
        Instance = this;
    }

    private void Start()
    {
        if (statusPanel == null)
        {
            Debug.LogError("[StatusManager] StatusPanel ausente no Inspector.");
            return;
        }

        // Não remover listeners alheios com RemoveAllListeners.
        if (closeButton == null)
        {
            var close = statusPanel.transform.Find("CloseButton");
            if (close != null) closeButton = close.GetComponent<Button>();
        }
        if (closeButton != null)
            closeButton.onClick.AddListener(OnCloseButtonClicked);
        else
            Debug.LogWarning("[StatusManager] CloseButton não encontrado.");

        StyleStatusPanel();
        statusPanel.SetActive(false);
        isOpen = false;

        // C17: tecla P removida; painel abre somente pelo ícone Status.
    }

    /// <summary>
    /// Usa o mesmo host responsivo do inventário; não sobrepõe o mapa,
    /// a Backpack, Loot, NPCs ou outras janelas do jogo.
    /// </summary>
    public void DockToSidebar(RectTransform host)
    {
        if (host == null || statusPanel == null) return;
        var shell = C8SidebarShell.Instance;
        var quick = shell != null ? shell.QuickAccessHost : null;
        var icon = quick != null ? quick.Find("StatsIcon") : null;
        if (icon != null && statsIconButton == null)
        {
            var img = icon.GetComponent<Image>();
            if (img != null) img.raycastTarget = true;
            statsIconButton = icon.GetComponent<Button>();
            if (statsIconButton == null)
                statsIconButton = icon.gameObject.AddComponent<Button>();
            statsIconButton.onClick.AddListener(TogglePanel);
        }
        if (!dockedInSidebar)
        {
            originalStatusParent = statusPanel.transform.parent;
            originalStatusSibling = statusPanel.transform.GetSiblingIndex();
            statusPanel.transform.SetParent(host, false);
            dockedInSidebar = true;
        }
        var rect = statusPanel.GetComponent<RectTransform>();
        rect.anchorMin = Vector2.zero;
        rect.anchorMax = Vector2.one;
        rect.pivot = new Vector2(0.5f, 0.5f);
        rect.offsetMin = Vector2.zero;
        rect.offsetMax = Vector2.zero;
        rect.localScale = Vector3.one;
    }

    public void DetachFromSidebar()
    {
        if (statsIconButton != null)
        {
            statsIconButton.onClick.RemoveListener(TogglePanel);
            statsIconButton = null;
        }
        if (dockedInSidebar && statusPanel != null && originalStatusParent != null)
        {
            statusPanel.transform.SetParent(originalStatusParent, false);
            statusPanel.transform.SetSiblingIndex(
                Mathf.Min(originalStatusSibling, originalStatusParent.childCount - 1));
        }
        dockedInSidebar = false;
        ClosePanel();
    }

    public void OnCloseButtonClicked() => ClosePanel();

    public void ClosePanel()
    {
        isOpen = false;
        if (statusPanel != null) statusPanel.SetActive(false);
        C8SidebarDynamicDock.Instance?.OnStatusVisibilityChanged(false);
    }

    public void TogglePanel()
    {
        var network = NetworkManager.Instance;
        if (statusPanel == null || network == null || !network.isConnected) return;
        isOpen = !statusPanel.activeSelf;
        statusPanel.SetActive(isOpen);
        C8SidebarDynamicDock.Instance?.OnStatusVisibilityChanged(isOpen);
        if (isOpen)
        {
            statusPanel.transform.SetAsLastSibling();
            var stats = GameManager.Instance?.PlayerStats;
            if (stats != null) UpdateUI(stats);
        }
    }

    public void OnPlayerStatsReceived(PlayerStatsData stats)
    {
        if (isOpen && statusPanel != null && statusPanel.activeSelf)
            UpdateUI(stats);
    }

    private void UpdateUI(PlayerStatsData stats)
    {
        if (stats == null) return;
        if (levelText != null) levelText.text = $"NÍVEL {stats.level:N0}";
        if (experienceText != null)
            experienceText.text = stats.levelXpToNext > 0
                ? $"XP {stats.levelXp:N0}/{stats.levelXpToNext:N0}\nTotal {stats.lifetimeXp:N0}"
                : $"XP total: {stats.xp:N0}  •  Nível máximo";
        if (hpText != null) hpText.text = $"VIDA   {stats.hp:N0} / {stats.maxHp:N0}";
        if (manaText != null) manaText.text = $"MANA   {stats.mana:N0} / {stats.maxMana:N0}";
        if (attackText != null) attackText.text = $"Ataque   {stats.attack:N0}";
        if (defenseText != null) defenseText.text = $"Defesa   {stats.defense:N0}";
        if (armorText != null) armorText.text = $"Armadura   {stats.armor:N0}";
        if (fishingLevelText != null)
            fishingLevelText.text = stats.fishingLevel > 0
                ? $"Pesca   Nível {stats.fishingLevel:N0}" : "Pesca   —";
        if (satietyText != null) satietyText.text = stats.satiety > 0
            ? $"Saciedade  {stats.satiety:N0}/{stats.satietyMax:N0}  |  {stats.foodSecondsRemaining}s"
            : $"Saciedade  0/{Mathf.Max(120,stats.satietyMax)}";

        UpdateSlider(hpSlider, stats.hp, stats.maxHp);
        UpdateSlider(manaSlider, stats.mana, stats.maxMana);
        UpdateSlider(experienceSlider,
            stats.levelXpToNext > 0 ? stats.levelXp : 1,
            stats.levelXpToNext > 0 ? stats.levelXpToNext : 1);
    }

    private static void UpdateSlider(Slider slider, int value, int maximum)
    {
        if (slider == null) return;
        slider.interactable = false;
        slider.minValue = 0;
        slider.maxValue = Mathf.Max(1, maximum);
        slider.value = Mathf.Clamp(value, 0, Mathf.Max(1, maximum));
    }

    /// <summary>
    /// Estilo criado em runtime: não depende de editar scene/prefab
    /// manualmente. Status fica centralizado à esquerda, não sobre o HUD
    /// nem o botão de logout no rodapé direito.
    /// </summary>
    private void StyleStatusPanel()
    {
        var canvas = statusPanel.GetComponentInParent<Canvas>();
        if (canvas == null) return;
        if (statusPanel.transform.parent != canvas.transform)
            statusPanel.transform.SetParent(canvas.transform, false);
        var rect = statusPanel.GetComponent<RectTransform>();
        if (rect == null) return;
        rect.anchorMin = rect.anchorMax = new Vector2(0f, 0.5f);
        rect.pivot = new Vector2(0f, 0.5f);
        rect.anchoredPosition = new Vector2(8, 0);
        rect.sizeDelta = new Vector2(244, 350);
        rect.localScale = Vector3.one;

        var bg = statusPanel.GetComponent<Image>();
        if (bg == null) bg = statusPanel.AddComponent<Image>();
        bg.color = new Color32(19, 27, 39, 246);
        bg.raycastTarget = true;
        var outline = statusPanel.GetComponent<Outline>();
        if (outline == null) outline = statusPanel.AddComponent<Outline>();
        outline.effectColor = Gold;
        outline.effectDistance = new Vector2(1, -1);

        // O título é decorativo e não cria um bloqueio de raycast.
        var header = statusPanel.transform.Find("C6StatusTitle");
        var title = header != null ? header.gameObject :
            new GameObject("C6StatusTitle", typeof(RectTransform), typeof(TextMeshProUGUI));
        if (header == null) title.transform.SetParent(statusPanel.transform, false);
        var headerText = title.GetComponent<TextMeshProUGUI>();
        headerText.text = "ATRIBUTOS";
        headerText.fontSize = 15f;
        headerText.color = Gold;
        headerText.raycastTarget = false;
        var titleRect = headerText.rectTransform;
        titleRect.anchorMin = new Vector2(0f, 1f);
        titleRect.anchorMax = Vector2.one;
        titleRect.offsetMin = new Vector2(11f, -33f);
        titleRect.offsetMax = new Vector2(-36f, -5f);

        EnsureStatsScroll();
        StyleLabel(levelText, 9, 27, 18, Gold);
        StyleLabel(experienceText, 40, 53, 12, Light);
        StyleLabel(hpText, 99, 23, 13, Light);
        StyleSlider(hpSlider, 125, HpRed);
        StyleLabel(manaText, 151, 23, 13, Light);
        StyleSlider(manaSlider, 177, ManaBlue);
        StyleLabel(attackText, 209, 23, 13, Light);
        StyleLabel(defenseText, 239, 23, 13, Light);
        StyleLabel(armorText, 269, 23, 13, Light);
        fishingLevelText = WorldWindowLayout.EnsureLabel(statsContent,
            "C8FishingLevelText", "Pesca   —", 13, Light);
        StyleLabel(fishingLevelText, 299, 23, 13, Gold);
        satietyText = WorldWindowLayout.EnsureLabel(statsContent, "C6SatietyText",
            "Saciedade  0/120", 13, Light);
        StyleLabel(satietyText, 329, 23, 13, Gold);
        StyleSlider(experienceSlider, 365, Gold);

        if (closeButton != null)
        {
            var closeRect = closeButton.transform as RectTransform;
            if (closeRect != null)
            {
                closeRect.anchorMin = closeRect.anchorMax =
                    closeRect.pivot = Vector2.one;
                closeRect.anchoredPosition = new Vector2(-14, -14);
                closeRect.sizeDelta = new Vector2(32, 30);
            }
            var closeImage = closeButton.GetComponent<Image>();
            if (closeImage != null) closeImage.color = new Color32(86, 57, 61, 255);
        }
    }

    private void EnsureStatsScroll()
    {
        var obj = statusPanel.transform.Find("C17StatsViewport");
        if (obj == null)
        {
            var view = new GameObject("C17StatsViewport", typeof(RectTransform),
                typeof(Image), typeof(RectMask2D), typeof(ScrollRect));
            view.transform.SetParent(statusPanel.transform, false);
            obj = view.transform;
        }
        var viewport = (RectTransform)obj;
        viewport.anchorMin = Vector2.zero;
        viewport.anchorMax = Vector2.one;
        viewport.offsetMin = new Vector2(4f, 5f);
        viewport.offsetMax = new Vector2(-4f, -36f);
        var image = obj.GetComponent<Image>();
        image.color = new Color(0f, 0f, 0f, 0f);
        image.raycastTarget = true;

        var existing = obj.Find("Content");
        if (existing == null)
        {
            var contentObj = new GameObject("Content", typeof(RectTransform));
            contentObj.transform.SetParent(obj, false);
            existing = contentObj.transform;
        }
        statsContent = (RectTransform)existing;
        statsContent.anchorMin = new Vector2(0f, 1f);
        statsContent.anchorMax = Vector2.one;
        statsContent.pivot = new Vector2(0.5f, 1f);
        statsContent.anchoredPosition = Vector2.zero;
        statsContent.sizeDelta = new Vector2(0f, 409f);
        var scroll = obj.GetComponent<ScrollRect>();
        scroll.viewport = viewport;
        scroll.content = statsContent;
        scroll.horizontal = false;
        scroll.vertical = true;
        scroll.scrollSensitivity = 4f;
        scroll.inertia = false;
        scroll.movementType = ScrollRect.MovementType.Clamped;
        // Capturar roda em um filho evita dupla entrega ao ScrollRect no
        // mesmo GameObject (que também implementa IScrollHandler).
        var input = obj.Find("C17WheelSurface");
        if (input == null)
        {
            var go = new GameObject("C17WheelSurface",
                typeof(RectTransform), typeof(Image), typeof(C16FineScrollWheel));
            go.transform.SetParent(obj, false);
            input = go.transform;
        }
        var inputRect = (RectTransform)input;
        inputRect.anchorMin = Vector2.zero; inputRect.anchorMax = Vector2.one;
        inputRect.offsetMin = inputRect.offsetMax = Vector2.zero;
        var inputImage = input.GetComponent<Image>();
        inputImage.color = new Color(0f,0f,0f,0f);
        inputImage.raycastTarget = true;
        input.GetComponent<C16FineScrollWheel>().Bind(scroll);
    }

    private void StyleLabel(TextMeshProUGUI label, float top, float height,
        float font, Color color)
    {
        if (label == null || statusPanel == null) return;
        if (statsContent != null && label.transform.parent != statsContent)
            label.transform.SetParent(statsContent, false);
        var rt = label.rectTransform;
        rt.anchorMin = new Vector2(0f, 1f);
        rt.anchorMax = new Vector2(1f, 1f);
        rt.pivot = new Vector2(0.5f, 1f);
        rt.anchoredPosition = new Vector2(0, -top);
        rt.sizeDelta = new Vector2(-19f, height);
        label.fontSize = font;
        label.alignment = TextAlignmentOptions.MidlineLeft;
        label.color = color;
        label.raycastTarget = false;
    }

    private void StyleSlider(Slider slider, float top, Color color)
    {
        if (slider == null || statusPanel == null) return;
        if (statsContent != null && slider.transform.parent != statsContent)
            slider.transform.SetParent(statsContent, false);
        var rt = slider.transform as RectTransform;
        if (rt == null) return;
        rt.anchorMin = new Vector2(0f, 1f);
        rt.anchorMax = new Vector2(1f, 1f);
        rt.pivot = new Vector2(0.5f, 1f);
        rt.anchoredPosition = new Vector2(0, -top);
        rt.sizeDelta = new Vector2(-19f, 10f);
        slider.interactable = false;
        if (slider.fillRect != null)
        {
            var fill = slider.fillRect.GetComponent<Image>();
            if (fill != null) fill.color = color;
        }
        var background = slider.transform.Find("Background");
        if (background != null && background.TryGetComponent<Image>(out var image))
            image.color = new Color32(50, 62, 73, 255);
    }

    private void OnDestroy()
    {
        DetachFromSidebar();
        if (closeButton != null)
            closeButton.onClick.RemoveListener(OnCloseButtonClicked);
        if (Instance == this) Instance = null;
    }
}
