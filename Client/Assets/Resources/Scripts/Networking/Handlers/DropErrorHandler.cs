using Newtonsoft.Json.Linq;
using UnityEngine;
using ZagoQuest.Networking.Messages;

namespace ZagoQuest.Networking.Handlers
{
    public class DropErrorHandler : IMessageHandler
    {
        public void Handle(JObject json, NetworkContext context)
        {
            var dropErr = json.ToObject<DropErrorMessage>();
            Debug.LogError($"[Drop] Erro: {dropErr.message}");
            context.ChatUI?.AddMessage($"Erro: {dropErr.message}");
        }
    }
}