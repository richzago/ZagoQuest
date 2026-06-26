using Newtonsoft.Json.Linq;
using UnityEngine;
using ZagoQuest.Networking.Messages;

namespace ZagoQuest.Networking.Handlers
{
    public class BankErrorHandler : IMessageHandler
    {
        public void Handle(JObject json, NetworkContext context)
        {
            var bankErrMsg = json.ToObject<BankErrorMessage>();
            Debug.LogError($"Erro no banco: {bankErrMsg.message}");
            context.ChatUI?.AddMessage($"Banco: {bankErrMsg.message}");
        }
    }
}