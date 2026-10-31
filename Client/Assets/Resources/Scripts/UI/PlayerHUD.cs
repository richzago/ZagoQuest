using TMPro;
using UnityEngine;
using UnityEngine.UI;

/// <summary>
/// C6: HUD compacto. Nome, nível, vida vermelha e mana azul são apenas
/// apresentações dos snapshots recebidos do Node. XP detalhada continua
/// disponível no Status (P), não no HUD principal.
/// </summary>
public class PlayerHUD : MonoBehaviour
{
    public static PlayerHUD Instance { get; private set; }

    [Header("Barras existentes — PlayerBars, não StatusPanel")]
    public Slider hpSlider;
    public Slider manaSlider;
    public Slider xpSlider;
    public TextMeshProUGUI hpText;
    public TextMeshProUGUI manaText;
    public TextMeshProUGUI xpText;
    public TextMeshProUGUI levelText;

    [Header("Textos existentes")]
    public TextMeshProUGUI playerNameText;
    public TextMeshProUGUI positionText;
    public TextMeshProUGUI fpsText;

    private static readonly Color HealthRed = new Color32(198, 70, 69, 255);
    private static readonly Color ManaBlue = new Color32(69, 144, 219, 255);
    private static readonly Color Accent = new Color32(235, 191, 109, 255);
    private static readonly Color LabelColor = new Color32(225, 231, 234, 255);
    private float fpsElapsed;
    private int fpsFrames;

    private void Awake()
    {
        if (Instance != null && Instance != this)
        {
            Destroy(gameObject);
            return;
        }
        Instance = this;
    }

    private void Start() => StyleGameplayHud();

    private void Update()
    {
        if (fpsText == null) return;
        fpsElapsed += Time.unscaledDeltaTime;
        fpsFrames++;
        if (fpsElapsed < 0.5f) return;
        if (fpsElapsed > 0f)
            fpsText.text = $"FPS: {Mathf.RoundToInt(fpsFrames / fpsElapsed)}";
        fpsElapsed = 0f;
        fpsFrames = 0;
    }

    public void SetPlayerName(string playerName)
    {
        if (playerNameText != null && !string.IsNullOrWhiteSpace(playerName))
            playerNameText.text = playerName;
    }

    // Contrato legado: valores de HP/mana e nível já vieram do servidor.
    // 'xp' permanece no método por compatibilidade, mas NÃO é desenhada aqui.
    public void UpdateStats(int hp, int maxHp, int mana, int maxMana,
        int level, int attack, int defense, int xp)
    {
        DisplayBar(hpSlider, hp, maxHp);
        DisplayBar(manaSlider, mana, maxMana);

        if (hpText != null) hpText.text = $"HP  {hp:N0} / {maxHp:N0}";
        if (manaText != null) manaText.text = $"MANA  {mana:N0} / {maxMana:N0}";
        if (levelText != null) levelText.text = $"NÍVEL {level:N0}";
    }

    /// <summary>
    /// Progresso de nível é usado apenas para realçar o rótulo ao passar
    /// de 90%, sem XP visível. O cliente jamais altera XP/HP/mana do Node.
    /// </summary>
    public void UpdateStats(PlayerStatsData stats)
    {
        if (stats == null) return;
        UpdateStats(stats.hp, stats.maxHp, stats.mana, stats.maxMana,
            stats.level, stats.attack, stats.defense, stats.levelXp);

        if (levelText != null)
        {
            bool nearLevelUp = stats.levelXpToNext > 0 &&
                (double)stats.levelXp / stats.levelXpToNext >= 0.9;
            levelText.color = nearLevelUp ? Accent : LabelColor;
        }
    }

    private static void DisplayBar(Slider slider, int value, int maximum)
    {
        if (slider == null) return;
        slider.interactable = false;
        slider.wholeNumbers = true;
        slider.minValue = 0;
        slider.maxValue = Mathf.Max(1, maximum);
        slider.value = Mathf.Clamp(value, 0, Mathf.Max(1, maximum));
    }

