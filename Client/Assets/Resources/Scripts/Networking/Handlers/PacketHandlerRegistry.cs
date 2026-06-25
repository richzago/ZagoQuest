using System.Collections.Generic;
using Newtonsoft.Json.Linq;

namespace ZagoQuest.Networking.Handlers
{
    public static class PacketHandlerRegistry
    {
        private static readonly Dictionary<string, IMessageHandler> _handlers = new();

        public static void Register(string type, IMessageHandler handler)
        {
            _handlers[type] = handler;
        }

        public static IMessageHandler GetHandler(string type)
        {
            _handlers.TryGetValue(type, out var handler);
            return handler;
        }
    }
}