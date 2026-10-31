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
    private string itemType;
    private NetworkManager networkManager;

    // Evento disparado no duplo clique
    public System.Action<string> OnDoubleClick;

    // Controle de duplo clique
    private float lastClickTime;
    private bool hasFirstClick;
    private const float DOUBLE_CLICK_INTERVAL = 0.3f;
    private static string lastConsumableItem;
    private static float lastConsumableRequestAt = -1f;

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
    public void Setup(string itemId, int amount, NetworkManager networkManager, string itemType = null)
    {
        // Debug.Log($"[InventorySlot] 🛠️ Setup: itemId={itemId}, amount={amount}");
        this.itemId = itemId;
        this.amount = amount;
        this.networkManager = networkManager;
        this.itemType = itemType;
        // Um slot reciclado ou reconstruído não deve herdar a janela de clique.
        hasFirstClick = false;

        string shortName = itemId.Contains("/") ? itemId.Substring(itemId.LastIndexOf('/') + 1) : itemId;
        shortName = shortName.Replace("_", " ");
        // Nome no rodapé e quantidade no canto: não repetir o nome duas vezes.
        var background = GetComponent<Image>();
        if (background == null) background = gameObject.AddComponent<Image>();
        background.color = new Color32(33, 46, 61, 245);
        background.raycastTarget = true;
        if (itemIcon != null)
        {
            var sprite = Resources.Load<Sprite>($"Icons/{itemId}") ??
                         Resources.Load<Sprite>("Icons/default");
            itemIcon.sprite = sprite;
            itemIcon.color = sprite != null ? Color.white : new Color32(59, 74, 88, 235);
            itemIcon.preserveAspect = sprite != null;
            itemIcon.raycastTarget = false;
            var rect = itemIcon.rectTransform;
            rect.anchorMin = rect.anchorMax = new Vector2(0.5f, 0.5f);
            rect.anchoredPosition = new Vector2(0, 12);
            rect.sizeDelta = new Vector2(50, 50);
        }
        if (nameText != null)
        {
            nameText.text = shortName;
            nameText.gameObject.SetActive(true);
            nameText.fontSize = 13;
            if (nameText is TextMeshProUGUI label)
            {
                label.enableAutoSizing = true;
                label.fontSizeMin = 10;
                label.fontSizeMax = 13;
                label.alignment = TextAlignmentOptions.Center;
                label.raycastTarget = false;
                label.rectTransform.anchorMin = Vector2.zero;
                label.rectTransform.anchorMax = new Vector2(1, 0.33f);
                label.rectTransform.offsetMin = new Vector2(4, 2);
                label.rectTransform.offsetMax = new Vector2(-4, 0);
                label.color = new Color32(236, 236, 230, 255);
            }
        }
        if (amountText != null)
        {
            amountText.text = amount > 1 ? $"x{amount:N0}" : string.Empty;
            amountText.gameObject.SetActive(amount > 1);
            amountText.fontSize = 14;
            if (amountText is TextMeshProUGUI quantity)
            {
                quantity.alignment = TextAlignmentOptions.TopRight;
                quantity.raycastTarget = false;
                quantity.rectTransform.anchorMin = new Vector2(0.48f, 0.7f);
                quantity.rectTransform.anchorMax = Vector2.one;
                quantity.rectTransform.offsetMin = Vector2.zero;
                quantity.rectTransform.offsetMax = new Vector2(-3, -2);
                quantity.color = new Color32(237, 193, 110, 255);
            }
        }
        // ClickArea é decorativo na cena (Button sem listener).
        // Desativa seu raycast para o InventorySlot receber clique/drag.
        var clickArea = transform.Find("ClickArea");
        if (clickArea != null && clickArea.TryGetComponent<Image>(out var clickImage))
            clickImage.raycastTarget = false;
    }

    // =========================
    // CLIQUE E DUPLO CLIQUE
    // =========================

    public void OnPointerClick(PointerEventData eventData)
    {
        Debug.Log($"[InventorySlot] 🖱️ OnPointerClick: {itemId}, button={eventData.button}");
        // Se estiver arrastando, ignora clique
        if (DragDropManager.Instance != null && DragDropManager.Instance.IsDragging()) return;

        // Botão direito e duplo clique usam o MESMO comando useItem.
        // O servidor resolve: consumível (comida/poção) ou equipamento.
        if (eventData.button == PointerEventData.InputButton.Right)
        {
            hasFirstClick = false;
            var network = NetworkManager.Instance ?? networkManager;
            if (network != null && network.isConnected && network.Inventory != null &&
                !string.IsNullOrWhiteSpace(itemId))
            {
                Debug.Log($"[InventorySlot] Usar item: {itemId}");
                network.Inventory.UseItem(itemId);
            }
            return;
        }

        // O snapshot Node informa o tipo. Clique simples consome; o
        // servidor decide efeitos e envia o inventario atualizado.
        if (eventData.button == PointerEventData.InputButton.Left && itemType == "consumable")
        {
            hasFirstClick = false;
            float now = Time.unscaledTime;
            if (lastConsumableItem == itemId && lastConsumableRequestAt >= 0 &&
                now - lastConsumableRequestAt <= DOUBLE_CLICK_INTERVAL)
                return;
            var network = NetworkManager.Instance ?? networkManager;
            if (network != null && network.isConnected && network.Inventory != null)
            {
                lastConsumableItem = itemId;
                lastConsumableRequestAt = now;
                network.Inventory.UseItem(itemId);
            }
            return;
        }

        if (eventData.button == PointerEventData.InputButton.Left)
        {
            float now = Time.unscaledTime;
            if (hasFirstClick && now - lastClickTime <= DOUBLE_CLICK_INTERVAL)
            {
                hasFirstClick = false; // um evento, não duas ações seguidas
                Debug.Log($"[InventorySlot] Duplo clique em {itemId} → usar");
                OnDoubleClick?.Invoke(itemId);
                return;
            }
            hasFirstClick = true;
            lastClickTime = now;
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
        // O OnDrop do slot de equipamento já pode ter consumido o drag.
        if (DragDropManager.Instance == null || !DragDropManager.Instance.IsDragging()) return;
        Debug.Log($"[InventorySlot] 🔴 OnEndDrag: {itemId}");

        if (string.IsNullOrEmpty(itemId))
            return;

        // 🔥 CORRIGIDO: pointerCurrentRaycast é struct, usa .gameObject diretamente
        GameObject target = eventData.pointerCurrentRaycast.gameObject;
        if (target != null)
        {
            EquipmentSlotUI slotUI = target.GetComponentInParent<EquipmentSlotUI>();
            if (slotUI != null)
            {
                Debug.Log($"[InventorySlot] ✅ Drop sobre EquipmentSlotUI ({slotUI.slotType})");
                DragDropManager.Instance?.EndDrag();
                return;
            }
        }

        // Não mandar drop no mundo ao soltar sobre janela ou botão da UI.
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
        // Se não foi sobre UI, tenta dropar no chão
        Vector3 worldPos = Camera.main.ScreenToWorldPoint(eventData.position);
        worldPos.z = 0;
        Debug.Log($"[InventorySlot] 🌍 Drop no chão em ({worldPos.x:F0}, {worldPos.y:F0})");
        DragDropManager.Instance.DropOnGround(worldPos);
        // DropOnGround valida alcance, solicita ao Node e encerra o drag.
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