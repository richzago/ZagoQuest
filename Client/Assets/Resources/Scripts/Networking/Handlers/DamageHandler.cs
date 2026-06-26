using Newtonsoft.Json.Linq;
using UnityEngine;
using ZagoQuest.Networking.Messages;

namespace ZagoQuest.Networking.Handlers
{
    public class DamageHandler : IMessageHandler
    {
        public void Handle(JObject json, NetworkContext context)
        {
            var damageMsg = json.ToObject<DamageMessage>();
            if (damageMsg == null) return;

            context.EntityManager?.UpdateMonsterHp(damageMsg.targetId, damageMsg.newHp, damageMsg.maxHp);

            GameObject targetGo = context.EntityManager?.GetGameObject(damageMsg.targetId);
            if (targetGo == null) return;

            if (damageMsg.damage > 0 && context.NameplateManager != null)
            {
                context.NameplateManager.ShowFloatingText(
                    targetGo.transform.position,
                    damageMsg.damage.ToString(),
                    Color.red
                );
            }
        }
    }
}