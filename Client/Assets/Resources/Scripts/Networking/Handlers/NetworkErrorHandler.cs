using Newtonsoft.Json.Linq;
using UnityEngine;
using ZagoQuest.Networking.Messages;

namespace ZagoQuest.Networking.Handlers
{
    /// <summary>
    /// Aviso enviado quando o servidor rejeita um comando malformado.
    /// O servidor continua sendo a fonte da verdade; o cliente apenas informa.
    /// </summary>
    public class NetworkErrorHandler : IMessageHandler
    {
        public void Handle(JObject json, NetworkContext context)
        {
            string message = json.Value<string>("message") ?? "Comando inválido.";
            Debug.LogWarning($"[NETWORK] Mensagem recusada pelo servidor: {message}");
        }
    }
}
