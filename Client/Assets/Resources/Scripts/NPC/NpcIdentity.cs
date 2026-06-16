using UnityEngine;

public class NpcIdentity : MonoBehaviour
{
    public string npcId;      // identificador lógico (ex: "merchant", "banker")
    public string id;         // UUID único enviado pelo servidor (será preenchido pelo EntityManager)
}