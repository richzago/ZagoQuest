using UnityEngine;
using NativeWebSocket;
using ZagoQuest.Networking.Messages;

namespace ZagoQuest.Networking.Senders
{
    /// <summary>
    /// Responsável por enviar mensagens de chat.
    /// </summary>
    public class ChatSender : BaseSender
    {
        public ChatSender(WebSocket websocket) : base(websocket) { }

        public void SendChat(string message)
        {
            var msg = new ChatMessage
            {
                type = "chat",
                message = message
            };
            Debug.Log($"[ChatSender] Enviando chat: {message}");
            Send(msg);
        }
    }
}