using UnityEngine;
using UnityEngine.UI;
using TMPro;

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

    public void SetPlayerName(string playerName)
    {
        if (playerNameText != null && !string.IsNullOrWhiteSpace(playerName))
            playerNameText.text = playerName;
    }

    // 🔥 Armazenar o xpToNext
    private int currentXpToNext = 100;

    private NetworkManager networkManager;

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
        networkManager = NetworkManager.Instance;
        if (networkManager == null) return;


    }

    private void Update()
    {
        if (fpsText != null)
            fpsText.text = $"FPS: {Mathf.Round(1f / Time.unscaledDeltaTime)}";
    }

    // 🔥 MANTIDO: para compatibilidade com o evento antigo
    public void UpdateStats(int hp, int maxHp, int mana, int maxMana, int level, int attack, int defense, int xp)
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

    /** Snapshot completo: mantém XP cumulativo e usa progresso apenas na barra. */
    public void UpdateStats(PlayerStatsData stats)
    {
        if (stats == null) return;

        currentXpToNext = Mathf.Max(1, stats.levelXpToNext);

        // Reaproveita a atualização de HP, mana e level.
        UpdateStats(
            stats.hp, stats.maxHp, stats.mana, stats.maxMana,
            stats.level, stats.attack, stats.defense, stats.levelXp
        );

        if (xpSlider != null)
            xpSlider.value = stats.levelXpToNext > 0 ? stats.levelXp : 1;

        if (xpText != null)
            xpText.text = stats.levelXpToNext > 0
                ? $"{stats.levelXp:N0}/{stats.levelXpToNext:N0} (total: {stats.xp:N0})"
                : $"XP total: {stats.xp:N0} (MAX)";
    }

    private void OnDestroy()
    {
        // A UI pode ser recriada após reload de cena/Play Mode. Não deixar
        // handlers de rede apontando para uma instância já destruída.
        if (Instance == this) Instance = null;
    }
}