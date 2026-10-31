using System.Collections.Generic;
using System.Text;
using TMPro;
using UnityEngine;
using UnityEngine.UI;
using UnityEngine.InputSystem;

/// <summary>
/// C6 — Chat é uma interface de intenção e feedback. O Node valida canais,
/// permissões e mensagens; nenhum comando é executado localmente.
/// </summary>
public class ChatUI : MonoBehaviour
{
    public static ChatUI Instance { get; private set; }

    public TMP_InputField inputField;
    public Button sendButton;
    public TMP_Text chatDisplay;
    public Button localButton;
    public Button tradeButton;
    public Button supportButton;
    public Button guildButton;

    private const int MaxVisibleMessages = 160;
    private readonly Queue<string> recentMessages = new Queue<string>();
    private readonly StringBuilder historyBuilder = new StringBuilder(8192);
    private string currentChannel = "local";
    private int lastSendFrame = -1;
    private int lastSubmitFrame = -1;
    public static bool IsChatActive { get; private set; }

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
        if (inputField == null || sendButton == null || chatDisplay == null)
        {
            Debug.LogError("[ChatUI] Falta Input, SendButton ou ChatDisplay no Inspector.");
            return;
        }

        // SingleLine usa o evento de submit do TMP para enviar Enter UMA vez.
        // Update só abre o campo, nunca envia ao mesmo tempo que onSubmit.
        inputField.lineType = TMP_InputField.LineType.SingleLine;
        inputField.onSubmit.AddListener(OnSubmit);
        inputField.onSelect.AddListener(OnSelect);
        inputField.onDeselect.AddListener(OnDeselect);
        sendButton.onClick.AddListener(SendChat);
        if (localButton != null) localButton.onClick.AddListener(SelectLocal);
        if (tradeButton != null) tradeButton.onClick.AddListener(SelectTrade);
        if (supportButton != null) supportButton.onClick.AddListener(SelectSupport);
        if (guildButton != null) guildButton.onClick.AddListener(SelectGuild);

