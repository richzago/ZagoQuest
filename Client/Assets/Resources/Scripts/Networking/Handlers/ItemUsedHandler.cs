using Newtonsoft.Json.Linq;
using ZagoQuest.Networking.Messages;

namespace ZagoQuest.Networking.Handlers
{
    public class ItemUsedHandler : IMessageHandler
    {
        public void Handle(JObject json, NetworkContext context)
        {
            var itemUsedMsg = json.ToObject<ItemUsedMessage>();
            context.ChatUI?.AddMessage($"Item: {itemUsedMsg.message}");
        }
    }
}