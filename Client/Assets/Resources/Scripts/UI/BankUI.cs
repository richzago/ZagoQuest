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
    private bool transferPending;

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
        WorldWindowLayout.PreparePanel(bankPanel, 480f, 370f);
        // Elementos serializados do BankPanel são filhos diretos e estavam
        // distribuídos por coordenadas fixas fora da área visível da janela.
        WorldWindowLayout.Place(inventoryGoldText, 0.08f, 0.68f, 0.92f, 0.81f,
            18, WorldWindowLayout.Label);
        WorldWindowLayout.Place(bankGoldText, 0.08f, 0.53f, 0.92f, 0.66f,
            18, WorldWindowLayout.Gold);
        if (amountInput != null)
            WorldWindowLayout.Place(amountInput.GetComponent<RectTransform>(),
                0.08f, 0.35f, 0.92f, 0.48f);
        if (depositButton != null)
            WorldWindowLayout.Place(depositButton.GetComponent<RectTransform>(),
                0.08f, 0.16f, 0.48f, 0.30f);
        if (withdrawButton != null)
            WorldWindowLayout.Place(withdrawButton.GetComponent<RectTransform>(),
                0.52f, 0.16f, 0.92f, 0.30f);
        if (closeButton != null)
            WorldWindowLayout.Place(closeButton.GetComponent<RectTransform>(),
                0.76f, 0.87f, 0.94f, 0.96f);
        WorldWindowLayout.StyleButton(closeButton);
        WorldWindowLayout.StyleButton(depositButton);
        WorldWindowLayout.StyleButton(withdrawButton);
        if (bankGoldText != null)
        {
            bankGoldText.color = WorldWindowLayout.Gold;
            bankGoldText.enableAutoSizing = true;
            bankGoldText.fontSizeMin = 14;
        }
        if (inventoryGoldText != null)
        {
            inventoryGoldText.color = WorldWindowLayout.Label;
            inventoryGoldText.enableAutoSizing = true;
            inventoryGoldText.fontSizeMin = 14;
        }
        if (amountInput != null && amountInput.targetGraphic is Image amountBackground)
            amountBackground.color = WorldWindowLayout.Row;

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
        SetTransferPending(false);
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
        // ACK/erro libera os botões; o saldo só muda se o Node confirmar.
        SetTransferPending(false);
        if (!success) return;

        UpdateBalances(bankGold, inventoryGold);
        if (amountInput != null) amountInput.text = string.Empty;
    }

    private void UpdateBalances(int bankGold, int inventoryGold)
    {
        // Valores recebidos do Node; identificação clara da origem do saldo.
        if (bankGoldText != null) bankGoldText.text = $"Saldo no banco: {bankGold:N0} gold";
        if (inventoryGoldText != null) inventoryGoldText.text = $"Ouro em mãos: {inventoryGold:N0} gold";
    }

    private bool TryGetAmount(out int amount)
    {
        amount = 0;

        if (transferPending) return false;

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
        SetTransferPending(true);
        NetworkManager.Instance.Bank.SendDeposit(amount);
        // Não atualizar saldo aqui: aguardar bankResult do servidor.
    }

    private void Withdraw()
    {
        if (!TryGetAmount(out int amount)) return;

        Debug.Log($"[BankUI] Solicitando saque de {amount} gold.");
        SetTransferPending(true);
        NetworkManager.Instance.Bank.SendWithdraw(amount);
        // Não atualizar saldo aqui: aguardar bankResult do servidor.
    }

    /// <summary>Impede solicitações simultâneas no mesmo painel, sem tocar nos saldos.</summary>
    private void SetTransferPending(bool pending)
    {
        transferPending = pending;
        if (depositButton != null) depositButton.interactable = !pending;
        if (withdrawButton != null) withdrawButton.interactable = !pending;
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
        SetTransferPending(false);
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
