using UnityEngine;
using UnityEngine.EventSystems;
using UnityEngine.UI;

/// <summary>
/// C16: roda do mouse em pixels pequenos, em vez de scrollDelta bruto.
/// Alguns mouses/InputSystem enviam ±120 por notch: o ScrollRect nativo
/// multiplicava pelo sensitivity e pulava várias linhas de 50px.
/// O viewport interno recebe os eventos antes do ScrollRect externo.
/// </summary>
[DisallowMultipleComponent]
public sealed class C16FineScrollWheel : MonoBehaviour, IScrollHandler
{
    private ScrollRect scroll;

    public void Bind(ScrollRect owner) { scroll = owner; }

    public void OnScroll(PointerEventData eventData)
    {
        if (scroll == null || scroll.content == null || scroll.viewport == null ||
            !scroll.isActiveAndEnabled) return;
        Canvas.ForceUpdateCanvases();
        float hiddenPixels = Mathf.Max(0f,
            scroll.content.rect.height - scroll.viewport.rect.height);
        if (hiddenPixels < 1f) return;
        // No máximo 18 pixels por evento, bem menos que uma linha.
        float steps = Mathf.Clamp(eventData.scrollDelta.y, -1f, 1f);
        scroll.StopMovement();
        scroll.verticalNormalizedPosition = Mathf.Clamp01(
            scroll.verticalNormalizedPosition + (steps * 18f) / hiddenPixels);
        eventData.Use();
    }
}
