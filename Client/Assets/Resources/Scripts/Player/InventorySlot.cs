using UnityEngine;
using UnityEngine.UI;
using TMPro;
using UnityEngine.EventSystems;

public class InventorySlot : MonoBehaviour, IPointerClickHandler, IBeginDragHandler, IDragHandler, IEndDragHandler, IDropHandler
{
    [Header("UI References")]
    public Image itemIcon;
    public TMP_Text amountText;
    public TMP_Text nameText;

    private string itemId;
    private int amount;
    private NetworkManager networkManager;

    public System.Action<string> OnDoubleClick;

    private float lastClickTime = 0f;
    private const float DOUBLE_CLICK_INTERVAL = 0.3f;

    // =========================
    // CONFIGURAÇÃO
    // =========================

    public void Setup(string itemId, int amount, NetworkManager networkManager)
    {
        this.itemId = itemId;
        this.amount = amount;
        this.networkManager = networkManager;

        string shortName = itemId.Contains("/") ? itemId.Substring(itemId.LastIndexOf('/') + 1) : itemId;
        shortName = shortName.Replace("_", " ");

        if (nameText != null) nameText.text = shortName;
        if (amountText != null)
        {
            if (amount > 1) amountText.text = $"{shortName} x{amount}";
            else amountText.text = shortName;
        }
    }

    // =========================
    // CLIQUE
    // =========================

    public void OnPointerClick(PointerEventData eventData)
    {
        if (DragDropManager.Instance.IsDragging()) return;

        if (eventData.button == PointerEventData.InputButton.Right)
        {
            if (networkManager != null)
            {
                Debug.Log($"[InventorySlot] Usando item: {itemId}");
                networkManager.UseItem(itemId);
            }
            return;
        }

        if (eventData.button == PointerEventData.InputButton.Left)
        {
            float timeSinceLastClick = Time.time - lastClickTime;
            if (timeSinceLastClick < DOUBLE_CLICK_INTERVAL)
            {
                Debug.Log($"[InventorySlot] Duplo clique em {itemId}");
                OnDoubleClick?.Invoke(itemId);
                lastClickTime = 0f;
                return;
            }
            lastClickTime = Time.time;
        }
    }

    // =========================
    // DRAG & DROP
    // =========================

    public void OnBeginDrag(PointerEventData eventData)
    {
        if (string.IsNullOrEmpty(itemId)) return;
        Debug.Log($"[Drag] Iniciou arraste de {itemId}");
        DragDropManager.Instance.StartDrag(itemId, this);
    }

    public void OnDrag(PointerEventData eventData) { }

    public void OnEndDrag(PointerEventData eventData)
    {
        Debug.Log("[Drag] Finalizou arraste");

        // Verifica se o drop foi em um slot de UI
        if (eventData.pointerEnter == null || eventData.pointerEnter.GetComponent<IDropHandler>() == null)
        {
            // Drop fora da UI → chão
            Vector3 worldPos = Camera.main.ScreenToWorldPoint(eventData.position);
            DragDropManager.Instance.DropOnGround(worldPos);
            return;
        }

        if (DragDropManager.Instance.IsDragging())
            DragDropManager.Instance.EndDrag();
    }

    // =========================
    // DROP (receber item arrastado)
    // =========================

    public void OnDrop(PointerEventData eventData)
    {
        if (!DragDropManager.Instance.IsDragging()) return;

        // 🔥 Se o item veio de um slot de equipamento, desequipa
        if (DragDropManager.Instance.IsFromEquipment())
        {
            EquipmentSlotUI sourceSlot = DragDropManager.Instance.GetSourceEquipmentSlot();
            if (sourceSlot != null)
            {
                Debug.Log($"[InventorySlot] Drop recebido: equipamento {sourceSlot.slotType} → desequipando.");
                NetworkManager.Instance?.SendUnequipItem(sourceSlot.slotType);
                DragDropManager.Instance.EndDrag();
            }
        }
        else
        {
            // Futuro: reorganização de inventário
            Debug.Log("[InventorySlot] Drop de item do inventário (reorganização futura)");
            DragDropManager.Instance.EndDrag();
        }
    }
}