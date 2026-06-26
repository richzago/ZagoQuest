using Newtonsoft.Json.Linq;
using ZagoQuest.Networking.Messages;

namespace ZagoQuest.Networking.Handlers
{
    public class BankResultHandler : IMessageHandler
    {
        public void Handle(JObject json, NetworkContext context)
        {
            var bankResMsg = json.ToObject<BankResultMessage>();
            context.BankUI?.UpdateBankResult(bankResMsg.success, bankResMsg.message, bankResMsg.bankGold, bankResMsg.gold);
        }
    }
}