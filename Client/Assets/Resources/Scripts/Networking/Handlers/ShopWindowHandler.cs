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
            UnityEngine.Debug.Log($"[ShopWindowHandler] shopWindow recebido: npcId={shopMsg.npcId}");
            if (context.ShopUI == null)
                UnityEngine.Debug.LogError("[ShopWindowHandler] ShopUI.Instance ausente. Verifique ShopManager ativo na Hierarchy.");
            else
                context.ShopUI.ShowShopWindow(shopMsg.npcId, shopMsg.items);
        }
    }
}