        // Não interpretar como marcação TMP texto recebido de outro jogador.
        chatDisplay.richText = false;
        chatDisplay.raycastTarget = false;
        StyleChatPanel();
        SetChannel("local");
        DeactivateChat();
    }

    private void Update()
    {
        if (inputField == null || Keyboard.current == null) return;
        if (Keyboard.current.escapeKey.wasPressedThisFrame && IsChatActive)
        {
            inputField.text = string.Empty;
            DeactivateChat();
            return;
        }

        bool pressedEnter = Keyboard.current.enterKey.wasPressedThisFrame ||
                            Keyboard.current.numpadEnterKey.wasPressedThisFrame;
        if (pressedEnter && lastSubmitFrame != Time.frameCount && !IsChatActive &&
            !inputField.isFocused &&
            (UnityEngine.EventSystems.EventSystem.current == null ||
             UnityEngine.EventSystems.EventSystem.current.currentSelectedGameObject == null ||
             UnityEngine.EventSystems.EventSystem.current.currentSelectedGameObject
                 .GetComponentInParent<TMP_InputField>() == null))
            ActivateChat();
    }

    private void ActivateChat()
    {
        if (inputField == null) return;
        IsChatActive = true;
        inputField.Select();
        inputField.ActivateInputField();
    }

    private void DeactivateChat()
    {
        IsChatActive = false;
        if (inputField != null) inputField.DeactivateInputField();
    }

    private void OnSubmit(string _)
    {
        lastSubmitFrame = Time.frameCount;
        SendChat();
    }
    private void OnSelect(string _) => IsChatActive = true;
    private void OnDeselect(string _) => IsChatActive = false;

    private void SelectLocal() => SetChannel("local");
    private void SelectTrade() => SetChannel("trade");
    private void SelectSupport() => SetChannel("support");
    private void SelectGuild() => SetChannel("guild");

    private void SetChannel(string channel)
    {
        currentChannel = channel;
        HighlightChannel(localButton, channel == "local");
        HighlightChannel(tradeButton, channel == "trade");
        HighlightChannel(supportButton, channel == "support");
        HighlightChannel(guildButton, channel == "guild");
    }

    private static void HighlightChannel(Button button, bool selected)
    {
        if (button == null || button.image == null) return;
        button.image.color = selected
            ? new Color32(137, 109, 67, 255)
            : new Color32(48, 65, 79, 255);
    }

    private void SendChat()
    {
        if (inputField == null || lastSendFrame == Time.frameCount) return;
        string message = inputField.text.Trim();
        if (string.IsNullOrEmpty(message))
        {
            DeactivateChat();
            return;
        }

        var network = NetworkManager.Instance;
        if (network == null || !network.isConnected || network.Chat == null)
        {
            AddMessage("Chat: conexão indisponível. Mensagem não enviada.");
            return; // Mantém o texto para o jogador tentar novamente.
        }

        string outgoing = message.StartsWith("/")
            ? message // Preservar comandos explícitos: backend valida permissões.
            : currentChannel switch
            {
                "trade" => "/t " + message,
                "support" => "/s " + message,
                "guild" => "/gmsg " + message,
                _ => message
            };

        lastSendFrame = Time.frameCount;
        network.Chat.SendChat(outgoing);
        inputField.text = string.Empty;
        DeactivateChat();
    }

    public void AddMessage(string message)
    {
        if (chatDisplay == null || string.IsNullOrEmpty(message)) return;
        // Limitar memória/alocação e impedir crescimento infinito em sessões longas.
        recentMessages.Enqueue(message);
        while (recentMessages.Count > MaxVisibleMessages)
            recentMessages.Dequeue();

        historyBuilder.Clear();
        foreach (var line in recentMessages)
            historyBuilder.AppendLine(line);
        chatDisplay.text = historyBuilder.ToString();

        var scroll = chatDisplay.GetComponentInParent<ScrollRect>();
        if (scroll != null) scroll.verticalNormalizedPosition = 0f;
    }

    private void StyleChatPanel()
    {
        var rect = transform as RectTransform;
        var canvas = GetComponentInParent<Canvas>();
        if (rect == null || canvas == null) return;

        // ButtomLeft da cena tem tamanho/offset rígidos; docking em Canvas
        // preserva a legibilidade também a 1280x720 sem alterar .unity.
        if (transform.parent != canvas.transform)
            transform.SetParent(canvas.transform, false);
        rect.anchorMin = rect.anchorMax = Vector2.zero;
        rect.pivot = Vector2.zero;
        rect.anchoredPosition = new Vector2(16, 16);
        rect.sizeDelta = new Vector2(720, 252);
        rect.localScale = Vector3.one;
        WorldWindowLayout.MakeDraggable(gameObject, "CHAT", "chat");

        var tabs = transform.Find("TabButtons") as RectTransform;
        if (tabs != null)
        {
            tabs.anchorMin = tabs.anchorMax = tabs.pivot = new Vector2(0, 1);
            tabs.anchoredPosition = new Vector2(12, -39);
            tabs.sizeDelta = new Vector2(440, 32);
        }
        Button[] channels = { localButton, tradeButton, supportButton, guildButton };
        for (int index = 0; index < channels.Length; index++)
        {
            if (channels[index] == null) continue;
            var t = channels[index].transform as RectTransform;
            if (t == null) continue;
            t.anchorMin = t.anchorMax = t.pivot = new Vector2(0, 1);
            t.anchoredPosition = new Vector2(index * 106, 0);
            t.sizeDelta = new Vector2(101, 30);
        }

        var scrollRect = transform.Find("ChatScrollView") as RectTransform;
        if (scrollRect != null)
        {
            scrollRect.anchorMin = Vector2.zero;
            scrollRect.anchorMax = Vector2.one;
            scrollRect.offsetMin = new Vector2(12, 53);
            scrollRect.offsetMax = new Vector2(-12, -79);
        }

        var inputRect = inputField.transform as RectTransform;
        if (inputRect != null)
        {
            inputRect.anchorMin = Vector2.zero;
            inputRect.anchorMax = new Vector2(1, 0);
            inputRect.offsetMin = new Vector2(12, 10);
            inputRect.offsetMax = new Vector2(-110, 45);
        }
        var sendRect = sendButton.transform as RectTransform;
        if (sendRect != null)
        {
            sendRect.anchorMin = sendRect.anchorMax = new Vector2(1, 0);
            sendRect.pivot = new Vector2(1, 0);
            sendRect.anchoredPosition = new Vector2(-12, 10);
            sendRect.sizeDelta = new Vector2(88, 35);
        }

        if (inputField.textComponent != null)
            inputField.textComponent.fontSize = 16;
    }

    private void OnDisable() => IsChatActive = false;

    private void OnDestroy()
    {
        if (inputField != null)
        {
            inputField.onSubmit.RemoveListener(OnSubmit);
            inputField.onSelect.RemoveListener(OnSelect);
            inputField.onDeselect.RemoveListener(OnDeselect);
        }
        if (sendButton != null) sendButton.onClick.RemoveListener(SendChat);
        if (localButton != null) localButton.onClick.RemoveListener(SelectLocal);
        if (tradeButton != null) tradeButton.onClick.RemoveListener(SelectTrade);
        if (supportButton != null) supportButton.onClick.RemoveListener(SelectSupport);
        if (guildButton != null) guildButton.onClick.RemoveListener(SelectGuild);
        if (Instance == this) Instance = null;
        IsChatActive = false;
    }
}
