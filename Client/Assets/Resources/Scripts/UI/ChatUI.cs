using TMPro;
using UnityEngine;
using UnityEngine.UI;
using UnityEngine.InputSystem;

public class ChatUI : MonoBehaviour
{
    public static ChatUI Instance;
    public TMP_InputField inputField;
    public Button sendButton;
    public TMP_Text chatDisplay;
    public Button localButton;
    public Button tradeButton;
    public Button supportButton;
    public Button guildButton;

    private string currentChannel = "local";
    public static bool IsChatActive { get; private set; } = false;

    void Awake() { Instance = this; }

    void Start()
    {
        sendButton.onClick.AddListener(SendChat);
        inputField.onSubmit.AddListener(_ => SendChat());
        inputField.onDeselect.AddListener(_ => DeactivateChat()); // perde foco → desativa

        localButton.onClick.AddListener(() => SetChannel("local"));
        tradeButton.onClick.AddListener(() => SetChannel("trade"));
        supportButton.onClick.AddListener(() => SetChannel("support"));
        if (guildButton) guildButton.onClick.AddListener(() => SetChannel("guild"));

        // Inicia com chat desativado
        DeactivateChat();
    }

    void Update()
    {
        if (Keyboard.current == null) return;

        if (Keyboard.current.enterKey.wasPressedThisFrame || Keyboard.current.numpadEnterKey.wasPressedThisFrame)
        {
            if (!IsChatActive)
                ActivateChat();
            else
                SendChat();
        }

        if (Keyboard.current.escapeKey.wasPressedThisFrame && IsChatActive)
        {
            DeactivateChat();
            inputField.text = "";
        }
    }

    void ActivateChat()
    {
        IsChatActive = true;
        inputField.ActivateInputField();
        inputField.Select();
    }

    void DeactivateChat()
    {
        IsChatActive = false;
        inputField.DeactivateInputField();
        // Opcional: esconder o cursor do texto
    }

    void SetChannel(string channel)
    {
        currentChannel = channel;
        // Debug.Log($"Canal alterado para: {channel}");
    }

    void SendChat()
    {
        string text = inputField.text.Trim();
        if (string.IsNullOrEmpty(text))
        {
            DeactivateChat();
            return;
        }

        if (text.StartsWith("/"))
        {
            NetworkManager.Instance.Chat.SendChat(text);
        }
        else
        {
            string prefixed = currentChannel switch
            {
                "trade" => "/t " + text,
                "support" => "/s " + text,
                "guild" => "/gmsg " + text,
                _ => text
            };
            NetworkManager.Instance.Chat.SendChat(prefixed);
        }

        inputField.text = "";
        DeactivateChat(); // após enviar, desativa o chat
    }

    public void AddMessage(string message)
    {
        chatDisplay.text += message + "\n";
    }
}