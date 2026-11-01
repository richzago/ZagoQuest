using UnityEngine;


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
        // OnDrop e OnEndDrag podem ser notificados no mesmo frame pelo EventSystem.
        // Encerrar duas vezes não é erro e nunca deve bloquear o próximo drag.
        if (!isDragging) return;

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
        var bagInstanceId = GetSourceInventorySlot()?.BagInstanceId;
        NetworkManager.Instance?.Inventory.SendEquipItem(draggedItemId, bagInstanceId);
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
                NetworkManager.Instance?.Inventory.SendUnequipItem(sourceSlot.slotType);
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
    /// Tenta soltar um item no chão. O cliente bloqueia pedidos obviamente
    /// inválidos para dar feedback imediato; o Node continua autoritativo
    /// (alcance, bounds, posse do item, quantidade e concorrência).
    /// Finaliza o arraste UMA vez, mesmo em erro de rede/alcance.
    /// </summary>
    public void DropOnGround(Vector3 worldPosition)
    {
        if (!IsDragging()) return;

        try
        {
            var network = NetworkManager.Instance;
            if (network == null || !network.isConnected || network.Inventory == null)
            {
                ShowDropFeedback("Sem conexão com o servidor.");
                return;
            }

            var player = PlayerController.Instance;
            if (player == null || !player.TryGetConfirmedGridPosition(out Vector2Int playerTile))
            {
                ShowDropFeedback("Aguarde a posição do personagem ser confirmada.");
                return;
            }

            if (float.IsNaN(worldPosition.x) || float.IsNaN(worldPosition.y) ||
                float.IsInfinity(worldPosition.x) || float.IsInfinity(worldPosition.y))
            {
                ShowDropFeedback("Posição de drop inválida.");
                return;
            }

            // Mesmo arredondamento do inventory.handler.ts: Math.floor(x/y).
            // RoundToInt divergia em tiles negativos e nas bordas dos tiles.
            int tileX = Mathf.FloorToInt(worldPosition.x);
            int tileY = Mathf.FloorToInt(worldPosition.y);

            // O Node usa Manhattan <= 2 (não distância Euclidiana).
            // Convertendo para long evita overflow na subtração de tiles.
            long distance = System.Math.Abs((long)tileX - playerTile.x) +
                            System.Math.Abs((long)tileY - playerTile.y);
            if (distance > 2)
            {
                ShowDropFeedback("Muito longe para soltar o item (máximo: 2 tiles).");
                return;
            }

            // Não retirar item nem alterar a UI aqui. Node responde com
            // snapshot do inventário/equipamento após aceitar o drop.
            network.Inventory.SendDropItem(draggedItemId, 1, tileX, tileY,
                IsFromEquipment(), GetSourceInventorySlot()?.BagInstanceId);
        }
        finally
        {
            EndDrag();
        }
    }

    private static void ShowDropFeedback(string message)
    {
        Debug.LogWarning("[DragDropManager] " + message);
        ChatUI.Instance?.AddMessage("Drop: " + message);
    }
}
