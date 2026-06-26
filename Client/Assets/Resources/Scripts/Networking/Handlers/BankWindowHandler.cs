using Newtonsoft.Json.Linq;
using ZagoQuest.Networking.Messages;

namespace ZagoQuest.Networking.Handlers
{
    public class BankWindowHandler : IMessageHandler
    {
        public void Handle(JObject json, NetworkContext context)
        {
            var bankWinMsg = json.ToObject<BankWindowMessage>();
            context.BankUI?.ShowBankWindow(bankWinMsg.npcId, bankWinMsg.bankGold, bankWinMsg.gold);
        }
    }
}