using Newtonsoft.Json.Linq;
using ZagoQuest.Networking.Messages;

namespace ZagoQuest.Networking.Handlers
{
    public class MoveHandler : IMessageHandler
    {
        public void Handle(JObject json, NetworkContext context)
        {
            var moveMsg = json.ToObject<MoveEntityMessage>();
            context.EntityManager?.MoveEntity(moveMsg.id, moveMsg.x, moveMsg.y);
        }
    }
}