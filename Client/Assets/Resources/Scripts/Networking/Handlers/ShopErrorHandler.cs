using Newtonsoft.Json.Linq;
using UnityEngine;
using ZagoQuest.Networking.Messages;

namespace ZagoQuest.Networking.Handlers
{
    public class ShopErrorHandler : IMessageHandler
    {
        public void Handle(JObject json, NetworkContext context)
        {
            var shopErrMsg = json.ToObject<ShopErrorMessage>();
            // Recusa de interação é feedback de gameplay, não exceção do cliente.
            Debug.LogWarning($"[SHOP] Interação recusada pelo Node: {shopErrMsg.message}");
            context.ChatUI?.AddMessage($"Loja: {shopErrMsg.message}");
        }
    }
}