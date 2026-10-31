using UnityEngine;
using UnityEngine.EventSystems;

/// <summary>
/// Equipamento pode ser solto no espaço vazio do inventário, mesmo sem
/// InventorySlot. A solicitação segue para o servidor via DragDropManager.
/// </summary>
public sealed class C6InventoryDropTarget : MonoBehaviour, IDropHandler
{
    public void OnDrop(PointerEventData eventData)
    {
        var drag = DragDropManager.Instance;
        if (drag != null && drag.IsDragging() && drag.IsFromEquipment())
            drag.DropOnInventorySlot();
    }
}
