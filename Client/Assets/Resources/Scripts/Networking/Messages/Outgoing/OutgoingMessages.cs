// Networking/Messages/OutgoingMessages.cs
using System;

namespace ZagoQuest.Networking.Messages
{
    [Serializable] public class MoveMessage { public string type; public float x, y; }
    [Serializable] public class ChatMessage { public string type; public string message; }
    [Serializable] public class AttackMessage { public string type; public string targetId; }
    [Serializable] public class LootMessage { public string type; public string corpseId; }
    [Serializable] public class TakeLootMessage { public string type; public string corpseId; public bool takeAll; public int itemIndex; }
    [Serializable] public class UseItemMessage { public string type; public string itemId; }
    [Serializable] public class StartAutoAttackMessage { public string type; public string targetId; }
    [Serializable] public class StopAutoAttackMessage { public string type; }
    [Serializable] public class OpenShopMessage { public string type; public string npcId; }
    [Serializable] public class OpenBankMessage { public string type; public string npcId; }
    [Serializable] public class BuyItemMessage { public string type; public string npcId; public string itemId; public int amount; }
    [Serializable] public class DepositMessage { public string type; public int amount; }
    [Serializable] public class WithdrawMessage { public string type; public int amount; }
    [Serializable] public class EquipItemMessage { public string type; public string itemId; }
    [Serializable] public class UnequipItemMessage { public string type; public string slot; }
    [Serializable] public class DropItemMessage { public string type; public string itemId; public int amount; public int x; public int y; }
    [Serializable] public class PickupItemMessage { public string type; public string itemId; }
    [Serializable] public class MoveDirMessage { public string type; public string dir; }
}