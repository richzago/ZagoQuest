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
            Debug.LogError($"Erro na loja: {shopErrMsg.message}");
            context.ChatUI?.AddMessage($"Loja: {shopErrMsg.message}");
        }
    }
}