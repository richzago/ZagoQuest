using TMPro;
using UnityEngine;
using UnityEngine.UI;

/// <summary>
/// C6 — Apresentação de snapshots autoritativos do Node. Valores de HP, mana,
/// nível, XP e posição são fornecidos pelos handlers; sliders só os exibem.
/// </summary>
public class PlayerHUD : MonoBehaviour
{
    public static PlayerHUD Instance { get; private set; }

    [Header("Barras")]
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

    private int currentXpToNext = 100;
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

    private void Start()
    {
        StyleGameplayHud();
    }

    private void Update()
    {
        if (fpsText == null) return;

        // Media por janela de meio segundo, em vez de alocar string por frame.
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

    // Assinatura antiga mantida para handlers legados. Nenhum cálculo de
    // progressão, dano ou regeneração é feito pela UI.
    public void UpdateStats(int hp, int maxHp, int mana, int maxMana,
        int level, int attack, int defense, int xp)
    {
        DisplayBar(hpSlider, hp, maxHp);
        DisplayBar(manaSlider, mana, maxMana);
        DisplayBar(xpSlider, xp, currentXpToNext);

        if (hpText != null) hpText.text = $"{hp:N0} / {maxHp:N0}";
        if (manaText != null) manaText.text = $"{mana:N0} / {maxMana:N0}";
        if (xpText != null) xpText.text = $"{xp:N0} / {currentXpToNext:N0}";
        if (levelText != null) levelText.text = $"Nv. {level:N0}";
    }

    /// <summary>
    /// Snapshot: XP total e progresso de nível não são intercambiáveis.
    /// O clamp é apenas para a renderização: não altera stats nem envia dados.
    /// </summary>
    public void UpdateStats(PlayerStatsData stats)
    {
        if (stats == null) return;
        currentXpToNext = Mathf.Max(1, stats.levelXpToNext);

        UpdateStats(stats.hp, stats.maxHp, stats.mana, stats.maxMana,
            stats.level, stats.attack, stats.defense, stats.levelXp);

        if (stats.levelXpToNext <= 0)
        {
            DisplayBar(xpSlider, 1, 1);
            if (xpText != null) xpText.text = $"XP total: {stats.xp:N0} (MAX)";
            return;
        }

        if (xpText != null)
            xpText.text = $"{stats.levelXp:N0} / {stats.levelXpToNext:N0}  ·  Total: {stats.xp:N0}";
    }

    private static void DisplayBar(Slider slider, int value, int maximum)
    {
        if (slider == null) return;
        slider.interactable = false; // O jogador não edita stats pelo Slider.
        slider.wholeNumbers = true;
        slider.minValue = 0;
        slider.maxValue = Mathf.Max(1, maximum);
        slider.value = Mathf.Clamp(value, 0, Mathf.Max(1, maximum));
    }

    private void StyleGameplayHud()
    {
        // TopCenter contém os PlayerBars do PlayerHUD (não os do StatusManager).
        // O HUD precisa funcionar na cena antiga sem alterar .unity nem prefabs.
        var root = playerNameText != null
            ? playerNameText.transform.parent as RectTransform : null;
        if (root == null) return;
        root.anchorMin = root.anchorMax = new Vector2(0.5f, 1);
        root.pivot = new Vector2(0.5f, 1);
        root.anchoredPosition = new Vector2(0, -12);
        root.sizeDelta = new Vector2(358, 215);
        root.localScale = Vector3.one;

        var image = root.GetComponent<Image>();
        if (image == null) image = root.gameObject.AddComponent<Image>();
        image.color = new Color32(19, 27, 39, 235);
        image.raycastTarget = false; // HUD passiva não bloqueia mundo/seleção.

        var outline = root.GetComponent<Outline>();
        if (outline == null) outline = root.gameObject.AddComponent<Outline>();
        outline.effectColor = new Color32(173, 136, 74, 190);
        outline.effectDistance = new Vector2(1, -1);

        PlaceHeader(playerNameText, -12, 30, 21,
            new Color32(235, 191, 109, 255));
        PlaceHeader(levelText, -45, 26, 15,
            new Color32(220, 226, 229, 255));

        var bars = hpSlider != null ? hpSlider.transform.parent as RectTransform : null;
        if (bars != null && bars.parent == root)
        {
            bars.anchorMin = Vector2.zero;
            bars.anchorMax = Vector2.one;
            bars.offsetMin = Vector2.zero;
            bars.offsetMax = Vector2.zero;
        }

        PlaceBar(hpSlider, -76);
        PlaceBar(manaSlider, -119);
        PlaceBar(xpSlider, -162);
        PlaceBarText(hpText, bars, -77);
        PlaceBarText(manaText, bars, -120);
        PlaceBarText(xpText, bars, -163);

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

    private static void PlaceBar(Slider slider, float top)
    {
        if (slider == null) return;
        var rt = slider.transform as RectTransform;
        if (rt == null) return;
        rt.anchorMin = new Vector2(0, 1);
        rt.anchorMax = new Vector2(1, 1);
        rt.pivot = new Vector2(0.5f, 1);
        rt.anchoredPosition = new Vector2(0, top);
        rt.sizeDelta = new Vector2(-32, 26);
        slider.interactable = false;
    }

    private static void PlaceBarText(TMP_Text label, RectTransform bars, float top)
    {
        if (label == null || bars == null) return;
        // A cena antiga contém textos soltos dentro de PlayerBars; manter
        // referências e reposicioná-los, sem duplicar componentes.
        if (label.transform.parent != bars)
            label.transform.SetParent(bars, false);
        var rt = label.rectTransform;
        rt.anchorMin = new Vector2(0, 1);
        rt.anchorMax = new Vector2(1, 1);
        rt.pivot = new Vector2(0.5f, 1);
        rt.anchoredPosition = new Vector2(0, top);
        rt.sizeDelta = new Vector2(-36, 24);
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
