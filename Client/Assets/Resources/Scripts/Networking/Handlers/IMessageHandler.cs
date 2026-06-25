using Newtonsoft.Json.Linq;

namespace ZagoQuest.Networking.Handlers
{
    public interface IMessageHandler
    {
        void Handle(JObject json, NetworkContext context);
    }
}