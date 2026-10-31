using Newtonsoft.Json.Linq;

namespace ZagoQuest.Networking.Handlers
{
    public class LootErrorHandler : IMessageHandler
    {
        public void Handle(JObject json, NetworkContext context)
        {
            context.LootUI?.OnLootError(
                json["message"]?.ToString() ?? "O servidor recusou a coleta.");
        }
    }
}
