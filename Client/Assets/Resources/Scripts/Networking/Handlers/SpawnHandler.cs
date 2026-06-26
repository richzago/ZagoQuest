using Newtonsoft.Json.Linq;
using ZagoQuest.Networking.Messages;

namespace ZagoQuest.Networking.Handlers
{
    public class SpawnHandler : IMessageHandler
    {
        public void Handle(JObject json, NetworkContext context)
        {
            var spawnMsg = json.ToObject<SpawnMessage>();
            if (spawnMsg.isItem)
            {
                context.EntityManager?.SpawnItemOnGround(
                    spawnMsg.id,
                    spawnMsg.itemId,
                    spawnMsg.name,
                    spawnMsg.x,
                    spawnMsg.y,
                    spawnMsg.amount
                );
            }
            else
            {
                context.EntityManager?.SpawnEntity(
                    spawnMsg.id,
                    spawnMsg.name,
                    spawnMsg.x,
                    spawnMsg.y,
                    spawnMsg.hp,
                    spawnMsg.npcType
                );
            }
        }
    }
}