using UnityEngine;
using UnityEngine.EventSystems;

/// <summary>Arraste vertical da borda inferior; largura do dock nunca muda.</summary>
public sealed class C7DockResizeGrip : MonoBehaviour, IDragHandler, IBeginDragHandler
{
    private RectTransform panel;
    private Canvas canvas;
    public void Bind(RectTransform target, Canvas owner)
    {
        panel = target; canvas = owner;
    }
    public void OnBeginDrag(PointerEventData eventData) { }
    public void OnDrag(PointerEventData eventData)
    {
        if (panel == null) return;
        float scale = canvas != null ? Mathf.Max(0.5f, canvas.scaleFactor) : 1f;
        C7DockLayout.Resize(panel, -eventData.delta.y / scale);
    }
}
