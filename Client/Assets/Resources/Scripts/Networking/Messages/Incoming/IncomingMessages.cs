// Networking/Messages/IncomingMessages.cs
using System;

namespace ZagoQuest.Networking.Messages
{
    [Serializable] public class InitMessage { public string type; public string playerId; public float x; public float y; }
    [Serializable] public class PositionMessage { public string type; public float x; public float y; }
    [Serializable] public class MoveEntityMessage { public string type; public string id; public float x; public float y; }
    [Serializable]
    public class SpawnMessage
    {
        public string type;
        public string id;
        public string name;
        public float x;
        public float y;
        public int hp;
        public int maxHp;
        public string npcType;
        public bool isItem;
        public string itemId;
        public int amount;
    }
    [Serializable] public class DamageMessage { public string type; public string targetId; public int newHp; public int maxHp; public int damage; }
    [Serializable] public class ChatMessageReceived { public string type; public string message; }
    [Serializable] public class LootWindowMessage { public string type; public string corpseId; public LootItem[] items; }
    [Serializable] public class LootErrorMessage { public string type; public string message; }
    [Serializable] public class InventoryMessage { public string type; public int gold; public InventoryItem[] items; public InventoryEquipment[] equipment; }
    [Serializable] public class ItemUsedMessage { public string type; public string itemId; public bool success; public string message; }
    [Serializable] public class ShopWindowMessage { public string type; public string npcId; public ShopItem[] items; }
    [Serializable] public class BuyResultMessage { public string type; public bool success; public string message; }
    [Serializable] public class BankWindowMessage { public string type; public string npcId; public int bankGold; public int gold; }
    [Serializable] public class BankResultMessage { public string type; public bool success; public string message; public int bankGold; public int gold; }
    [Serializable] public class ShopErrorMessage { public string type; public string message; }
    [Serializable] public class BankErrorMessage { public string type; public string message; }
    [Serializable] public class AutoAttackStoppedMessage { public string type; public string reason; }
    [Serializable] public class EquipmentMessage { public string type; public EquipmentItem[] items; }
    [Serializable] public class UnequipResultMessage { public string type; public bool success; public string message; }
    [Serializable] public class DropErrorMessage { public string type; public string message; }
    [Serializable] public class DespawnMessage { public string type; public string id; }
    // Contratos já emitidos pelo servidor, mas sem DTO explícito no Unity.
    [Serializable] public class GoldMessage { public string type; public int gold; }
    [Serializable] public class AttackFailedMessage { public string type; public string reason; }
    [Serializable] public class AutoAttackStartedMessage { public string type; public string targetId; }
    [Serializable] public class MonsterDiedMessage { public string type; public string monsterId; }
    [Serializable] public class PickupErrorMessage { public string type; public string message; }
    [Serializable] public class ErrorMessage { public string type; public string message; }
    [Serializable] public class NetworkErrorMessage { public string type; public string message; }
    [Serializable] public class LootTakenMessage { public string type; public string corpseId; public int? itemIndex; }

    // Subclasses
    [Serializable] public class LootItem { public string itemId; public int amount; public string itemName; }
    [Serializable] public class InventoryItem { public string itemId; public int amount; }
    [Serializable] public class InventoryEquipment { public string slot; public string itemId; }
    [Serializable] public class ShopItem { public string itemId; public string name; public int price; public int stock; }
    [Serializable] public class EquipmentItem { public string slot; public string itemId; }
}