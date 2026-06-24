using UnityEngine;

/// <summary>
/// Identidade de um item no chão.
/// Contém dados do item e o UUID para pickup.
/// </summary>
public class ItemOnGroundIdentity : MonoBehaviour
{
    [Header("Dados do item")]
    [Tooltip("UUID único do item no chão (usado para pickup).")]
    public string groundItemId;   // ← ESSENCIAL: UUID enviado pelo servidor

    [Tooltip("ID lógico do item (ex: 'equipment/armor/boneArmor').")]
    public string itemId;

    [Tooltip("Quantidade de itens empilhados.")]
    public int amount;

    [Tooltip("Nome legível do item.")]
    public string itemName;
}