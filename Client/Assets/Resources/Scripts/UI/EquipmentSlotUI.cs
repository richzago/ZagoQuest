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
            // 🔥 CORRIGIDO: usar NetworkManager.Instance
            NetworkManager.Instance.OnEquipmentUpdate += OnEquipmentUpdateHandler;
            isSubscribed = true;
            Debug.Log($"[EquipmentSlotUI] Inscrito no evento para {slotType}");
        }
    }

    private void UnsubscribeFromNetworkEvents()
    {
        if (isSubscribed && NetworkManager.Instance != null)
        {
            // 🔥 CORRIGIDO: usar NetworkManager.Instance
            NetworkManager.Instance.OnEquipmentUpdate -= OnEquipmentUpdateHandler;
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

        // 🔥 Ícone do item (placeholder)
        if (itemIcon != null)
        {
            // Tenta carregar um sprite do Resources (ex: "Icons/" + itemId)
            // Se não tiver, usa um quadrado branco.
            Sprite sprite = Resources.Load<Sprite>($"Icons/{itemId}") ??
                            Resources.Load<Sprite>("Icons/default");
            if (sprite != null)
                itemIcon.sprite = sprite;
            else
            {
                // Fallback: criar um sprite simples
                Texture2D tex = new Texture2D(64, 64);
                Color[] colors = new Color[64 * 64];
                for (int i = 0; i < colors.Length; i++) colors[i] = Color.gray;
                tex.SetPixels(colors);
                tex.Apply();
                itemIcon.sprite = Sprite.Create(tex, new Rect(0, 0, 64, 64), new Vector2(0.5f, 0.5f));
            }
            itemIcon.color = Color.white;
            itemIcon.enabled = true;
        }

        Debug.Log($"[EquipmentSlotUI] Item definido: {itemId} no slot {slotType}");
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
        Debug.Log($"[EquipmentSlotUI] Clique no slot {slotType} → desequipando {currentItemId}");
        NetworkManager.Instance?.SendUnequipItem(slotType);
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

        Debug.Log($"[EquipmentSlotUI] Drop recebido: {draggedItemId} → equipando no slot {slotType}");
        NetworkManager.Instance.SendEquipItem(draggedItemId);
        DragDropManager.Instance.EndDrag();
    }

    // =========================
    // DRAG & DROP (arrastar item equipado para fora)
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
        Debug.Log($"[EquipmentSlotUI] Finalizou arraste de {currentItemId}");
        if (string.IsNullOrEmpty(currentItemId))
        {
            DragDropManager.Instance?.EndDrag();
            return;
        }

        // 🔥 CORRIGIDO: pointerCurrentRaycast é struct, acesse diretamente .gameObject
        GameObject target = eventData.pointerCurrentRaycast.gameObject;
        if (target != null && target.GetComponent<InventorySlot>() != null)
        {
            // Já tratado pelo InventorySlot.OnDrop
            Debug.Log("[EquipmentSlotUI] Drop sobre InventorySlot → desequipamento será tratado lá.");
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