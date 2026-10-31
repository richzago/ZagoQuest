using Newtonsoft.Json.Linq;

namespace ZagoQuest.Networking.Handlers
{
    /// <summary>Estado de pesca vem exclusivamente do WebSocket.</summary>
    public sealed class FishingStatusHandler : IMessageHandler
    {
        public void Handle(JObject json, NetworkContext context)
        {
            string state = json["state"]?.ToString();
            string message = json["message"]?.ToString() ?? "";
            int durationMs = json["durationMs"]?.Value<int>() ?? 0;
            C7FishingUI.Instance?.HandleFishingStatus(state, message, durationMs);
        }
    }
}
