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

    private void Awake()
    {
        if (Instance == null) Instance = this;
        else Destroy(gameObject);
    }

    private void Start()
    {
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

        // 🔥 CORRIGIDO: usar NetworkManager.Instance
        if (NetworkManager.Instance != null)
        {
            NetworkManager.Instance.OnEquipmentUpdate += OnEquipmentUpdate;
            Debug.Log("[EquipmentUI] Inscrito no evento OnEquipmentUpdate via Instance.");
        }
        else
        {
            Debug.LogError("[EquipmentUI] NetworkManager.Instance é null!");
        }
    }

    private void OnDestroy()
    {
        // 🔥 CORRIGIDO: usar NetworkManager.Instance
        if (NetworkManager.Instance != null)
        {
            NetworkManager.Instance.OnEquipmentUpdate -= OnEquipmentUpdate;
        }
    }

    /// <summary>
    /// Recebe a atualização do servidor e repassa para os slots.
    /// </summary>
    private void OnEquipmentUpdate(Dictionary<EquipmentSlot, string> equipment)
    {
        // Debug.Log($"[EquipmentUI] 🔄 Atualização recebida! {equipment?.Count ?? 0} slots.");
        if (equipment == null) return;

        foreach (var kvp in equipment)
        {
            if (slotMap.TryGetValue(kvp.Key, out var slotUI))
            {
                slotUI.SetItem(kvp.Value);
                Debug.Log($"[EquipmentUI] Slot {kvp.Key} atualizado com {kvp.Value ?? "vazio"}");
            }
            else
            {
                Debug.LogWarning($"[EquipmentUI] Slot {kvp.Key} não encontrado no slotMap!");
            }
        }
    }

    // 🔥 Método público para forçar atualização (opcional)
    public void UpdateEquipment(Dictionary<EquipmentSlot, string> equipment)
    {
        OnEquipmentUpdate(equipment);
    }

    public void TogglePanel()
    {
        equipmentPanel.SetActive(!equipmentPanel.activeSelf);
        if (equipmentPanel.activeSelf)
        {
            // Solicita estado atual do servidor (opcional)
            // NetworkManager.Instance?.SendRequestEquipment();
        }
    }
}