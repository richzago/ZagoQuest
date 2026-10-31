using NativeWebSocket;
using ZagoQuest.Networking.Messages;

namespace ZagoQuest.Networking.Senders
{
    /// <summary>C7: envia somente intenção; Node determina sucesso e duração.</summary>
    public class FishingSender : BaseSender
    {
        public FishingSender(WebSocket socket) : base(socket) { }
        public void StartFishing() => Send(new StartFishingMessage { type = "startFishing" });
        public void CancelFishing() => Send(new CancelFishingMessage { type = "cancelFishing" });
    }
}
