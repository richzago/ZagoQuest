using UnityEngine;
using NativeWebSocket;
using ZagoQuest.Networking.Messages;

namespace ZagoQuest.Networking.Senders
{
    /// <summary>
    /// Responsável por enviar comandos do banco.
    /// </summary>
    public class BankSender : BaseSender
    {
        public BankSender(WebSocket websocket) : base(websocket) { }

        public void SendOpenBank(string npcId)
        {
            var msg = new OpenBankMessage
            {
                type = "openBank",
                npcId = npcId
            };
            Debug.Log($"[BankSender] Abrindo banco de {npcId}");
            Send(msg);
        }

        public void SendDeposit(int amount)
        {
            var msg = new DepositMessage
            {
                type = "deposit",
                amount = amount
            };
            Debug.Log($"[BankSender] Depositando {amount} gold");
            Send(msg);
        }

        public void SendWithdraw(int amount)
        {
            var msg = new WithdrawMessage
            {
                type = "withdraw",
                amount = amount
            };
            Debug.Log($"[BankSender] Sacando {amount} gold");
            Send(msg);
        }
    }
}