using Newtonsoft.Json.Linq;

namespace ZagoQuest.Networking.Handlers
{
    public class LootErrorHandler : IMessageHandler
    {
        public void Handle(JObject json, NetworkContext context)
        {
            // var lootErrorMsg = json.ToObject<LootErrorMessage>();
            // Debug.LogError($"Erro ao lootear: {lootErrorMsg.message}");
        }
    }
}