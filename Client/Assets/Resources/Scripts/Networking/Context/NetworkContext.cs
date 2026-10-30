using UnityEngine;

namespace ZagoQuest.Networking
{
    public class NetworkContext
    {
        public NetworkManager NetworkManager { get; }
        public GameManager GameManager { get; }
        // Resolve at packet arrival: Awake ordering must not drop world entities.
        public EntityManager EntityManager => global::EntityManager.Instance;
        public ChatUI ChatUI { get; }
        public LootUI LootUI { get; }
        public TargetSelector TargetSelector { get; }
        public NameplateManager NameplateManager { get; }
        public InventoryUI InventoryUI { get; }
        public EquipmentUI EquipmentUI { get; }
        // Resolver ao receber o pacote: Awake do NetworkManager pode anteceder Awake da UI.
        public ShopUI ShopUI => global::ShopUI.Instance;
        // Resolver ao receber o pacote: Awake do NetworkManager pode anteceder Awake da UI.
        public BankUI BankUI => global::BankUI.Instance;
        public PlayerHUD PlayerHUD { get; }
        public StatusManager StatusManager { get; }

        public NetworkContext(NetworkManager networkManager)
        {
            NetworkManager = networkManager;

            // Todos os singletons
            GameManager = GameManager.Instance;
            ChatUI = ChatUI.Instance;
            LootUI = LootUI.Instance;
            TargetSelector = TargetSelector.Instance;
            NameplateManager = NameplateManager.Instance;
            InventoryUI = InventoryUI.Instance;
            EquipmentUI = EquipmentUI.Instance;
            PlayerHUD = PlayerHUD.Instance;
            StatusManager = StatusManager.Instance;
        }

    }
}
