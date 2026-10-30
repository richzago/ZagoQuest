using UnityEngine;

/// <summary>
/// Interação com NPC chamada pelo TargetSelector (novo Input System).
/// Não usar OnMouseDown: dois mecanismos de clique poderiam enviar dois pedidos.
/// </summary>
public class ClickInteract : MonoBehaviour
{
    public void Interact()
    {
        var npc = GetComponent<NpcIdentity>();
        if (npc == null || string.IsNullOrEmpty(npc.id))
        {
            Debug.LogWarning("[ClickInteract] NPC sem identidade de instância.");
            return;
        }

        var network = NetworkManager.Instance;
        if (network == null || !network.isConnected)
        {
            Debug.LogWarning("[ClickInteract] Não conectado ao servidor.");
            return;
        }

        Debug.Log($"[ClickInteract] Interação com {npc.npcId} (ID: {npc.id})");
        switch (npc.npcId)
        {
            case "merchant":
                if (network.Shop != null) network.Shop.SendOpenShop(npc.id);
                else Debug.LogWarning("[ClickInteract] ShopSender ainda não está disponível.");
                break;
            case "banker":
                if (network.Bank != null) network.Bank.SendOpenBank(npc.id);
                else Debug.LogWarning("[ClickInteract] BankSender ainda não está disponível.");
                break;
            default:
                network.Chat?.SendChat("/hi");
                break;
        }
    }
}
