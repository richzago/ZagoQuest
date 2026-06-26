using UnityEngine;
using UnityEngine.UI;
using TMPro;

public class BankUI : MonoBehaviour
{
    public static BankUI Instance { get; private set; }

    [Header("References")]
    public GameObject bankPanel;
    public TextMeshProUGUI bankGoldText;
    public TextMeshProUGUI inventoryGoldText;
    public Button closeButton;

    private NetworkManager networkManager;

    // =========================
    // CICLO DE VIDA
    // =========================

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
        if (networkManager == null)
        {
            Debug.LogError("BankUI: NetworkManager não encontrado!");
            return;
        }



        if (closeButton != null)
            closeButton.onClick.AddListener(() => CloseBank());
        if (bankPanel != null)
            bankPanel.SetActive(false);
        else
            Debug.LogError("BankUI: bankPanel não atribuído!");
    }

    // =========================
    // MÉTODOS PÚBLICOS PARA HANDLERS
    // =========================

    public void ShowBankWindow(string npcId, int bankGold, int inventoryGold)
    {
        Debug.Log($"BankUI.ShowBankWindow: bankGold={bankGold}, inventoryGold={inventoryGold}");
        if (bankGoldText != null)
            bankGoldText.text = $"{bankGold} gold";
        if (inventoryGoldText != null)
            inventoryGoldText.text = $"{inventoryGold} gold";
        if (bankPanel != null)
            bankPanel.SetActive(true);
    }

    public void UpdateBankResult(bool success, string message, int bankGold, int inventoryGold)
    {
        if (ChatUI.Instance != null)
            ChatUI.Instance.AddMessage($"Banco: {message}");
        if (success)
        {
            if (bankGoldText != null)
                bankGoldText.text = $"{bankGold} gold";
            if (inventoryGoldText != null)
                inventoryGoldText.text = $"{inventoryGold} gold";
        }
    }

    private void CloseBank()
    {
        if (bankPanel != null)
            bankPanel.SetActive(false);
    }

    // =========================
    // EVENTOS DO NETWORK (mantido para compatibilidade)
    // =========================

    private void ShowBankWindowEvent(int bankGold, int inventoryGold)
    {
        // O evento antigo não passava npcId, então usamos null
        ShowBankWindow(null, bankGold, inventoryGold);
    }

    private void UpdateBankResultEvent(bool success, string message, int bankGold, int inventoryGold)
    {
        UpdateBankResult(success, message, bankGold, inventoryGold);
    }

    // =========================
    // LIMPEZA
    // =========================

    private void OnDestroy()
    {

    }
}