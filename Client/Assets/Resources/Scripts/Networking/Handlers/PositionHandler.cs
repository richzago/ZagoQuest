using Newtonsoft.Json.Linq;
using UnityEngine;
using ZagoQuest.Networking.Messages;

namespace ZagoQuest.Networking.Handlers
{
    public class PositionHandler : IMessageHandler
    {
        public void Handle(JObject json, NetworkContext context)
        {
            var posMsg = json.ToObject<PositionMessage>();

            PlayerController.Instance?.OnPositionReceived(new Vector2(posMsg.x, posMsg.y));
        }
    }
}