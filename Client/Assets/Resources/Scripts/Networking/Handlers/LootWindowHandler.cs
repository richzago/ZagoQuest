using Newtonsoft.Json.Linq;
using ZagoQuest.Networking.Messages;

namespace ZagoQuest.Networking.Handlers
{
    public class LootWindowHandler : IMessageHandler
    {
        public void Handle(JObject json, NetworkContext context)
        {
            var lootMsg = json.ToObject<LootWindowMessage>();
            context.LootUI?.ShowLootWindow(lootMsg.corpseId, lootMsg.items);
        }
    }
}