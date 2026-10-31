using UnityEngine;
using UnityEngine.UI;
using TMPro;
using UnityEngine.InputSystem;

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
    private InputAction toggleStatusAction;
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

        toggleStatusAction = new InputAction("ToggleStatus", binding: "<Keyboard>/p");
        toggleStatusAction.performed += OnToggleStatus;
        toggleStatusAction.Enable();
    }

    private void OnToggleStatus(InputAction.CallbackContext context)
    {
        var selected = UnityEngine.EventSystems.EventSystem.current?.currentSelectedGameObject;
        if (selected != null && selected.GetComponentInParent<TMP_InputField>() != null) return;
        TogglePanel();
    }

    public void OnCloseButtonClicked() => ClosePanel();

    public void ClosePanel()
    {
        isOpen = false;
        if (statusPanel != null) statusPanel.SetActive(false);
    }

    public void TogglePanel()
    {
        var network = NetworkManager.Instance;
        if (statusPanel == null || network == null || !network.isConnected) return;
        isOpen = !statusPanel.activeSelf;
        statusPanel.SetActive(isOpen);
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
                ? $"XP total: {stats.xp:N0}\nProgresso: {stats.levelXp:N0}/{stats.levelXpToNext:N0}  •  Histórico: {stats.lifetimeXp:N0}"
                : $"XP total: {stats.xp:N0}  •  Nível máximo";
        if (hpText != null) hpText.text = $"VIDA   {stats.hp:N0} / {stats.maxHp:N0}";
        if (manaText != null) manaText.text = $"MANA   {stats.mana:N0} / {stats.maxMana:N0}";
        if (attackText != null) attackText.text = $"Ataque   {stats.attack:N0}";
        if (defenseText != null) defenseText.text = $"Defesa   {stats.defense:N0}";
        if (armorText != null) armorText.text = $"Armadura   {stats.armor:N0}";

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
        rect.anchoredPosition = new Vector2(18, 0);
        rect.sizeDelta = new Vector2(380, 460);
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
        headerText.text = "PERSONAGEM  /  STATUS";
        StyleLabel(headerText, 14, 40, 23, Gold);

        StyleLabel(levelText, 60, 31, 19, Gold);
        StyleLabel(experienceText, 93, 61, 13, Light);
        StyleLabel(hpText, 165, 27, 15, Light);
        StyleSlider(hpSlider, 197, HpRed);
        StyleLabel(manaText, 240, 27, 15, Light);
        StyleSlider(manaSlider, 272, ManaBlue);
        StyleLabel(attackText, 316, 25, 15, Light);
        StyleLabel(defenseText, 348, 25, 15, Light);
        StyleLabel(armorText, 380, 25, 15, Light);
        StyleSlider(experienceSlider, 422, Gold);

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

    private void StyleLabel(TextMeshProUGUI label, float top, float height,
        float font, Color color)
    {
        if (label == null || statusPanel == null) return;
        if (label.transform.parent != statusPanel.transform)
            label.transform.SetParent(statusPanel.transform, false);
        var rt = label.rectTransform;
        rt.anchorMin = new Vector2(0f, 1f);
        rt.anchorMax = new Vector2(1f, 1f);
        rt.pivot = new Vector2(0.5f, 1f);
        rt.anchoredPosition = new Vector2(0, -top);
        rt.sizeDelta = new Vector2(-36, height);
        label.fontSize = font;
        label.alignment = TextAlignmentOptions.MidlineLeft;
        label.color = color;
        label.raycastTarget = false;
    }

    private void StyleSlider(Slider slider, float top, Color color)
    {
        if (slider == null || statusPanel == null) return;
        if (slider.transform.parent != statusPanel.transform)
            slider.transform.SetParent(statusPanel.transform, false);
        var rt = slider.transform as RectTransform;
        if (rt == null) return;
        rt.anchorMin = new Vector2(0f, 1f);
        rt.anchorMax = new Vector2(1f, 1f);
        rt.pivot = new Vector2(0.5f, 1f);
        rt.anchoredPosition = new Vector2(0, -top);
        rt.sizeDelta = new Vector2(-36, 17);
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
        if (toggleStatusAction != null)
        {
            toggleStatusAction.performed -= OnToggleStatus;
            toggleStatusAction.Disable();
            toggleStatusAction.Dispose();
            toggleStatusAction = null;
        }
        if (closeButton != null)
            closeButton.onClick.RemoveListener(OnCloseButtonClicked);
        if (Instance == this) Instance = null;
    }
}
