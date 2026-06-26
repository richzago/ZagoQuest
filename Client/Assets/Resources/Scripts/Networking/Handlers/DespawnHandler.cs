using Newtonsoft.Json.Linq;
using ZagoQuest.Networking.Messages;

namespace ZagoQuest.Networking.Handlers
{
    public class DespawnHandler : IMessageHandler
    {
        public void Handle(JObject json, NetworkContext context)
        {
            var despawnMsg = json.ToObject<DespawnMessage>();
            context.EntityManager?.DespawnEntity(despawnMsg.id);
        }
    }
}