using UnityEngine;
using UnityEngine.UI;
using TMPro;
using UnityEngine.InputSystem;

public class StatusManager : MonoBehaviour
{
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

    private bool isOpen = false;
    private InputAction toggleStatusAction;

    public bool IsOpen => isOpen;

    private void Start()
    {
        if (NetworkManager.Instance == null)
        {
            Debug.LogError("StatusManager: NetworkManager não encontrado!");
            return;
        }

        if (statusPanel != null)
        {
            statusPanel.SetActive(false);
            isOpen = false;
        }
        else
        {
            Debug.LogError("StatusManager: statusPanel não está referenciado!");
            return;
        }

        // Busca o CloseButton se não estiver referenciado
        if (closeButton == null && statusPanel != null)
        {
            Transform btnTransform = statusPanel.transform.Find("CloseButton");
            if (btnTransform != null)
                closeButton = btnTransform.GetComponent<Button>();
            else
                closeButton = statusPanel.GetComponentInChildren<Button>(true);

            if (closeButton == null)
                closeButton = FindAnyObjectByType<Button>();
        }

        if (closeButton != null)
        {
            closeButton.onClick.RemoveAllListeners();
            closeButton.onClick.AddListener(OnCloseButtonClicked);
        }
        else
        {
            Debug.LogError("StatusManager: CloseButton não encontrado!");
            return;
        }

        // Tecla 'P' para abrir/fechar
        toggleStatusAction = new InputAction("ToggleStatus", binding: "<Keyboard>/p");
        toggleStatusAction.performed += _ => TogglePanel();
        toggleStatusAction.Enable();

        NetworkManager.OnPlayerStatsFull += OnPlayerStatsReceived;
    }

    private void OnDestroy()
    {
        toggleStatusAction.Disable();
        toggleStatusAction.performed -= _ => TogglePanel();
        NetworkManager.OnPlayerStatsFull -= OnPlayerStatsReceived;

        if (closeButton != null)
            closeButton.onClick.RemoveListener(OnCloseButtonClicked);
    }

    public void OnCloseButtonClicked()
    {
        TogglePanel();
    }

    public void TogglePanel()
    {
        isOpen = statusPanel != null && statusPanel.activeSelf;
        isOpen = !isOpen;

        if (statusPanel != null)
        {
            statusPanel.SetActive(isOpen);
            if (isOpen)
            {
                var stats = GameManager.Instance?.PlayerStats;
                if (stats != null)
                    UpdateUI(stats);
            }
        }
    }

    private void OnPlayerStatsReceived(PlayerStatsData stats)
    {
        if (isOpen)
            UpdateUI(stats);
    }

    private void UpdateUI(PlayerStatsData stats)
    {
        if (stats == null) return;

        levelText.text = $"Level: {stats.level}";
        experienceText.text = $"XP: {stats.xp} / {stats.xpToNext}";
        hpText.text = $"HP: {stats.hp} / {stats.maxHp}";
        manaText.text = $"Mana: {stats.mana} / {stats.maxMana}";
        attackText.text = $"Attack: {stats.attack}";
        defenseText.text = $"Defense: {stats.defense}";
        armorText.text = $"Armor: {stats.armor}";

        if (hpSlider != null)
        {
            hpSlider.maxValue = stats.maxHp;
            hpSlider.value = stats.hp;
        }
        if (manaSlider != null)
        {
            manaSlider.maxValue = stats.maxMana;
            manaSlider.value = stats.mana;
        }
        if (experienceSlider != null)
        {
            experienceSlider.maxValue = stats.xpToNext;
            experienceSlider.value = stats.xp;
        }
    }
}