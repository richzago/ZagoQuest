using Newtonsoft.Json.Linq;
using UnityEngine;
using ZagoQuest.Networking.Messages;

namespace ZagoQuest.Networking.Handlers
{
    public class SpawnHandler : IMessageHandler
    {
        public void Handle(JObject json, NetworkContext context)
        {
            var spawnMsg = json.ToObject<SpawnMessage>();
            if (spawnMsg == null)
            {
                Debug.LogError("[SpawnHandler] Pacote spawn não pôde ser lido.");
                return;
            }

            // A busca deve ocorrer no momento do pacote: a ordem do Awake
            // dos MonoBehaviours não pode causar perda silenciosa de entidades.
            var manager = context.EntityManager;
            if (manager == null)
            {
                Debug.LogError($"[SpawnHandler] EntityManager ausente para {spawnMsg.name} (id={spawnMsg.id}). Verifique a Hierarchy.");
                return;
            }

            Debug.Log($"[SpawnHandler] Recebido: {spawnMsg.name} (id={spawnMsg.id}) em ({spawnMsg.x},{spawnMsg.y})");
            if (spawnMsg.entityType == "player")
            {
                manager.SpawnRemotePlayer(spawnMsg.id, spawnMsg.name, spawnMsg.x, spawnMsg.y);
            }
            else if (spawnMsg.isItem)
            {
                manager.SpawnItemOnGround(
                    spawnMsg.id, spawnMsg.itemId, spawnMsg.name,
                    spawnMsg.x, spawnMsg.y, spawnMsg.amount
                );
            }
            else
            {
                manager.SpawnEntity(
                    spawnMsg.id, spawnMsg.name,
                    spawnMsg.x, spawnMsg.y,
                    spawnMsg.hp, spawnMsg.npcType
                );
            }

            if (manager.GetGameObject(spawnMsg.id) == null)
                Debug.LogError($"[SpawnHandler] Não foi possível criar {spawnMsg.name} (id={spawnMsg.id}). Confira prefab e Console.");
            else
                Debug.Log($"[SpawnHandler] Instanciado: {spawnMsg.name} (id={spawnMsg.id})");
        }
    }
}
