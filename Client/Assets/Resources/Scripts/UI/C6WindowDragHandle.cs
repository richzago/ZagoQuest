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
    }

    public void OnBeginDrag(PointerEventData eventData)
    {
        if (panel != null) panel.SetAsLastSibling();
    }

    public void OnDrag(PointerEventData eventData)
    {
        if (panel == null) return;
        var scale = canvas != null ? Mathf.Max(0.01f, canvas.scaleFactor) : 1f;
        panel.anchoredPosition += eventData.delta / scale;
    }

    public void OnEndDrag(PointerEventData eventData)
    {
        if (panel == null || string.IsNullOrEmpty(positionKey)) return;
        PlayerPrefs.SetFloat(positionKey + ".X", panel.anchoredPosition.x);
        PlayerPrefs.SetFloat(positionKey + ".Y", panel.anchoredPosition.y);
        PlayerPrefs.Save();
    }

    // Botão direito no título: restaurar posição padrão da janela.
    public void OnPointerClick(PointerEventData eventData)
    {
        if (panel == null || eventData.button != PointerEventData.InputButton.Right) return;
        panel.anchoredPosition = defaultPosition;
        PlayerPrefs.DeleteKey(positionKey + ".X");
        PlayerPrefs.DeleteKey(positionKey + ".Y");
        PlayerPrefs.Save();
    }
}
