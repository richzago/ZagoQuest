using UnityEngine;

namespace ZagoQuest.Networking
{
    /// <summary>
    /// Contexto da conexão. Managers de cena são resolvidos no momento do
    /// pacote: uma UI criada após Awake ou recriada no reconnect não pode
    /// deixar o handler preso a uma instância null/destruída.
    /// </summary>
    public class NetworkContext
    {
        public NetworkManager NetworkManager { get; }
        public GameManager GameManager => global::GameManager.Instance;
        public EntityManager EntityManager => global::EntityManager.Instance;
        public ChatUI ChatUI => global::ChatUI.Instance;
        public LootUI LootUI => global::LootUI.Instance;
        public TargetSelector TargetSelector => global::TargetSelector.Instance;
        public NameplateManager NameplateManager => global::NameplateManager.Instance;
        public InventoryUI InventoryUI => global::InventoryUI.Instance;
        public EquipmentUI EquipmentUI => global::EquipmentUI.Instance;
        public ShopUI ShopUI => global::ShopUI.Instance;
        public BankUI BankUI => global::BankUI.Instance;
        public PlayerHUD PlayerHUD => global::PlayerHUD.Instance;
        public StatusManager StatusManager => global::StatusManager.Instance;

        public NetworkContext(NetworkManager networkManager)
        {
            NetworkManager = networkManager;
        }
    }
}
