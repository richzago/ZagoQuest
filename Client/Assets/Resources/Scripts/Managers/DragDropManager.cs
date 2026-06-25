using UnityEngine;

[DefaultExecutionOrder(-200)] // Inicializa antes de tudo
public class DragDropManager : MonoBehaviour
{
    // =========================
    // SINGLETON
    // =========================

    public static DragDropManager Instance { get; private set; }

    // =========================
    // ESTADO DO ARRASTE
    // =========================

    private string draggedItemId = null;
    private Component sourceComponent = null;
    private bool isDragging = false;

    // =========================
    // CICLO DE VIDA
    // =========================

    private void Awake()
    {
        Debug.Log("[DragDropManager] 🟣 Awake executado.");

        if (Instance != null && Instance != this)
        {
            Debug.LogWarning("[DragDropManager] ⚠️ Instância já existe. Destruindo duplicata.");
            Destroy(gameObject);
            return;
        }

        Instance = this;
        DontDestroyOnLoad(gameObject);
        Debug.Log("[DragDropManager] ✅ Singleton configurado.");
    }

    private void Start()
    {
        Debug.Log("[DragDropManager] 🟢 Start executado. Pronto para receber drags.");
    }

    // =========================
    // MÉTODOS PÚBLICOS
    // =========================

    public void StartDrag(string itemId, Component source)
    {
        Debug.Log($"[DragDropManager] 🟢 StartDrag: itemId={itemId}, source={source?.GetType().Name}, isDragging={isDragging}");

        if (string.IsNullOrEmpty(itemId))
        {
            Debug.LogError("[DragDropManager] ❌ itemId vazio!");
            return;
        }

        if (source == null)
        {
            Debug.LogError("[DragDropManager] ❌ source nulo!");
            return;
        }

        if (isDragging)
        {
            Debug.LogWarning($"[DragDropManager] ⚠️ Finalizando arraste anterior ({draggedItemId})");
            EndDrag();
        }

        draggedItemId = itemId;
        sourceComponent = source;
        isDragging = true;

        Debug.Log($"[DragDropManager] ✅ Iniciou arraste de '{itemId}' de {source.GetType().Name}");
    }

    public void EndDrag()
    {
        if (!isDragging)
        {
            Debug.Log("[DragDropManager] ⚠️ EndDrag chamado mas não está arrastando.");
            return;
        }

        Debug.Log($"[DragDropManager] 🔴 Finalizou arraste de '{draggedItemId}'");
        draggedItemId = null;
        sourceComponent = null;
        isDragging = false;
    }

    public void CancelDrag()
    {
        if (!isDragging) return;
        Debug.Log($"[DragDropManager] ❌ Arraste cancelado: '{draggedItemId}'");
        draggedItemId = null;
        sourceComponent = null;
        isDragging = false;
    }

    // =========================
    // PROPRIEDADES DE CONSULTA
    // =========================

    public bool IsDragging()
    {
        bool dragging = isDragging && !string.IsNullOrEmpty(draggedItemId);
        Debug.Log($"[DragDropManager] 🔍 IsDragging: {dragging} (isDragging={isDragging}, draggedItemId={draggedItemId})");
        return dragging;
    }

    public string GetDraggedItemId()
    {
        Debug.Log($"[DragDropManager] 🔍 GetDraggedItemId: {draggedItemId}");
        return draggedItemId;
    }

    public Component GetSourceComponent()
    {
        Debug.Log($"[DragDropManager] 🔍 GetSourceComponent: {sourceComponent?.GetType().Name}");
        return sourceComponent;
    }

    public bool IsFromEquipment()
    {
        bool result = sourceComponent is EquipmentSlotUI;
        Debug.Log($"[DragDropManager] 🔍 IsFromEquipment: {result}");
        return result;
    }

    public bool IsFromInventory()
    {
        bool result = sourceComponent is InventorySlot;
        Debug.Log($"[DragDropManager] 🔍 IsFromInventory: {result}");
        return result;
    }

    public EquipmentSlotUI GetSourceEquipmentSlot()
    {
        var slot = sourceComponent as EquipmentSlotUI;
        Debug.Log($"[DragDropManager] 🔍 GetSourceEquipmentSlot: {(slot != null ? slot.slotType.ToString() : "null")}");
        return slot;
    }

    public InventorySlot GetSourceInventorySlot()
    {
        var slot = sourceComponent as InventorySlot;
        Debug.Log($"[DragDropManager] 🔍 GetSourceInventorySlot: {(slot != null ? "InventorySlot" : "null")}");
        return slot;
    }

    // =========================
    // MÉTODOS AUXILIARES DE DROP
    // =========================

    public void DropOnEquipmentSlot(EquipmentSlot slotType)
    {
        Debug.Log($"[DragDropManager] 📥 DropOnEquipmentSlot: slotType={slotType}, draggedItemId={draggedItemId}");

        if (!IsDragging())
        {
            Debug.LogWarning("[DragDropManager] ⚠️ Drop sem item arrastado.");
            return;
        }

        Debug.Log($"[DragDropManager] 📤 Enviando equipItem: {draggedItemId} para {slotType}");
        NetworkManager.Instance?.SendEquipItem(draggedItemId);
        EndDrag();
    }

    public void DropOnInventorySlot()
    {
        Debug.Log($"[DragDropManager] 📥 DropOnInventorySlot: draggedItemId={draggedItemId}, source={sourceComponent?.GetType().Name}");

        if (!IsDragging()) return;

        if (IsFromEquipment())
        {
            EquipmentSlotUI sourceSlot = GetSourceEquipmentSlot();
            if (sourceSlot != null)
            {
                Debug.Log($"[DragDropManager] 📤 Desequipando de {sourceSlot.slotType} para o inventário.");
                NetworkManager.Instance?.SendUnequipItem(sourceSlot.slotType);
                EndDrag();
            }
        }
        else
        {
            Debug.Log("[DragDropManager] 🧩 Drop no inventário (reorganização futura)");
            EndDrag();
        }
    }

    /// <summary>
    /// Processa um drop no mundo (chão).
    /// </summary>
    public void DropOnGround(Vector3 worldPosition)
    {
        Debug.Log($"[DragDropManager] 🌍 DropOnGround: draggedItemId={draggedItemId}, worldPos=({worldPosition.x:F1}, {worldPosition.y:F1})");

        if (!IsDragging())
        {
            Debug.LogWarning("[DragDropManager] ⚠️ DropOnGround sem item arrastado.");
            return;
        }

        // Converte a posição do mundo para tile (arredondando)
        int tileX = Mathf.RoundToInt(worldPosition.x);
        int tileY = Mathf.RoundToInt(worldPosition.y);

        Debug.Log($"[DragDropManager] 📤 Enviando dropItem: {draggedItemId} em ({tileX}, {tileY})");
        NetworkManager.Instance?.SendDropItem(draggedItemId, 1, tileX, tileY);
        EndDrag();
    }
}