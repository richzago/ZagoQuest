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
            // Recusa por alcance/terreno é resultado esperado de validação,
            // não exceção do Unity. O Node não alterou o inventário.
            Debug.LogWarning($"[Drop] Recusado: {dropErr.message}");
            context.ChatUI?.AddMessage($"Drop: {dropErr.message}");
        }
    }
}