using UnityEngine;
using UnityEngine.EventSystems;

/// <summary>
/// C16: borda inferior arrastável para expandir/recolher Backpack e Loot.
/// Coordenadas convertidas no host para respeitar F10/CanvasScaler; não mexe
/// em transforms do mundo, só na altura visual da janela no docking.
/// </summary>
[DisallowMultipleComponent]
public sealed class C16PanelResizeHandle : MonoBehaviour,
    IBeginDragHandler, IDragHandler, IEndDragHandler
{
    private C8SidebarDynamicDock dock;
    private bool isBag, dragging;
    private RectTransform host;
    private float startY, startHeight;

    public void Bind(C8SidebarDynamicDock owner, bool bag)
    {
        dock = owner;
        isBag = bag;
    }

    public void OnBeginDrag(PointerEventData eventData)
    {
        dragging = dock != null &&
            dock.TryBeginResize(isBag, out host, out startHeight) &&
            RectTransformUtility.ScreenPointToLocalPointInRectangle(
                host, eventData.position, eventData.pressEventCamera,
                out var local);
        if (dragging)
        {
            RectTransformUtility.ScreenPointToLocalPointInRectangle(
                host, eventData.position, eventData.pressEventCamera, out var first);
            startY = first.y;
            eventData.Use();
        }
    }

    public void OnDrag(PointerEventData eventData)
    {
        if (!dragging || host == null || dock == null) return;
        if (!RectTransformUtility.ScreenPointToLocalPointInRectangle(
            host, eventData.position, eventData.pressEventCamera, out var point))
            return;
        // Com pivô superior: arrastar para BAIXO aumenta a altura.
        dock.ResizePanel(isBag, startHeight + startY - point.y);
        eventData.Use();
    }

    public void OnEndDrag(PointerEventData eventData)
    {
        if (!dragging) return;
        dragging = false;
        if (dock != null) dock.FinishResize(isBag);
        eventData.Use();
    }
}
