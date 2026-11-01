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

        public void OpenBag(string itemId, string instanceId = null)
        {
            if (string.IsNullOrWhiteSpace(itemId)) return;
            if (string.IsNullOrWhiteSpace(instanceId))
                Send(new OpenBagWithoutInstanceMessage { type = "openBag", itemId = itemId });
            else
                Send(new OpenBagMessage { type = "openBag", itemId = itemId, instanceId = instanceId });
        }

        public void CloseBag()
        {
            Send(new CloseBagMessage { type = "closeBag" });
        }

        public void TransferBagItem(string sourceBagId, string destinationBagId,
                                    string itemId, int amount, string instanceId = null)
        {
            if (string.IsNullOrWhiteSpace(sourceBagId) ||
                string.IsNullOrWhiteSpace(destinationBagId) ||
                string.IsNullOrWhiteSpace(itemId) || amount <= 0) return;
            if (string.IsNullOrWhiteSpace(instanceId))
                Send(new TransferBagItemWithoutInstanceMessage {
                    type="transferBagItem", sourceBagId=sourceBagId,
                    destinationBagId=destinationBagId, itemId=itemId, amount=amount
                });
            else
                Send(new TransferBagItemMessage {
                    type="transferBagItem", sourceBagId=sourceBagId,
                    destinationBagId=destinationBagId, itemId=itemId,
                    amount=amount, instanceId=instanceId
                });
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

        public void SendEquipItem(string itemId, string instanceId = null)
        {
            if (string.IsNullOrWhiteSpace(itemId)) return;
            // Sem UUID o campo não pode existir no JSON; Zod usa identifier.optional(),
            // que não aceita null nem string vazia quando a propriedade está presente.
            if (string.IsNullOrWhiteSpace(instanceId))
            {
                Send(new EquipItemWithoutInstanceMessage { type = "equipItem", itemId = itemId });
            }
            else
            {
                var msg = new EquipItemMessage { type = "equipItem", itemId = itemId,
                    instanceId = instanceId };
                Send(msg);
            }
            Debug.Log($"[InventorySender] Equipando item: {itemId} (UUID específico={ !string.IsNullOrWhiteSpace(instanceId) })");
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

        public void SendDropItem(string itemId, int amount, int x, int y, bool fromEquipment = false, string instanceId = null)
        {
            if (string.IsNullOrWhiteSpace(itemId) || amount <= 0) return;
            // O equipamento não precisa inventar um instanceId. Enviar
            // null/"" para identifier.optional() causava "Mensagem inválida".
            // Manter fromEquipment explícito para não dropar uma cópia errada.
            if (string.IsNullOrWhiteSpace(instanceId))
            {
                var basic = new DropItemWithoutInstanceMessage {
                    type = "dropItem", itemId = itemId, amount = amount,
                    fromEquipment = fromEquipment, x = x, y = y
                };
                Send(basic);
            }
            else
            {
                var specific = new DropItemMessage {
                    type = "dropItem", itemId = itemId, amount = amount,
                    fromEquipment = fromEquipment, instanceId = instanceId, x = x, y = y
                };
                Send(specific);
            }
            Debug.Log($"[InventorySender] dropItem {amount}x {itemId} destino=({x},{y}) origemEquip={fromEquipment} UUID={(!string.IsNullOrWhiteSpace(instanceId) ? "específico" : "omitido")}");
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

        public void SendAutoLootNearby()
        {
            Send(new AutoLootNearbyMessage { type = "autoLootNearby" });
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