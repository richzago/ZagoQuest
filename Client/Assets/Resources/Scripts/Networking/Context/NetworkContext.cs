namespace ZagoQuest.Networking
{
    public class NetworkContext
    {
        public NetworkManager NetworkManager { get; }
        public GameManager GameManager { get; }
        public EntityManager EntityManager { get; }
        // Adicione outras dependências conforme necessário (ChatUI, InventoryUI, etc.)

        public NetworkContext(NetworkManager networkManager)
        {
            NetworkManager = networkManager;
            GameManager = GameManager.Instance;
            EntityManager = EntityManager.Instance;
        }
    }
}