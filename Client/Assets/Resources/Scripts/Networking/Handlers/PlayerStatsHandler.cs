using Newtonsoft.Json.Linq;
using ZagoQuest.Networking.Messages;

namespace ZagoQuest.Networking.Handlers
{
    public class PlayerStatsHandler : IMessageHandler
    {
        public void Handle(JObject json, NetworkContext context)
        {
            var stats = json.ToObject<PlayerStatsData>();
            if (context.GameManager != null)
                context.GameManager.PlayerStats = stats;

            // Atualiza HUD e Status diretamente
            context.PlayerHUD?.UpdateStats(stats);
            context.StatusManager?.OnPlayerStatsReceived(stats);
            PlayerController.Instance?.SetMoveIntervalMs(stats.moveIntervalMs);
        }
    }
}