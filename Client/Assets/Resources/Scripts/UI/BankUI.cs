using UnityEngine;
using UnityEngine.UI;
using TMPro;

public class BankUI : MonoBehaviour
{
    [Header("References")]
    public GameObject bankPanel;
    public TextMeshProUGUI goldText;
    public TextMeshProUGUI bankGoldText;
    public TMP_InputField amountInput;
    public Button depositButton;
    public Button withdrawButton;
    public Button closeButton;

    private NetworkManager networkManager;

    void Start()
    {
        networkManager = NetworkManager.Instance;
        if (networkManager == null)
        {
            Debug.LogError("BankUI: NetworkManager não encontrado!");
            return;
        }

        // Assina os eventos
        networkManager.OnBankWindow += OpenBank;
        networkManager.OnBankResult += UpdateBankUI;

        Debug.Log("BankUI: inscrito nos eventos OnBankWindow e OnBankResult.");

        // Configura botões
        if (depositButton != null)
            depositButton.onClick.AddListener(() =>
            {
                if (int.TryParse(amountInput.text, out int amount) && amount > 0)
                    networkManager.SendDeposit(amount);
                else
                    Debug.LogWarning("Valor inválido para depósito.");
            });
        if (withdrawButton != null)
            withdrawButton.onClick.AddListener(() =>
            {
                if (int.TryParse(amountInput.text, out int amount) && amount > 0)
                    networkManager.SendWithdraw(amount);
                else
                    Debug.LogWarning("Valor inválido para saque.");
            });
        if (closeButton != null)
            closeButton.onClick.AddListener(() =>
            {
                if (bankPanel != null) bankPanel.SetActive(false);
            });

        // Garante que o painel comece desativado
        if (bankPanel != null)
            bankPanel.SetActive(false);
        else
            Debug.LogError("BankUI: bankPanel não atribuído no Inspector!");
    }

    private void OpenBank(int bankGold, int currentGold)
    {
        Debug.Log($"BankUI.OpenBank chamado! bankGold={bankGold}, currentGold={currentGold}");
        if (goldText != null)
            goldText.text = $"💰 Gold: {currentGold}";
        else
            Debug.LogError("BankUI: goldText é nulo!");

        if (bankGoldText != null)
            bankGoldText.text = $"🏦 Banco: {bankGold}";
        else
            Debug.LogError("BankUI: bankGoldText é nulo!");

        if (bankPanel != null)
        {
            bankPanel.SetActive(true);
            Debug.Log("BankUI: bankPanel ativado (SetActive true)");
        }
        else
        {
            Debug.LogError("BankUI: bankPanel é nulo, não foi possível ativar!");
        }
    }

    private void UpdateBankUI(bool success, string message, int bankGold, int currentGold)
    {
        Debug.Log($"BankUI.UpdateBankUI: success={success}, msg={message}, bank={bankGold}, gold={currentGold}");
        if (success)
        {
            if (goldText != null) goldText.text = $"💰 Gold: {currentGold}";
            if (bankGoldText != null) bankGoldText.text = $"🏦 Banco: {bankGold}";
        }
        if (ChatUI.Instance != null)
            ChatUI.Instance.AddMessage($"Banco: {message}");
    }

    private void OnDestroy()
    {
        if (networkManager != null)
        {
            networkManager.OnBankWindow -= OpenBank;
            networkManager.OnBankResult -= UpdateBankUI;
        }
    }
}