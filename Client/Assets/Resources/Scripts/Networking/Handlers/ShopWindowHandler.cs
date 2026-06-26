using Newtonsoft.Json.Linq;
using ZagoQuest.Networking.Messages;

namespace ZagoQuest.Networking.Handlers
{
    public class ShopWindowHandler : IMessageHandler
    {
        public void Handle(JObject json, NetworkContext context)
        {
            var shopMsg = json.ToObject<ShopWindowMessage>();
            // 🔥 Chama diretamente a UI
            context.ShopUI?.ShowShopWindow(shopMsg.npcId, shopMsg.items);
        }
    }
}