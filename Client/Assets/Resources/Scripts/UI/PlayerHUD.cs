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

    // 🔥 Armazenar o xpToNext
    private int currentXpToNext = 100;

    private NetworkManager networkManager;

    private void Awake()
    {
        if (Instance == null)
            Instance = this;
        else
            Destroy(gameObject);
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

    // 🔥 NOVO: recebe PlayerStatsData diretamente
    private void UpdateStatsFull(PlayerStatsData stats)
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

    private void OnDestroy()
    {

    }
}