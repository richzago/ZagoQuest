using Newtonsoft.Json.Linq;
using UnityEngine;
using ZagoQuest.Networking.Messages;

namespace ZagoQuest.Networking.Handlers
{
    public class PlayerStatsHandler : IMessageHandler
    {
        // Diagnóstico pontual: a HUD não inventa mana inicial; mostra o snapshot.
        // Não gerar um warning a cada tick de food quando a mana ainda é 0.
        private bool reportedZeroMana;
        public void Handle(JObject json, NetworkContext context)
        {
            var stats = json.ToObject<PlayerStatsData>();
            if (stats == null) return;
            if (stats.mana == 0 && !reportedZeroMana)
            {
                Debug.LogWarning($"[PlayerStats] Node enviou mana 0/{stats.maxMana}. " +
                    "Verifique o save do personagem; a HUD não altera esse valor.");
                reportedZeroMana = true;
            }
            if (stats.mana > 0) reportedZeroMana = false;
            if (context.GameManager != null)
                context.GameManager.PlayerStats = stats;

            // Atualiza HUD e Status diretamente
            context.PlayerHUD?.UpdateStats(stats);
            context.StatusManager?.OnPlayerStatsReceived(stats);
            PlayerController.Instance?.SetMoveIntervalMs(stats.moveIntervalMs);
        }
    }
}