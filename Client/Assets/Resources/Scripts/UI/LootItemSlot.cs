using TMPro;
using UnityEngine;
using UnityEngine.EventSystems;
using ZagoQuest.Networking.Messages;

/// <summary>
/// Toda a linha de loot é clicável com UM clique. Rótulos TMP não bloqueiam
/// o raycast no Image do root. LootUI impede comandos repetidos até lootTaken.
/// </summary>
public class LootItemSlot : MonoBehaviour, IPointerClickHandler,
    IBeginDragHandler, IDragHandler, IEndDragHandler
{
    [Header("UI References")]
    public TextMeshProUGUI itemNameText;
    public TextMeshProUGUI amountText;

    private int index;
    private System.Action<int> onItemClick;

    public void Setup(LootItem item, int itemIndex, System.Action<int> callback)
    {
        index = itemIndex;
        onItemClick = callback;
        if (itemNameText != null)
        {
            itemNameText.text = item.itemName;
            WorldWindowLayout.Place(itemNameText, 0.04f, 0.07f, 0.76f, 0.93f,
                17, WorldWindowLayout.Label);
        }
        if (amountText != null)
        {
            amountText.text = item.amount + "x";
            WorldWindowLayout.Place(amountText, 0.79f, 0.07f, 0.96f, 0.93f,
                16, WorldWindowLayout.Gold);
            amountText.alignment = TextAlignmentOptions.MidlineRight;
        }
    }

    /// <summary>Somente fonte/layout: callback com indice autoritativo intacto.</summary>
    public void CompactForSidebar()
    {
        if (itemNameText != null)
        {
            WorldWindowLayout.Place(itemNameText, 0.035f, 0.07f,
                0.73f, 0.93f, 12, WorldWindowLayout.Label);
            itemNameText.enableAutoSizing = true;
            itemNameText.fontSizeMin = 9f;
            itemNameText.fontSizeMax = 12f;
            itemNameText.enableWordWrapping = false;
        }
        if (amountText != null)
        {
            WorldWindowLayout.Place(amountText, 0.75f, 0.07f,
                0.97f, 0.93f, 12, WorldWindowLayout.Gold);
            amountText.alignment = TextAlignmentOptions.MidlineRight;
        }
    }

    public int ItemIndex => index;

    private void Awake()
    {
        // Garantir que o próprio root receba o raycast. Prefabs antigos
        // podem ter Image ausente/desativada, então só rótulos clicariam.
        var image = GetComponent<UnityEngine.UI.Image>();
        if (image == null) image = gameObject.AddComponent<UnityEngine.UI.Image>();
        image.raycastTarget = true;
        image.enabled = true;
        if (itemNameText != null) itemNameText.raycastTarget = false;
        if (amountText != null) amountText.raycastTarget = false;
    }

    public void OnBeginDrag(PointerEventData eventData)
    {
        // O EventSystem entrega pointerDrag ao destino, sem tocar no
        // DragDropManager do inventário/equipamento.
    }

    public void OnDrag(PointerEventData eventData) { }

    public void OnEndDrag(PointerEventData eventData)
    {
        // O drop sobre C9LootBagDropTarget/InventorySlot é atendido
        // primeiro pelo EventSystem. Sobre Canvas, nunca dropar no mundo.
        var over = eventData.pointerCurrentRaycast.gameObject;
        if (over != null && over.GetComponentInParent<Canvas>() != null)
            return;
        if (eventData.button != PointerEventData.InputButton.Left) return;
        LootUI.Instance?.DropItemToWorld(index, eventData.position);
    }

    public void OnPointerClick(PointerEventData eventData)
    {
        if (eventData.button == PointerEventData.InputButton.Left)
        {
            Debug.Log($"[LootItemSlot] Selecionado index={index}");
            onItemClick?.Invoke(index);
        }
    }
}
