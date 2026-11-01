using UnityEngine;
using UnityEngine.EventSystems;

/// <summary>Arrastar linha do loot para o viewport da Bag é o MESMO takeLoot.</summary>
public sealed class C9LootBagDropTarget : MonoBehaviour, IDropHandler
{
    public void OnDrop(PointerEventData eventData)
    {
        var row = eventData.pointerDrag != null
            ? eventData.pointerDrag.GetComponentInParent<LootItemSlot>()
            : null;
        if (row == null) return;
        LootUI.Instance?.TakeByDrop(row.ItemIndex);
    }
}
