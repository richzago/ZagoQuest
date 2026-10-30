using Newtonsoft.Json.Linq;
using ZagoQuest.Networking.Messages;

namespace ZagoQuest.Networking.Handlers
{
    public class BankWindowHandler : IMessageHandler
    {
        public void Handle(JObject json, NetworkContext context)
        {
            var bankWinMsg = json.ToObject<BankWindowMessage>();
            UnityEngine.Debug.Log($"[BankWindowHandler] bankWindow recebido: npcId={bankWinMsg.npcId}");
            if (context.BankUI == null)
                UnityEngine.Debug.LogError("[BankWindowHandler] BankUI.Instance ausente. Verifique BankManager ativo na Hierarchy.");
            else
                context.BankUI.ShowBankWindow(bankWinMsg.npcId, bankWinMsg.bankGold, bankWinMsg.gold);
        }
    }
}