    private void StyleGameplayHud()
    {
        // TopCenter contém os PlayerBars; os do StatusManager são independentes.
        var root = playerNameText != null
            ? playerNameText.transform.parent as RectTransform : null;
        if (root == null) return;
        root.anchorMin = root.anchorMax = new Vector2(0.5f, 1);
        root.pivot = new Vector2(0.5f, 1);
        root.anchoredPosition = new Vector2(0, -12);
        root.sizeDelta = new Vector2(314, 156);
        root.localScale = Vector3.one;

        var background = root.GetComponent<Image>();
        if (background == null) background = root.gameObject.AddComponent<Image>();
        background.color = new Color32(19, 27, 39, 226);
        background.raycastTarget = false;

        var outline = root.GetComponent<Outline>();
        if (outline == null) outline = root.gameObject.AddComponent<Outline>();
        outline.effectColor = new Color32(173, 136, 74, 155);
        outline.effectDistance = new Vector2(1, -1);

        PlaceHeader(playerNameText, -8, 28, 19, Accent);
        PlaceHeader(levelText, -35, 22, 13, LabelColor);

        var bars = hpSlider != null ? hpSlider.transform.parent as RectTransform : null;
        if (bars != null && bars.parent == root)
        {
            bars.anchorMin = Vector2.zero;
            bars.anchorMax = Vector2.one;
            bars.offsetMin = Vector2.zero;
            bars.offsetMax = Vector2.zero;
        }

        StyleBar(hpSlider, -65, HealthRed);
        StyleBar(manaSlider, -105, ManaBlue);
        PlaceBarText(hpText, bars, -65);
        PlaceBarText(manaText, bars, -105);

        // A XP não ocupa espaço nem intercepta ponteiro no HUD principal.
        // Mantemos as referências serializadas para evitar quebrar a scene.
        if (xpSlider != null) xpSlider.gameObject.SetActive(false);
        if (xpText != null) xpText.gameObject.SetActive(false);

        if (positionText != null)
        {
            positionText.fontSize = 13;
            positionText.raycastTarget = false;
        }
        if (fpsText != null)
        {
            fpsText.fontSize = 13;
            fpsText.raycastTarget = false;
        }
    }

    private static void PlaceHeader(TMP_Text label, float y, float height,
        float fontSize, Color color)
    {
        if (label == null) return;
        var rt = label.rectTransform;
        rt.anchorMin = new Vector2(0, 1);
        rt.anchorMax = new Vector2(1, 1);
        rt.pivot = new Vector2(0.5f, 1);
        rt.anchoredPosition = new Vector2(0, y);
        rt.sizeDelta = new Vector2(-24, height);
        label.fontSize = fontSize;
        label.color = color;
        label.alignment = TextAlignmentOptions.Center;
        label.raycastTarget = false;
    }

    private static void StyleBar(Slider slider, float top, Color fillColor)
    {
        if (slider == null) return;
        var rt = slider.transform as RectTransform;
        if (rt == null) return;
        rt.anchorMin = new Vector2(0, 1);
        rt.anchorMax = new Vector2(1, 1);
        rt.pivot = new Vector2(0.5f, 1);
        rt.anchoredPosition = new Vector2(0, top);
        rt.sizeDelta = new Vector2(-32, 28);
        slider.interactable = false;

        // A scene chama os sliders principais HPBar/ManaBar, não HPSlider.
        // Aplicar a cor ao fill real, independentemente do nome na Hierarchy.
        if (slider.fillRect != null)
        {
            var fill = slider.fillRect.GetComponent<Image>();
            if (fill != null) fill.color = fillColor;
        }
        var bg = slider.transform.Find("Background");
        if (bg != null && bg.TryGetComponent<Image>(out var image))
            image.color = new Color32(48, 57, 70, 245);
    }

    private static void PlaceBarText(TMP_Text label, RectTransform bars, float top)
    {
        if (label == null || bars == null) return;
        if (label.transform.parent != bars)
            label.transform.SetParent(bars, false);
        var rt = label.rectTransform;
        rt.anchorMin = new Vector2(0, 1);
        rt.anchorMax = new Vector2(1, 1);
        rt.pivot = new Vector2(0.5f, 1);
        rt.anchoredPosition = new Vector2(0, top);
        rt.sizeDelta = new Vector2(-36, 28);
        label.fontSize = 13;
        label.alignment = TextAlignmentOptions.Center;
        label.color = Color.white;
        label.raycastTarget = false;
    }

    private void OnDestroy()
    {
        if (Instance == this) Instance = null;
    }
}
