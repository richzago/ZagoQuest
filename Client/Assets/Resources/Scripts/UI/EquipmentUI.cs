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
        foreach (Transform child in slotsContainer)
        {
            var slotUI = child.GetComponent<EquipmentSlotUI>();
            if (slotUI != null)
                slotMap[slotUI.slotType] = slotUI;
        }
    }

    /// <summary>
    /// Atualiza todos os slots com base no dicionário de equipamentos.
    /// </summary>
    public void UpdateEquipment(Dictionary<EquipmentSlot, string> equipment)
    {
        if (equipment == null) return;
        foreach (var kvp in equipment)
        {
            if (slotMap.TryGetValue(kvp.Key, out var slotUI))
                slotUI.SetItem(kvp.Value);
        }
    }

    public void TogglePanel() => equipmentPanel.SetActive(!equipmentPanel.activeSelf);
}