using Newtonsoft.Json.Linq;

namespace ZagoQuest.Networking.Handlers
{
    public class AutoAttackStoppedHandler : IMessageHandler
    {
        public void Handle(JObject json, NetworkContext context)
        {
            context.TargetSelector?.ClearTarget();
        }
    }
}