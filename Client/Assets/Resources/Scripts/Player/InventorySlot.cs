using UnityEngine;
using UnityEngine.UI;
using TMPro;
using UnityEngine.EventSystems;

/// <summary>
/// Representa um slot do inventário. Gerencia clique, duplo clique, drag & drop.
/// </summary>
public class InventorySlot : MonoBehaviour, IPointerClickHandler, IBeginDragHandler, IDragHandler, IEndDragHandler, IDropHandler
{
    [Header("UI References")]
    public Image itemIcon;          // Ícone do item
    public TMP_Text amountText;     // Texto da quantidade
    public TMP_Text nameText;       // Nome do item (opcional)

    private string itemId;          // ID completo do item
    private int amount;             // Quantidade
    private NetworkManager networkManager;

    // Evento disparado no duplo clique
    public System.Action<string> OnDoubleClick;

    // Controle de duplo clique
    private float lastClickTime = 0f;
    private const float DOUBLE_CLICK_INTERVAL = 0.3f;

    private void Awake()
    {
        // Debug.Log("[InventorySlot] 🟣 Awake() executado! " + gameObject.name);
    }

    // =========================
    // CONFIGURAÇÃO
    // =========================

    /// <summary>
    /// Configura o slot com os dados do item.
    /// </summary>
    /// 
    /// 
    public void Setup(string itemId, int amount, NetworkManager networkManager)
    {
        // Debug.Log($"[InventorySlot] 🛠️ Setup: itemId={itemId}, amount={amount}");
        this.itemId = itemId;
        this.amount = amount;
        this.networkManager = networkManager;

        // Extrai nome curto para exibição
        string shortName = itemId.Contains("/") ? itemId.Substring(itemId.LastIndexOf('/') + 1) : itemId;
        shortName = shortName.Replace("_", " ");

        if (nameText != null) nameText.text = shortName;
        if (amountText != null)
        {
            if (amount > 1) amountText.text = $"{shortName} x{amount}";
            else amountText.text = shortName;
        }

        // TODO: Carregar ícone do item (ex: ItemDatabase.GetIcon(itemId))
        // if (itemIcon != null) itemIcon.sprite = ...
    }

    // =========================
    // CLIQUE E DUPLO CLIQUE
    // =========================

    public void OnPointerClick(PointerEventData eventData)
    {
        Debug.Log($"[InventorySlot] 🖱️ OnPointerClick: {itemId}, button={eventData.button}");
        // Se estiver arrastando, ignora clique
        if (DragDropManager.Instance.IsDragging()) return;

        // Clique direito → usar item
        if (eventData.button == PointerEventData.InputButton.Right)
        {
            if (networkManager != null)
            {
                Debug.Log($"[InventorySlot] 🖱️ Usando item: {itemId}");
                networkManager.Inventory.UseItem(itemId);
            }
            return;
        }

        // Clique esquerdo → duplo clique
        if (eventData.button == PointerEventData.InputButton.Left)
        {
            float timeSinceLastClick = Time.time - lastClickTime;
            if (timeSinceLastClick < DOUBLE_CLICK_INTERVAL)
            {
                Debug.Log($"[InventorySlot] 🔄 Duplo clique em {itemId} → equipar");
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
        Debug.Log($"[InventorySlot] 🟢 OnBeginDrag: {itemId}");
        if (string.IsNullOrEmpty(itemId))
        {
            Debug.LogWarning("[InventorySlot] ⚠️ OnBeginDrag cancelado: itemId vazio");
            return;
        }

        DragDropManager.Instance?.StartDrag(itemId, this);
    }

    public void OnDrag(PointerEventData eventData)
    {
        // Nada necessário, o DragDropManager já cuida do visual
    }

    public void OnEndDrag(PointerEventData eventData)
    {
        Debug.Log($"[InventorySlot] 🔴 OnEndDrag: {itemId}");

        if (string.IsNullOrEmpty(itemId))
            return;

        // 🔥 CORRIGIDO: pointerCurrentRaycast é struct, usa .gameObject diretamente
        GameObject target = eventData.pointerCurrentRaycast.gameObject;
        if (target != null)
        {
            EquipmentSlotUI slotUI = target.GetComponent<EquipmentSlotUI>();
            if (slotUI != null)
            {
                Debug.Log($"[InventorySlot] ✅ Drop sobre EquipmentSlotUI ({slotUI.slotType})");
                DragDropManager.Instance?.EndDrag();
                return;
            }
        }

        // Se não foi sobre equipment, tenta dropar no chão
        Vector3 worldPos = Camera.main.ScreenToWorldPoint(eventData.position);
        worldPos.z = 0;
        Debug.Log($"[InventorySlot] 🌍 Drop no chão em ({worldPos.x:F0}, {worldPos.y:F0})");
        DragDropManager.Instance?.DropOnGround(worldPos);
        DragDropManager.Instance?.EndDrag();
    }

    // =========================
    // RECEBER DROP DE OUTRO SLOT
    // =========================

    public void OnDrop(PointerEventData eventData)
    {
        Debug.Log($"[InventorySlot] 📥 OnDrop recebido de {eventData.pointerDrag?.name}");

        if (!DragDropManager.Instance.IsDragging()) return;

        // Verifica se o drop veio de um slot de equipamento (desequipar)
        if (DragDropManager.Instance.IsFromEquipment())
        {
            EquipmentSlotUI sourceSlot = DragDropManager.Instance.GetSourceEquipmentSlot();
            if (sourceSlot != null)
            {
                Debug.Log($"[InventorySlot] ⬅️ Desequipando de {sourceSlot.slotType} para o inventário.");
                NetworkManager.Instance?.Inventory.SendUnequipItem(sourceSlot.slotType);
                DragDropManager.Instance.EndDrag();
            }
        }
        else
        {
            // Futuro: reorganização de inventário (swap)
            Debug.Log("[InventorySlot] 🧩 Drop de item do inventário (reorganização futura)");
            DragDropManager.Instance.EndDrag();
        }
    }
}