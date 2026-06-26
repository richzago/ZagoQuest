using Newtonsoft.Json.Linq;
using ZagoQuest.Networking.Messages;

namespace ZagoQuest.Networking.Handlers
{
    public class ChatHandler : IMessageHandler
    {
        public void Handle(JObject json, NetworkContext context)
        {
            var chatMsg = json.ToObject<ChatMessageReceived>();
            context.ChatUI?.AddMessage(chatMsg.message);
        }
    }
}