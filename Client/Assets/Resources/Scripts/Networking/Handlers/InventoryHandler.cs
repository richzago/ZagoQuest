using System.Collections.Generic;
using Newtonsoft.Json.Linq;
using ZagoQuest.Networking.Messages;

namespace ZagoQuest.Networking.Handlers
{
    public class InventoryHandler : IMessageHandler
    {
        public void Handle(JObject json, NetworkContext context)
        {
            var invMsg = json.ToObject<InventoryMessage>();
            var itemsDict = new Dictionary<string, int>();
            if (invMsg.items != null)
            {
                foreach (var item in invMsg.items)
                    itemsDict[item.itemId] = item.amount;
            }
            context.InventoryUI?.HandleInventory(invMsg.gold, itemsDict);
        }
    }
}