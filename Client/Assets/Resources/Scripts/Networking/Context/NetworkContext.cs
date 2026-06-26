using UnityEngine;

namespace ZagoQuest.Networking
{
    public class NetworkContext
    {
        public NetworkManager NetworkManager { get; }
        public GameManager GameManager { get; }
        public EntityManager EntityManager { get; }
        public ChatUI ChatUI { get; }
        public LootUI LootUI { get; }
        public TargetSelector TargetSelector { get; }
        public NameplateManager NameplateManager { get; }
        public InventoryUI InventoryUI { get; }
        public EquipmentUI EquipmentUI { get; }
        public ShopUI ShopUI { get; }
        public BankUI BankUI { get; }
        public PlayerHUD PlayerHUD { get; }
        public StatusManager StatusManager { get; }
        public PlayerController PlayerController { get; }

        public NetworkContext(NetworkManager networkManager)
        {
            NetworkManager = networkManager;

            // Todos os singletons
            GameManager = GameManager.Instance;
            EntityManager = EntityManager.Instance;
            ChatUI = ChatUI.Instance;
            LootUI = LootUI.Instance;
            TargetSelector = TargetSelector.Instance;
            NameplateManager = NameplateManager.Instance;
            InventoryUI = InventoryUI.Instance;
            EquipmentUI = EquipmentUI.Instance;
            ShopUI = ShopUI.Instance;
            BankUI = BankUI.Instance;
            PlayerHUD = PlayerHUD.Instance;
            StatusManager = StatusManager.Instance;
            PlayerController = PlayerController.Instance;
        }

    }
}
