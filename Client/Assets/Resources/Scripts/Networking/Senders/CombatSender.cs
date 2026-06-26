using UnityEngine;
using NativeWebSocket;
using ZagoQuest.Networking.Messages;

namespace ZagoQuest.Networking.Senders
{
    /// <summary>
    /// Responsável por enviar comandos de combate.
    /// </summary>
    public class CombatSender : BaseSender
    {
        public CombatSender(WebSocket websocket) : base(websocket) { }

        public void SendAttack(string targetId)
        {
            var msg = new AttackMessage
            {
                type = "attack",
                targetId = targetId
            };
            Debug.Log($"[CombatSender] Atacando alvo: {targetId}");
            Send(msg);
        }

        public void SendStartAutoAttack(string targetId)
        {
            var msg = new StartAutoAttackMessage
            {
                type = "startAutoAttack",
                targetId = targetId
            };
            Debug.Log($"[CombatSender] Iniciando auto attack em: {targetId}");
            Send(msg);
        }

        public void SendStopAutoAttack()
        {
            var msg = new StopAutoAttackMessage
            {
                type = "stopAutoAttack"
            };
            Debug.Log("[CombatSender] Parando auto attack");
            Send(msg);
        }
    }
}