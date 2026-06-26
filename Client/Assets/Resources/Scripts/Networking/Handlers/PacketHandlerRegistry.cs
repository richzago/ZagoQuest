using System.Collections.Generic;

namespace ZagoQuest.Networking.Handlers
{
    public static class PacketHandlerRegistry
    {
        private static readonly Dictionary<string, IMessageHandler> _handlers = new();
        private static bool _registered = false;

        public static void Register(string type, IMessageHandler handler)
        {
            _handlers[type] = handler;
        }

        public static IMessageHandler GetHandler(string type)
        {
            _handlers.TryGetValue(type, out var handler);
            return handler;
        }

        public static void RegisterAll()
        {
            if (_registered) return;

            Register("init", new InitHandler());
            Register("position", new PositionHandler());
            Register("spawn", new SpawnHandler());
            Register("move", new MoveHandler());
            Register("despawn", new DespawnHandler());
            Register("damage", new DamageHandler());
            Register("chat", new ChatHandler());
            Register("lootWindow", new LootWindowHandler());
            Register("lootTaken", new LootTakenHandler());
            Register("lootError", new LootErrorHandler());
            Register("inventory", new InventoryHandler());
            Register("itemUsed", new ItemUsedHandler());
            Register("playerStats", new PlayerStatsHandler());
            Register("shopWindow", new ShopWindowHandler());
            Register("buyResult", new BuyResultHandler());
            Register("shopError", new ShopErrorHandler());
            Register("bankWindow", new BankWindowHandler());
            Register("bankResult", new BankResultHandler());
            Register("bankError", new BankErrorHandler());
            Register("autoAttackStopped", new AutoAttackStoppedHandler());
            Register("equipment", new EquipmentHandler());
            Register("unequipResult", new UnequipResultHandler());
            Register("dropError", new DropErrorHandler());

            _registered = true;
        }
    }
}