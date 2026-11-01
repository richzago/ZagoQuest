// Networking/Messages/OutgoingMessages.cs
using System;

namespace ZagoQuest.Networking.Messages
{
    [Serializable] public class MoveMessage { public string type; public float x, y; }
    [Serializable] public class StartFishingMessage { public string type; }
    [Serializable] public class CancelFishingMessage { public string type; }
    [Serializable] public class ChatMessage { public string type; public string message; }
    [Serializable] public class AttackMessage { public string type; public string targetId; }
    [Serializable] public class LootMessage { public string type; public string corpseId; }
    [Serializable] public class DropCorpseLootMessage {
        public string type; public string corpseId; public int itemIndex;
        public int x; public int y;
    }
    [Serializable] public class TakeLootMessage { public string type; public string corpseId; public bool takeAll; public int itemIndex; }
    // Take-all does not send itemIndex: the server requires non-negative indices when supplied.
    [Serializable] public class TakeAllLootMessage { public string type; public string corpseId; public bool takeAll; }
    [Serializable] public class UseItemMessage { public string type; public string itemId; }
    // JsonUtility serializa campos públicos, mesmo que sejam opcionais no contrato.
    // Não incluir instanceId se o objeto não representa uma instância específica.
    [Serializable] public class OpenBagWithoutInstanceMessage { public string type; public string itemId; }
    [Serializable] public class OpenBagMessage { public string type; public string itemId; public string instanceId; }
    [Serializable] public class CloseBagMessage { public string type; }
    [Serializable] public class StartAutoAttackMessage { public string type; public string targetId; }
    [Serializable] public class StopAutoAttackMessage { public string type; }
    [Serializable] public class OpenShopMessage { public string type; public string npcId; }
    [Serializable] public class OpenBankMessage { public string type; public string npcId; }
    // O ID vincula o fechamento à janela aberta; impede cancelar outra sessão.
    [Serializable] public class CloseBankMessage { public string type; public string npcId; }
    [Serializable] public class CloseShopMessage { public string type; public string npcId; }
    [Serializable] public class BuyItemMessage { public string type; public string npcId; public string itemId; public int amount; }
    [Serializable] public class SellItemMessage { public string type; public string npcId; public string itemId; public int amount; }
    [Serializable] public class DepositMessage { public string type; public int amount; }
    [Serializable] public class WithdrawMessage { public string type; public int amount; }
    [Serializable] public class EquipItemWithoutInstanceMessage { public string type; public string itemId; }
    [Serializable] public class EquipItemMessage { public string type; public string itemId; public string instanceId; }
    [Serializable] public class UnequipItemMessage { public string type; public string slot; }
    [Serializable] public class DropItemWithoutInstanceMessage {
        public string type; public string itemId; public int amount; public int x; public int y; public bool fromEquipment;
    }
    [Serializable] public class DropItemMessage { public string type; public string itemId; public int amount; public int x; public int y; public bool fromEquipment; public string instanceId; }
    [Serializable] public class PickupItemMessage { public string type; public string itemId; }
    [Serializable] public class MoveDirMessage { public string type; public string dir; }
}