using Newtonsoft.Json.Linq;

namespace ZagoQuest.Networking.Handlers
{
    public class LootTakenHandler : IMessageHandler
    {
        public void Handle(JObject json, NetworkContext context)
        {
            var id = json["corpseId"]?.ToString();
            int? index = json["itemIndex"]?.Type == JTokenType.Integer
                ? json["itemIndex"].Value<int>() : (int?)null;
            context.LootUI?.OnLootTaken(id, index);
        }
    }
}
