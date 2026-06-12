using UnityEngine;

/// <summary>
/// Identidade de um corpo (corpse) no mundo.
/// Armazena o ID único do corpo (UUID) vindo do servidor.
/// </summary>
public class CorpseIdentity : MonoBehaviour
{
    /// <summary>ID único do corpo (UUID enviado pelo servidor)</summary>
    public string corpseId;
}