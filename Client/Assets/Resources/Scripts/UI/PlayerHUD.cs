// Assets/Resources/Scripts/UI/PlayerHUD.cs
using UnityEngine;
using UnityEngine.UI;
using TMPro;

public class PlayerHUD : MonoBehaviour
{
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

    // 🔥 Armazenar o xpToNext
    private int currentXpToNext = 100;

    private NetworkManager networkManager;

    void Start()
    {
        networkManager = NetworkManager.Instance;
        if (networkManager == null) return;

        // 🔥 Evento antigo (compatibilidade com HUD)
        networkManager.OnPlayerStats += UpdateStats;

        // 🔥 NOVO: evento com PlayerStatsData
        NetworkManager.OnPlayerStatsFull += UpdateStatsFull;

        networkManager.OnInit += (id, pos) =>
        {
            if (playerNameText != null) playerNameText.text = "Richard";
        };

        networkManager.OnPositionReceived += (pos) =>
        {
            if (positionText != null) positionText.text = $"({pos.x:F1}, {pos.y:F1})";
        };
    }

    void Update()
    {
        if (fpsText != null)
            fpsText.text = $"FPS: {Mathf.Round(1f / Time.unscaledDeltaTime)}";
    }

    // 🔥 MANTIDO: para compatibilidade com o evento antigo
    void UpdateStats(int hp, int maxHp, int mana, int maxMana, int level, int attack, int defense, int xp)
    {
        // HP
        if (hpSlider != null)
        {
            hpSlider.maxValue = maxHp;
            hpSlider.value = hp;
        }
        if (hpText != null)
            hpText.text = $"{hp}/{maxHp}";

        // Mana
        if (manaSlider != null)
        {
            manaSlider.maxValue = maxMana;
            manaSlider.value = mana;
        }
        if (manaText != null)
            manaText.text = $"{mana}/{maxMana}";

        // XP (usando o valor armazenado)
        if (xpSlider != null)
        {
            xpSlider.maxValue = currentXpToNext;
            xpSlider.value = xp;
        }
        if (xpText != null)
            xpText.text = $"{xp}/{currentXpToNext}";

        // Level
        if (levelText != null)
            levelText.text = $"Nv. {level}";
    }

    // 🔥 NOVO: recebe PlayerStatsData diretamente
    void UpdateStatsFull(PlayerStatsData stats)
    {
        if (stats == null) return;

        // Armazena o xpToNext para usar na barra
        currentXpToNext = stats.xpToNext;

        // Reutiliza o método existente
        UpdateStats(
            stats.hp,
            stats.maxHp,
            stats.mana,
            stats.maxMana,
            stats.level,
            stats.attack,
            stats.defense,
            stats.xp
        );
    }

    void OnDestroy()
    {
        if (networkManager != null)
        {
            networkManager.OnPlayerStats -= UpdateStats;
        }
        NetworkManager.OnPlayerStatsFull -= UpdateStatsFull;
    }
}