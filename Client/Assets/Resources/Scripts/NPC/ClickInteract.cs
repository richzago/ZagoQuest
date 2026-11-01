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

        // O clique atravessa um item no chão até alcançar o NPC.
        // Mas selecionar um NPC visível, porém distante, não deve abrir
        // a loja e produzir um erro como se o cliente tivesse travado.
        var controller = PlayerController.Instance;
        if (controller != null &&
            controller.TryGetConfirmedGridPosition(out Vector2Int position))
        {
            int nx = Mathf.FloorToInt(npc.transform.position.x);
            int ny = Mathf.FloorToInt(npc.transform.position.y);
            int distance = Mathf.Abs(position.x - nx) + Mathf.Abs(position.y - ny);
            if (distance > 2)
            {
                Debug.LogWarning($"[ClickInteract] NPC fora do alcance: {distance} tiles (máx. 2)");
                ChatUI.Instance?.AddMessage("Aproxime-se do NPC para conversar.");
                return;
            }
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
