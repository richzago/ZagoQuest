using UnityEngine;
using System.Collections.Generic;

/// <summary>
/// Gerencia o painel de equipamentos.
/// </summary>
public class EquipmentUI : MonoBehaviour
{
    public static EquipmentUI Instance;

    [Header("References")]
    public GameObject equipmentPanel;
    public Transform slotsContainer;

    private Dictionary<EquipmentSlot, EquipmentSlotUI> slotMap = new Dictionary<EquipmentSlot, EquipmentSlotUI>();
    // O snapshot pode chegar pelo WS ANTES de Start mapear os slots da scene.
    private Dictionary<EquipmentSlot, string> latestSnapshot;
    private bool receivedSnapshot;

    // A C8 transforma ESTE painel existente em componente fixo da sidebar.
    // Nenhum segundo EquipmentUI e criado. Ao voltar ao modo flutuante,
    // TogglePanel retoma o comportamento historico.
    public bool IsDockedInSidebar { get; private set; }
    public void SetSidebarDocked(bool docked) => IsDockedInSidebar = docked;

    private void Awake()
    {
        if (Instance != null && Instance != this)
        {
            Destroy(gameObject);
            return;
        }
        Instance = this;
    }

    private void Start()
    {
        if (slotsContainer == null)
        {
            Debug.LogError("[EquipmentUI] SlotsContainer não atribuído no Inspector.");
            return;
        }
        // Mapeia os slots
        slotMap.Clear();
        foreach (Transform child in slotsContainer)
        {
            var slotUI = child.GetComponent<EquipmentSlotUI>();
            if (slotUI != null)
            {
                slotMap[slotUI.slotType] = slotUI;
                Debug.Log($"[EquipmentUI] Slot mapeado: {slotUI.slotType}");
            }
        }
        Debug.Log($"[EquipmentUI] Total de slots mapeados: {slotMap.Count}");
        if (receivedSnapshot) OnEquipmentUpdate(latestSnapshot);
        C6InventoryEquipmentLayout.Equipment(equipmentPanel, slotsContainer,
            () => { if (equipmentPanel != null) equipmentPanel.SetActive(false); });

        // 🔥 CORRIGIDO: usar NetworkManager.Instance
        if (NetworkManager.Instance != null)
        {

            Debug.Log("[EquipmentUI] Inscrito no evento OnEquipmentUpdate via Instance.");
        }
        else
        {
            Debug.LogError("[EquipmentUI] NetworkManager.Instance é null!");
        }
    }

    private void OnDestroy()
    {
        if (Instance == this) Instance = null;
    }

    /// <summary>
    /// Recebe a atualização do servidor e repassa para os slots.
    /// </summary>
    private void OnEquipmentUpdate(Dictionary<EquipmentSlot, string> equipment)
    {
        // Debug.Log($"[EquipmentUI] 🔄 Atualização recebida! {equipment?.Count ?? 0} slots.");
        if (equipment == null) return;

        // O protocolo envia somente os slots equipados. Slots ausentes
        // representam vazios: é obrigatório limpar itens antigos após unequip.
        foreach (var kvp in slotMap)
        {
            equipment.TryGetValue(kvp.Key, out string itemId);
            kvp.Value.SetItem(itemId);
        }
    }

    // 🔥 Método público para forçar atualização (opcional)
    public void UpdateEquipment(Dictionary<EquipmentSlot, string> equipment)
    {
        if (equipment == null) return;
        latestSnapshot = new Dictionary<EquipmentSlot, string>(equipment);
        receivedSnapshot = true;
        if (slotMap.Count > 0) OnEquipmentUpdate(latestSnapshot);
    }

    public void TogglePanel()
    {
        if (equipmentPanel == null) return;
        // A sidebar fixa exibe slots continuamente; o toggle legado
        // nao pode ocultar/desacoplar o GameObject com este componente.
        if (IsDockedInSidebar) return;
        equipmentPanel.SetActive(!equipmentPanel.activeSelf);
        if (equipmentPanel.activeSelf)
        {
            // Solicita estado atual do servidor (opcional)
            // NetworkManager.Instance?.SendRequestEquipment();
        }
    }
}