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
            var itemTypes = new Dictionary<string, string>();
            var rows = new List<InventoryUI.InventoryEntry>();
            if (invMsg.items != null)
            {
                foreach (var item in invMsg.items)
                {
                    itemsDict[item.itemId] = itemsDict.TryGetValue(item.itemId, out int old)
                        ? old + item.amount : item.amount;
                    rows.Add(new InventoryUI.InventoryEntry {
                        itemId=item.itemId, amount=item.amount,
                        itemType=item.itemType, instanceId=item.instanceId,
                        slotId=item.slotId
                    });
                    if (!string.IsNullOrWhiteSpace(item.itemType))
                        itemTypes[item.itemId] = item.itemType;
                }
            }
            context.InventoryUI?.HandleInventory(invMsg.gold, itemsDict, itemTypes,
                invMsg.bagItemId, invMsg.bagSlots, invMsg.slotsUsed, rows);
            context.InventoryUI?.SetCurrentBagInstance(invMsg.viewedBagInstanceId);
            // CAP calculado no Node inclui Bags aninhadas não visíveis.
            C8SidebarShell.SetCapacity(invMsg.capRemaining, invMsg.capMax);
        }
    }
}