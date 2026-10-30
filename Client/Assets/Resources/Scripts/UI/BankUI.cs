using UnityEngine;
using UnityEngine.UI;
using TMPro;

/// <summary>
/// Banco no Unity: somente envia a intenção; o Node.js autoriza a sessão
/// do Banker e valida/movimenta os saldos. Nada é creditado localmente.
/// </summary>
public class BankUI : MonoBehaviour
{
    public static BankUI Instance { get; private set; }

    [Header("References")]
    public GameObject bankPanel;
    public TextMeshProUGUI bankGoldText;
    public TextMeshProUGUI inventoryGoldText;
    public Button closeButton;

    [Header("Transferências")]
    public TMP_InputField amountInput;
    public Button depositButton;
    public Button withdrawButton;

    private string currentNpcId;

    private void Awake()
    {
        if (Instance == null) Instance = this;
        else
        {
            Destroy(gameObject);
            return;
        }
    }

    private void Start()
    {
        // Registrar SOMENTE uma vez, em código. Os OnClick persistentes da
        // cena são vazios para não enviar duas transferências por clique.
        if (closeButton != null) closeButton.onClick.AddListener(CloseBank);
        else Debug.LogError("[BankUI] closeButton não atribuído.");

        if (depositButton != null) depositButton.onClick.AddListener(Deposit);
        else Debug.LogError("[BankUI] depositButton não atribuído.");

        if (withdrawButton != null) withdrawButton.onClick.AddListener(Withdraw);
        else Debug.LogError("[BankUI] withdrawButton não atribuído.");

        if (amountInput != null)
        {
            amountInput.contentType = TMP_InputField.ContentType.IntegerNumber;
            amountInput.text = string.Empty;
        }
        else Debug.LogError("[BankUI] amountInput não atribuído.");

        if (bankPanel != null) bankPanel.SetActive(false);
        else Debug.LogError("[BankUI] bankPanel não atribuído.");

        if (bankGoldText == null || inventoryGoldText == null)
            Debug.LogError("[BankUI] Textos de saldos não atribuídos no Inspector.");
    }

    public void ShowBankWindow(string npcId, int bankGold, int inventoryGold)
    {
        currentNpcId = npcId;
        UpdateBalances(bankGold, inventoryGold);
        if (amountInput != null) amountInput.text = string.Empty;

        Debug.Log($"[BankUI] Banco aberto: npc={npcId}, banco={bankGold}, carteira={inventoryGold}");
        if (bankPanel != null) bankPanel.SetActive(true);
    }

    /// <summary>
    /// Um resultado negado nunca altera os textos ou o saldo do jogador.
    /// O pacote gold, enviado separadamente pelo servidor após sucesso,
    /// atualiza o inventário através do ServerFeedbackHandler.
    /// </summary>
    public void UpdateBankResult(bool success, string message, int bankGold, int inventoryGold)
    {
        Debug.Log($"[BankUI] bankResult: success={success}, msg={message}, banco={bankGold}, carteira={inventoryGold}");
        ChatUI.Instance?.AddMessage($"Banco: {message}");

        if (!success) return;

        UpdateBalances(bankGold, inventoryGold);
        if (amountInput != null) amountInput.text = string.Empty;
    }

    private void UpdateBalances(int bankGold, int inventoryGold)
    {
        if (bankGoldText != null) bankGoldText.text = $"{bankGold} gold";
        if (inventoryGoldText != null) inventoryGoldText.text = $"{inventoryGold} gold";
    }

    private bool TryGetAmount(out int amount)
    {
        amount = 0;

        if (bankPanel == null || !bankPanel.activeInHierarchy ||
            string.IsNullOrEmpty(currentNpcId))
        {
            ShowLocalError("Abra o banco antes de transferir gold.");
            return false;
        }

        if (amountInput == null ||
            !int.TryParse(amountInput.text.Trim(), out amount) ||
            amount <= 0)
        {
            ShowLocalError("Informe uma quantidade inteira e maior que zero.");
            return false;
        }

        if (NetworkManager.Instance == null ||
            !NetworkManager.Instance.isConnected ||
            NetworkManager.Instance.Bank == null)
        {
            ShowLocalError("Sem conexão com o servidor.");
            return false;
        }

        return true;
    }

    private void Deposit()
    {
        if (!TryGetAmount(out int amount)) return;

        Debug.Log($"[BankUI] Solicitando depósito de {amount} gold.");
        NetworkManager.Instance.Bank.SendDeposit(amount);
        // Não atualizar saldo aqui: aguardar bankResult do servidor.
    }

    private void Withdraw()
    {
        if (!TryGetAmount(out int amount)) return;

        Debug.Log($"[BankUI] Solicitando saque de {amount} gold.");
        NetworkManager.Instance.Bank.SendWithdraw(amount);
        // Não atualizar saldo aqui: aguardar bankResult do servidor.
    }

    private void ShowLocalError(string message)
    {
        Debug.LogWarning($"[BankUI] {message}");
        ChatUI.Instance?.AddMessage($"Banco: {message}");
    }

    private void CloseBank()
    {
        if (bankPanel != null && bankPanel.activeSelf &&
            !string.IsNullOrEmpty(currentNpcId))
            NetworkManager.Instance?.Bank?.SendCloseBank(currentNpcId);

        currentNpcId = null;
        if (amountInput != null) amountInput.text = string.Empty;
        if (bankPanel != null) bankPanel.SetActive(false);
    }

    private void OnDestroy()
    {
        if (closeButton != null) closeButton.onClick.RemoveListener(CloseBank);
        if (depositButton != null) depositButton.onClick.RemoveListener(Deposit);
        if (withdrawButton != null) withdrawButton.onClick.RemoveListener(Withdraw);
        if (Instance == this) Instance = null;
    }
}
