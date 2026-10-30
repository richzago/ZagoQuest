using Newtonsoft.Json.Linq;
using UnityEngine;

namespace ZagoQuest.Networking.Handlers
{
    /// <summary>
    /// Respostas do servidor que antes caíam como "tipo desconhecido".
    /// Mantém um único ponto de entrada para avisos e eventos informativos.
    /// </summary>
    public class ServerFeedbackHandler : IMessageHandler
    {
        public void Handle(JObject json, NetworkContext context)
        {
            if (json == null) return;
            string type = json.Value<string>("type");

            switch (type)
            {
                case "gold":
                    // O servidor envia gold separado após depósitos, saques e compras.
                    // Atualiza somente o saldo, SEM limpar a lista de itens na UI.
                    int? gold = json.Value<int?>("gold");
                    if (gold.HasValue)
                        context.InventoryUI?.UpdateGold(gold.Value);
                    break;

                case "attackFailed":
                    ShowFeedback(context, "Combate", json.Value<string>("reason"));
                    break;

                case "pickupError":
                    ShowFeedback(context, "Coleta", json.Value<string>("message"));
                    break;

                case "error":
                    ShowFeedback(context, "Inventário", json.Value<string>("message"));
                    break;

                case "autoAttackStarted":
                    // A seleção já acontece no cliente; apenas confirmamos o estado.
                    Debug.Log($"[COMBAT] Auto attack confirmado: {json.Value<string>("targetId")}");
                    break;

                case "monsterDied":
                    // O broadcast "despawn" já cuida da remoção da entidade.
                    // Evita fazer o mesmo despawn duas vezes em handlers distintos.
                    Debug.Log($"[COMBAT] Monstro derrotado: {json.Value<string>("monsterId")}");
                    break;
            }
        }

        private static void ShowFeedback(NetworkContext context, string category, string message)
        {
            if (string.IsNullOrWhiteSpace(message)) return;
            Debug.LogWarning($"[{category}] {message}");
            context.ChatUI?.AddMessage($"{category}: {message}");
        }
    }
}
