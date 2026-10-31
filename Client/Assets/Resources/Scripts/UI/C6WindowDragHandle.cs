using UnityEngine;
using UnityEngine.EventSystems;

/** Componente runtime de arraste de janelas compactas. */
public sealed class C6WindowDragHandle : MonoBehaviour,
    IBeginDragHandler, IDragHandler, IEndDragHandler, IPointerClickHandler
{
    private RectTransform panel;
    private string positionKey;
    private Vector2 defaultPosition;
    private Canvas canvas;
    private float beginY;

    public void Bind(RectTransform target, string key)
    {
        if (target == null) return;
        panel = target;
        positionKey = "ZagoQuest.C6.Window." + key;
        defaultPosition = panel.anchoredPosition;
        canvas = panel.GetComponentInParent<Canvas>();
        if (PlayerPrefs.HasKey(positionKey + ".X") &&
            PlayerPrefs.HasKey(positionKey + ".Y"))
        {
            panel.anchoredPosition = new Vector2(
                PlayerPrefs.GetFloat(positionKey + ".X"),
                PlayerPrefs.GetFloat(positionKey + ".Y"));
        }
        KeepOnScreen();
    }

    public void OnBeginDrag(PointerEventData eventData)
    {
        beginY = eventData.position.y;
        if (panel != null && !C7DockLayout.IsDocked(panel)) panel.SetAsLastSibling();
    }

    public void OnDrag(PointerEventData eventData)
    {
        if (panel == null || C7DockLayout.IsDocked(panel)) return;
        var scale = canvas != null ? Mathf.Max(0.01f, canvas.scaleFactor) : 1f;
        panel.anchoredPosition += eventData.delta / scale;
        KeepOnScreen();
    }

    public void OnEndDrag(PointerEventData eventData)
    {
        if (panel == null) return;
        if (C7DockLayout.IsDocked(panel))
        {
            C7DockLayout.Reorder(panel, eventData.position.y - beginY);
            return;
        }
        if (string.IsNullOrEmpty(positionKey)) return;
        PlayerPrefs.SetFloat(positionKey + ".X", panel.anchoredPosition.x);
        PlayerPrefs.SetFloat(positionKey + ".Y", panel.anchoredPosition.y);
        PlayerPrefs.Save();
    }

    /// <summary>Evita que posições salvas em 1920x1080 desapareçam a 1280x720.</summary>
    private void KeepOnScreen()
    {
        if (panel == null) return;
        var parent = panel.parent as RectTransform;
        if (parent == null) return;
        Vector2 size = parent.rect.size;
        Vector2 dimensions = panel.rect.size;
        Vector2 anchor = (panel.anchorMin + panel.anchorMax) * 0.5f;
        Vector2 pivot = panel.pivot;
        const float margin = 4f;
        float minX = -anchor.x * size.x + pivot.x * dimensions.x + margin;
        float maxX = (1f - anchor.x) * size.x - (1f - pivot.x) * dimensions.x - margin;
        float minY = -anchor.y * size.y + pivot.y * dimensions.y + margin;
        float maxY = (1f - anchor.y) * size.y - (1f - pivot.y) * dimensions.y - margin;
        Vector2 pos = panel.anchoredPosition;
        pos.x = minX <= maxX ? Mathf.Clamp(pos.x, minX, maxX) : (minX + maxX) / 2f;
        pos.y = minY <= maxY ? Mathf.Clamp(pos.y, minY, maxY) : (minY + maxY) / 2f;
        panel.anchoredPosition = pos;
    }

    // Botão direito no título: restaurar posição padrão da janela.
    public void OnPointerClick(PointerEventData eventData)
    {
        if (panel == null || eventData.button != PointerEventData.InputButton.Right) return;
        if (C7DockLayout.IsDocked(panel))
        {
            C7DockLayout.ResetHeight(panel);
            return;
        }
        panel.anchoredPosition = defaultPosition;
        KeepOnScreen();
        PlayerPrefs.DeleteKey(positionKey + ".X");
        PlayerPrefs.DeleteKey(positionKey + ".Y");
        PlayerPrefs.Save();
    }
}
