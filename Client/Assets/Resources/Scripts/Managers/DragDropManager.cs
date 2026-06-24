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
        Debug.Log("[DragDropManager] Awake executado.");

        if (Instance != null && Instance != this)
        {
            Debug.LogWarning("[DragDropManager] Instância já existe. Destruindo duplicata.");
            Destroy(gameObject);
            return;
        }

        Instance = this;
        DontDestroyOnLoad(gameObject);
    }

    // =========================
    // MÉTODOS PÚBLICOS
    // =========================

    public void StartDrag(string itemId, Component source)
    {
        if (string.IsNullOrEmpty(itemId))
        {
            Debug.LogError("[DragDropManager] itemId vazio!");
            return;
        }

        if (source == null)
        {
            Debug.LogError("[DragDropManager] source nulo!");
            return;
        }

        if (isDragging)
        {
            Debug.LogWarning($"[DragDropManager] Finalizando arraste anterior ({draggedItemId})");
            EndDrag();
        }

        draggedItemId = itemId;
        sourceComponent = source;
        isDragging = true;

        Debug.Log($"[DragDropManager] Iniciou arraste de '{itemId}' de {source.GetType().Name}");
    }

    public void EndDrag()
    {
        if (!isDragging) return;

        Debug.Log($"[DragDropManager] Finalizou arraste de '{draggedItemId}'");
        draggedItemId = null;
        sourceComponent = null;
        isDragging = false;
    }

    public void CancelDrag()
    {
        if (!isDragging) return;
        Debug.Log($"[DragDropManager] Arraste cancelado: '{draggedItemId}'");
        draggedItemId = null;
        sourceComponent = null;
        isDragging = false;
    }

    // =========================
    // PROPRIEDADES DE CONSULTA
    // =========================

    public bool IsDragging() => isDragging && !string.IsNullOrEmpty(draggedItemId);
    public string GetDraggedItemId() => draggedItemId;
    public Component GetSourceComponent() => sourceComponent;
    public bool IsFromEquipment() => sourceComponent is EquipmentSlotUI;
    public bool IsFromInventory() => sourceComponent is InventorySlot;

    public EquipmentSlotUI GetSourceEquipmentSlot()
    {
        return sourceComponent as EquipmentSlotUI;
    }

    public InventorySlot GetSourceInventorySlot()
    {
        return sourceComponent as InventorySlot;
    }

    // =========================
    // MÉTODOS AUXILIARES DE DROP
    // =========================

    public void DropOnEquipmentSlot(EquipmentSlot slotType)
    {
        if (!IsDragging())
        {
            Debug.LogWarning("[DragDropManager] Drop sem item arrastado.");
            return;
        }

        NetworkManager.Instance?.SendEquipItem(draggedItemId);
        EndDrag();
    }

    public void DropOnInventorySlot()
    {
        if (!IsDragging()) return;

        if (IsFromEquipment())
        {
            EquipmentSlotUI sourceSlot = GetSourceEquipmentSlot();
            if (sourceSlot != null)
            {
                Debug.Log($"[DragDropManager] Drop no inventário: desequipando {sourceSlot.slotType}");
                NetworkManager.Instance?.SendUnequipItem(sourceSlot.slotType);
                EndDrag();
            }
        }
        else
        {
            Debug.Log("[DragDropManager] Drop no inventário (reorganização futura)");
            EndDrag();
        }
    }

    /// <summary>
    /// Processa um drop no mundo (chão).
    /// </summary>
    public void DropOnGround(Vector3 worldPosition)
    {
        if (!IsDragging()) return;

        // Converte a posição do mundo para tile (arredondando)
        int tileX = Mathf.RoundToInt(worldPosition.x);
        int tileY = Mathf.RoundToInt(worldPosition.y);

        Debug.Log($"[DragDropManager] Drop no chão: {draggedItemId} em ({tileX}, {tileY})");
        NetworkManager.Instance?.SendDropItem(draggedItemId, 1, tileX, tileY);
        EndDrag();
    }
}