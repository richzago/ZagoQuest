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
        // Não apagar snapshot recebido antes de Start por corrida de scene/network.
        if (string.IsNullOrEmpty(currentItemId)) ClearItem();
    }

    // =========================
    // INSCRIÇÃO EM EVENTOS
    // =========================

    private void SubscribeToNetworkEvents()
    {


        if (!isSubscribed)
        {
            // 🔥 CORRIGIDO: usar NetworkManager.Instance

            isSubscribed = true;
            Debug.Log($"[EquipmentSlotUI] Inscrito no evento para {slotType}");
        }
    }

    private void UnsubscribeFromNetworkEvents()
    {
        if (isSubscribed && NetworkManager.Instance != null)
        {

            isSubscribed = false;
            Debug.Log($"[EquipmentSlotUI] Desinscrito do evento para {slotType}");
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

        // 🔥 Nome do item
        if (slotText != null)
        {
            string shortName = itemId.Contains("/") ? itemId.Substring(itemId.LastIndexOf('/') + 1) : itemId;
            shortName = shortName.Replace("_", " ");
            slotText.text = shortName;
            slotText.gameObject.SetActive(true);
        }

        // Sem sprite: o texto identifica o item. Evitar Texture2D/Sprite
        // novos para cada snapshot de equipamento recebido do Node.
        if (itemIcon != null)
        {
            var sprite = Resources.Load<Sprite>($"Icons/{itemId}") ??
                         Resources.Load<Sprite>("Icons/default");
            itemIcon.sprite = sprite;
            itemIcon.enabled = sprite != null;
            itemIcon.preserveAspect = true;
            itemIcon.raycastTarget = false;
            itemIcon.color = Color.white;
        }
        if (slotText != null)
        {
            slotText.color = new Color32(236, 236, 230, 255);
            slotText.enableAutoSizing = true;
            slotText.fontSizeMin = 9;
            slotText.fontSizeMax = 12;
            slotText.alignment = TextAlignmentOptions.Center;
            slotText.raycastTarget = false;
        }

        Debug.Log($"[EquipmentSlotUI] Item definido: {itemId} no slot {slotType}");
    }

    public void ClearItem()
    {
        currentItemId = null;
        if (slotText != null)
        {
            slotText.text = slotType.ToString();
            slotText.color = new Color32(154, 168, 179, 255);
            slotText.gameObject.SetActive(true);
        }
        if (itemIcon != null)
        {
            itemIcon.sprite = null;
            itemIcon.color = new Color(0.2f, 0.2f, 0.2f, 0.5f);
            itemIcon.enabled = false;
        }
    }

    // =========================
    // INTERAÇÃO COM O USUÁRIO
    // =========================

    public void OnPointerClick(PointerEventData eventData)
    {
        if (string.IsNullOrEmpty(currentItemId)) return;
    }

    public void OnDrop(PointerEventData eventData)
    {
        Debug.Log($"[EquipmentSlotUI] 🟢 OnDrop chamado! slot={slotType}");

        // Verifica se o DragDropManager existe
        if (DragDropManager.Instance == null)
        {
            Debug.LogError("[EquipmentSlotUI] DragDropManager.Instance é nulo!");
            return;
        }

        if (!DragDropManager.Instance.IsDragging())
        {
            Debug.LogWarning("[EquipmentSlotUI] Não está arrastando nenhum item.");
            return;
        }

        string draggedItemId = DragDropManager.Instance.GetDraggedItemId();
        if (string.IsNullOrEmpty(draggedItemId))
        {
            Debug.LogWarning("[EquipmentSlotUI] draggedItemId vazio!");
            DragDropManager.Instance.EndDrag();
            return;
        }

        // Verifica se o NetworkManager existe
        if (NetworkManager.Instance == null)
        {
            Debug.LogError("[EquipmentSlotUI] NetworkManager.Instance é nulo!");
            DragDropManager.Instance.EndDrag();
            return;
        }

        if (!DragDropManager.Instance.IsFromInventory())
        {
            DragDropManager.Instance.EndDrag();
            return;
        }
        var network = NetworkManager.Instance;
        if (network == null || !network.isConnected || network.Inventory == null)
        {
            Debug.LogWarning("[EquipmentSlotUI] Não é possível equipar sem sessão ativa.");
            DragDropManager.Instance.EndDrag();
            return;
        }
        // O servidor valida tipo, slot compatível, quantidade e propriedade.
        DragDropManager.Instance.DropOnEquipmentSlot(slotType);
    }

    // =========================
    // DRAG & DROP (arrastar item equipado para fora)
    // =========================

    public void OnBeginDrag(PointerEventData eventData)
    {
        if (string.IsNullOrEmpty(currentItemId)) return;
        Debug.Log($"[EquipmentSlotUI] Iniciou arraste de {currentItemId} do slot {slotType}");
        DragDropManager.Instance?.StartDrag(currentItemId, this);
    }

    public void OnDrag(PointerEventData eventData) { }

    public void OnEndDrag(PointerEventData eventData)
    {
        if (DragDropManager.Instance == null || !DragDropManager.Instance.IsDragging()) return;
        Debug.Log($"[EquipmentSlotUI] Finalizou arraste de {currentItemId}");
        if (string.IsNullOrEmpty(currentItemId))
        {
            DragDropManager.Instance?.EndDrag();
            return;
        }

        // 🔥 CORRIGIDO: pointerCurrentRaycast é struct, acesse diretamente .gameObject
        GameObject target = eventData.pointerCurrentRaycast.gameObject;
        if (target != null && target.GetComponentInParent<InventorySlot>() != null)
        {
            // Já tratado pelo InventorySlot.OnDrop
            Debug.Log("[EquipmentSlotUI] Drop sobre InventorySlot → desequipamento será tratado lá.");
            DragDropManager.Instance.EndDrag();
            return;
        }

        // Soltar sobre UI não significa drop no chão.
        if (target != null && target.GetComponentInParent<Canvas>() != null)
        {
            DragDropManager.Instance.EndDrag();
            return;
        }
        if (Camera.main == null)
        {
            DragDropManager.Instance.EndDrag();
            return;
        }
        // Soltou no chão
        Vector3 worldPos = Camera.main.ScreenToWorldPoint(eventData.position);
        worldPos.z = 0;
        Debug.Log($"[EquipmentSlotUI] Drop no chão: {currentItemId} em ({worldPos.x:F0}, {worldPos.y:F0})");
        DragDropManager.Instance.DropOnGround(worldPos);
        DragDropManager.Instance.EndDrag();
    }
}