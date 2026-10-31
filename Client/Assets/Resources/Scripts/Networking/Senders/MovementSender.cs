using NativeWebSocket;
using UnityEngine;
using ZagoQuest.Networking.Messages;

namespace ZagoQuest.Networking.Senders
{
    /// <summary>
    /// Responsável por enviar comandos de movimento.
    /// </summary>
    public class MovementSender : BaseSender
    {
        public MovementSender(WebSocket websocket) : base(websocket) { }

        /// <summary>
        /// Envia movimento para uma coordenada absoluta.
        /// </summary>
        public void SendMove(Vector2 targetPos)
        {
            var msg = new MoveMessage
            {
                type = "move",
                x = targetPos.x,
                y = targetPos.y
            };
            Send(msg);
        }

        /// <summary>
        /// Envia movimento em uma direção (estilo Tibia).
        /// </summary>
        public void SendMoveDir(string direction)
        {
            var msg = new MoveDirMessage
            {
                type = "moveDir",
                dir = direction
            };
            Send(msg);
        }
    }
}