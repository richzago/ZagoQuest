using UnityEngine;
using NativeWebSocket;
using ZagoQuest.Networking.Messages;

namespace ZagoQuest.Networking.Senders
{
    /// <summary>
    /// Responsável por enviar comandos relacionados ao inventário, equipamento, loot e drops.
    /// </summary>
    public class InventorySender : BaseSender
    {
        public InventorySender(WebSocket websocket) : base(websocket) { }

        public void OpenBag(string itemId)
        {
            if (string.IsNullOrWhiteSpace(itemId)) return;
            Send(new OpenBagMessage { type = "openBag", itemId = itemId });
        }

        public void CloseBag()
        {
            Send(new CloseBagMessage { type = "closeBag" });
        }

        public void UseItem(string itemId)
        {
            var msg = new UseItemMessage
            {
                type = "useItem",
                itemId = itemId
            };
            Debug.Log($"[InventorySender] Usando item: {itemId}");
            Send(msg);
        }

        public void SendEquipItem(string itemId)
        {
            var msg = new EquipItemMessage
            {
                type = "equipItem",
                itemId = itemId
            };
            Debug.Log($"[InventorySender] Equipando item: {itemId}");
            Send(msg);
        }

        public void SendUnequipItem(EquipmentSlot slot)
        {
            var msg = new UnequipItemMessage
            {
                type = "unequipItem",
                slot = slot.ToString()
            };
            Debug.Log($"[InventorySender] Desequipando slot: {slot}");
            Send(msg);
        }

        public void SendDropItem(string itemId, int amount, int x, int y, bool fromEquipment = false)
        {
            var msg = new DropItemMessage
            {
                type = "dropItem",
                itemId = itemId,
                amount = amount,
                fromEquipment = fromEquipment,
                x = x,
                y = y
            };
            Debug.Log($"[InventorySender] Dropando {amount}x {itemId} em ({x}, {y})");
            Send(msg);
        }

        public void SendPickupItem(string itemOnGroundId)
        {
            var msg = new PickupItemMessage
            {
                type = "pickupItem",
                itemId = itemOnGroundId
            };
            Debug.Log($"[InventorySender] Pegando item do chão: {itemOnGroundId}");
            Send(msg);
        }

        public void SendDropCorpseLoot(string corpseId, int itemIndex, int x, int y)
        {
            if (string.IsNullOrEmpty(corpseId) || itemIndex < 0) return;
            Send(new DropCorpseLootMessage
            {
                type = "dropCorpseLoot", corpseId = corpseId,
                itemIndex = itemIndex, x = x, y = y
            });
        }

        public void SendLoot(string corpseId)
        {
            var msg = new LootMessage
            {
                type = "loot",
                corpseId = corpseId
            };
            Debug.Log($"[InventorySender] Abrindo loot do corpse: {corpseId}");
            Send(msg);
        }

        public void SendTakeLoot(string corpseId, bool takeAll = true, int itemIndex = -1)
        {
            if (takeAll)
            {
                // JsonUtility serializa todos os campos públicos. Não enviar index=-1
                // num pacote takeAll, pois o schema do servidor rejeita índices negativos.
                var msg = new TakeAllLootMessage
                {
                    type = "takeLoot",
                    corpseId = corpseId,
                    takeAll = true
                };
                Debug.Log($"[InventorySender] Pegando todo o loot de {corpseId}");
                Send(msg);
                return;
            }

            if (itemIndex < 0)
            {
                Debug.LogWarning($"[InventorySender] Índice inválido ao pegar loot individual: {itemIndex}");
                return;
            }

            var singleItem = new TakeLootMessage
            {
                type = "takeLoot",
                corpseId = corpseId,
                takeAll = false,
                itemIndex = itemIndex
            };
            Debug.Log($"[InventorySender] Pegando loot de {corpseId} (index={itemIndex})");
            Send(singleItem);
        }
    }
}