using Newtonsoft.Json.Linq;
using ZagoQuest.Networking.Messages;

namespace ZagoQuest.Networking.Handlers
{
    public class BuyResultHandler : IMessageHandler
    {
        public void Handle(JObject json, NetworkContext context)
        {
            var buyResultMsg = json.ToObject<BuyResultMessage>();
            context.ShopUI?.ShowBuyResult(buyResultMsg.success, buyResultMsg.message);
        }
    }
}