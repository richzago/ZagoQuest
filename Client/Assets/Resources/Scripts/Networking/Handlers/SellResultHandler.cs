using Newtonsoft.Json.Linq;
using ZagoQuest.Networking.Messages;

namespace ZagoQuest.Networking.Handlers
{
    /// <summary>O Node confirma a venda, depois envia inventory/gold reais.</summary>
    public class SellResultHandler : IMessageHandler
    {
        public void Handle(JObject json, NetworkContext context)
        {
            var result = json.ToObject<SellResultMessage>();
            if (result != null)
                context.ShopUI?.ShowSellResult(result.success, result.message);
        }
    }
}
