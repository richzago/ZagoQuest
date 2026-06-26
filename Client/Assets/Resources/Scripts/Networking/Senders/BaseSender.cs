using NativeWebSocket;
using UnityEngine;
using System.Threading.Tasks;

namespace ZagoQuest.Networking.Senders
{
    /// <summary>
    /// Classe base para todos os senders.
    /// Centraliza a verificação de conexão e a serialização JSON.
    /// </summary>
    public abstract class BaseSender
    {
        protected readonly WebSocket _websocket;

        protected BaseSender(WebSocket websocket)
        {
            _websocket = websocket;
        }

        /// <summary>
        /// Verifica se o WebSocket está aberto e pronto para enviar.
        /// </summary>
        protected bool CanSend()
        {
            return _websocket != null && _websocket.State == WebSocketState.Open;
        }

        /// <summary>
        /// Serializa o payload para JSON e envia via WebSocket.
        /// </summary>
        protected void Send<T>(T payload)
        {
            if (!CanSend())
            {
                Debug.LogWarning($"[BaseSender] Não foi possível enviar: WebSocket não está aberto.");
                return;
            }

            string json = JsonUtility.ToJson(payload);
            _websocket.SendText(json);
        }

        /// <summary>
        /// Versão assíncrona do envio.
        /// </summary>
        protected async Task SendAsync<T>(T payload)
        {
            if (!CanSend())
            {
                Debug.LogWarning($"[BaseSender] Não foi possível enviar: WebSocket não está aberto.");
                return;
            }

            string json = JsonUtility.ToJson(payload);
            await _websocket.SendText(json);
        }
    }
}