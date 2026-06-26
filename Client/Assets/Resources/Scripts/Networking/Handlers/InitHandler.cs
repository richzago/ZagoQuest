using Newtonsoft.Json.Linq;
using UnityEngine;
using ZagoQuest.Networking.Messages;

namespace ZagoQuest.Networking.Handlers
{
    public class InitHandler : IMessageHandler
    {
        public void Handle(JObject json, NetworkContext context)
        {
            var initMsg = json.ToObject<InitMessage>();
            var pos = new Vector2(initMsg.x, initMsg.y);
            context.NetworkManager.SetInitData(initMsg.playerId, pos);
            context.NetworkManager.SetConnected(true);
            context.PlayerController?.OnServerInit(initMsg.playerId, pos);
        }
    }
}