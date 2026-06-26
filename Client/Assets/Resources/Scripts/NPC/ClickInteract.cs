using UnityEngine;

/// <summary>
/// Gerencia a interação por clique com NPCs.
/// Para merchant e banker, envia comandos específicos (abrir loja/banco).
/// Para outros NPCs, envia /hi via chat.
/// </summary>
public class ClickInteract : MonoBehaviour
{
    private NpcIdentity npcIdentity;

    void Awake()
    {
        npcIdentity = GetComponent<NpcIdentity>();
        // if (npcIdentity == null)
        //     Debug.LogError($"ClickInteract: NpcIdentity não encontrado em {gameObject.name}");
    }

    void OnMouseDown()
    {
        if (NetworkManager.Instance == null) return;
        NpcIdentity npc = GetComponent<NpcIdentity>();
        if (npc == null) return;

        string npcId = npc.id;   //
        // Debug.Log($"🖱️ Clique no NPC: {npcId}");

        if (npc.npcId == "merchant")
            NetworkManager.Instance.Shop.SendOpenShop(npcId);
        else if (npc.npcId == "banker")
            NetworkManager.Instance.Bank.SendOpenBank(npcId);
        else
            NetworkManager.Instance.Chat.SendChat("/hi");
    }
}