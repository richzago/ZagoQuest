using Newtonsoft.Json.Linq;

namespace ZagoQuest.Networking.Handlers
{
    public class LootTakenHandler : IMessageHandler
    {
        public void Handle(JObject json, NetworkContext context)
        {
            context.LootUI?.CloseLootWindow();
        }
    }
}