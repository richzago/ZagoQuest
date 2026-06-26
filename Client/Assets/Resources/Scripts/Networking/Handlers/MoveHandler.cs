using Newtonsoft.Json.Linq;
using UnityEngine;
using ZagoQuest.Networking.Messages;

namespace ZagoQuest.Networking.Handlers
{
    public class MoveHandler : IMessageHandler
    {
        public void Handle(JObject json, NetworkContext context)
        {
            var moveMsg = json.ToObject<MoveEntityMessage>();
            if (context.EntityManager != null)
                context.EntityManager.MoveEntity(moveMsg.id, moveMsg.x, moveMsg.y);
            else
                Debug.LogWarning("[MoveHandler] EntityManager indisponível.");
        }
    }
}