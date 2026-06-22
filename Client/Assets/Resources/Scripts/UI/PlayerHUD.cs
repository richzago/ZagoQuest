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

    private NetworkManager networkManager;

    void Start()
    {
        networkManager = NetworkManager.Instance;
        if (networkManager == null) return;

        networkManager.OnPlayerStats += UpdateStats;
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

        // XP
        if (xpSlider != null)
        {
            int xpNeeded = GetXpForNextLevel(level);
            xpSlider.maxValue = xpNeeded;
            xpSlider.value = xp;
        }
        if (xpText != null)
        {
            int xpNeeded = GetXpForNextLevel(level);
            xpText.text = $"{xp}/{xpNeeded}";
        }

        // Level
        if (levelText != null)
            levelText.text = $"Nv. {level}";
    }

    private int GetXpForNextLevel(int level)
    {
        // Fórmula simples: 100 * level (ajuste conforme sua fórmula do servidor)
        return 100 * level;
    }

    void OnDestroy()
    {
        if (networkManager != null)
            networkManager.OnPlayerStats -= UpdateStats;
    }
}