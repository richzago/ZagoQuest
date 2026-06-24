using UnityEngine;
using UnityEngine.UI;
using UnityEngine.EventSystems;
using TMPro;
using System.Collections.Generic;

public class EquipmentSlotUI : MonoBehaviour, IPointerClickHandler, IDropHandler, IBeginDragHandler, IDragHandler, IEndDragHandler
{
    [Header("Configuração")]
    public EquipmentSlot slotType;

    [Header("UI References")]
    public Image itemIcon;
    public TextMeshProUGUI slotText;

    private string currentItemId;
    private bool isSubscribed = false;

    // =========================
    // CICLO DE VIDA
    // =========================

    private void OnEnable() => SubscribeToNetworkEvents();
    private void OnDisable() => UnsubscribeFromNetworkEvents();

    private void Start()
    {
        if (!isSubscribed) SubscribeToNetworkEvents();
        ClearItem();
    }

    // =========================
    // INSCRIÇÃO EM EVENTOS
    // =========================

    private void SubscribeToNetworkEvents()
    {
        if (NetworkManager.Instance == null)
        {
            Debug.LogWarning($"[EquipmentSlotUI] NetworkManager indisponível para {slotType}");
            return;
        }

        if (!isSubscribed)
        {
            NetworkManager.Instance.OnEquipmentUpdate += OnEquipmentUpdateHandler;
            isSubscribed = true;
        }
    }

    private void UnsubscribeFromNetworkEvents()
    {
        if (isSubscribed && NetworkManager.Instance != null)
        {
            NetworkManager.Instance.OnEquipmentUpdate -= OnEquipmentUpdateHandler;
            isSubscribed = false;
        }
    }

    // =========================
    // HANDLER DO EVENTO
    // =========================

    public void OnEquipmentUpdateHandler(Dictionary<EquipmentSlot, string> equipment)
    {
        if (equipment.TryGetValue(slotType, out string itemId))
            SetItem(itemId);
        else
            ClearItem();
    }

    // =========================
    // SET / CLEAR
    // =========================

    public void SetItem(string itemId)
    {
        currentItemId = itemId;
        if (string.IsNullOrEmpty(itemId))
        {
            ClearItem();
            return;
        }

        if (slotText != null)
        {
            string shortName = itemId.Contains("/") ? itemId.Substring(itemId.LastIndexOf('/') + 1) : itemId;
            shortName = shortName.Replace("_", " ");
            slotText.text = shortName;
            slotText.gameObject.SetActive(true);
        }
        else
        {
            GameObject go = new GameObject("SlotText_Dynamic");
            go.transform.SetParent(transform);
            go.transform.localPosition = Vector3.zero;
            go.transform.localScale = Vector3.one;
            slotText = go.AddComponent<TextMeshProUGUI>();
            slotText.text = itemId;
            slotText.fontSize = 14;
            slotText.color = Color.white;
            slotText.alignment = TextAlignmentOptions.Center;
            RectTransform rt = slotText.rectTransform;
            rt.anchorMin = Vector2.zero;
            rt.anchorMax = Vector2.one;
            rt.offsetMin = new Vector2(5, 5);
            rt.offsetMax = new Vector2(-5, -5);
            slotText.gameObject.SetActive(true);
            Debug.LogWarning($"[EquipmentSlotUI] slotText era nulo, criado dinamicamente para {slotType}");
        }

        if (itemIcon != null) itemIcon.color = Color.white;
    }

    public void ClearItem()
    {
        currentItemId = null;
        if (slotText != null)
        {
            slotText.text = string.Empty;
            slotText.gameObject.SetActive(false);
        }
        if (itemIcon != null)
        {
            itemIcon.color = new Color(0.2f, 0.2f, 0.2f, 0.5f);
            itemIcon.sprite = null;
        }
    }

    // =========================
    // INTERAÇÃO COM O USUÁRIO
    // =========================

    public void OnPointerClick(PointerEventData eventData)
    {
        if (string.IsNullOrEmpty(currentItemId)) return;
        Debug.Log($"[EquipmentSlotUI] Clique no slot {slotType} → desequipando {currentItemId}");
        NetworkManager.Instance?.SendUnequipItem(slotType);
    }

    public void OnDrop(PointerEventData eventData)
    {
        if (!DragDropManager.Instance.IsDragging()) return;

        string draggedItemId = DragDropManager.Instance.GetDraggedItemId();
        if (string.IsNullOrEmpty(draggedItemId)) return;

        // 🔥 Equipa o item arrastado
        NetworkManager.Instance?.SendEquipItem(draggedItemId);
        DragDropManager.Instance.EndDrag();
    }

    // =========================
    // DRAG & DROP
    // =========================

    public void OnBeginDrag(PointerEventData eventData)
    {
        if (string.IsNullOrEmpty(currentItemId)) return;
        Debug.Log($"[EquipmentSlotUI] Iniciou arraste de {currentItemId} do slot {slotType}");
        DragDropManager.Instance.StartDrag(currentItemId, this);
    }

    public void OnDrag(PointerEventData eventData) { }

    public void OnEndDrag(PointerEventData eventData)
    {
        Debug.Log("[EquipmentSlotUI] Finalizou arraste");

        // Se não foi dropado em nenhum slot, drop no chão
        if (eventData.pointerEnter == null || eventData.pointerEnter.GetComponent<IDropHandler>() == null)
        {
            Vector3 worldPos = Camera.main.ScreenToWorldPoint(eventData.position);
            DragDropManager.Instance.DropOnGround(worldPos);
            return;
        }

        if (DragDropManager.Instance.IsDragging())
            DragDropManager.Instance.EndDrag();
    }
}