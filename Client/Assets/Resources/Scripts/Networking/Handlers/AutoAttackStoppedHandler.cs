using Newtonsoft.Json.Linq;

namespace ZagoQuest.Networking.Handlers
{
    public class AutoAttackStoppedHandler : IMessageHandler
    {
        public void Handle(JObject json, NetworkContext context)
        {
            // ACK/erro do servidor: não enviar outro stopAutoAttack para o Node.
            context.TargetSelector?.OnServerAutoAttackStopped(
                json.Value<string>("targetId"),
                json.Value<string>("reason")
            );
        }
    }
}