using UnityEngine;

/// <summary>
/// U02: apenas referencias de layout serializadas.
/// Nao cria UI, nao modifica Canvas, input ou gameplay.
/// </summary>
[DisallowMultipleComponent]
public sealed class ZagoQuestUIComposition : MonoBehaviour
{
    [SerializeField] private ZagoQuestUIThemeAsset theme;
    [SerializeField] private RectTransform leftDockRoot;
    [SerializeField] private RectTransform rightDockRoot;
    [SerializeField] private RectTransform centerHudRoot;
    [SerializeField] private RectTransform bottomRoot;
    [SerializeField] private RectTransform modalRoot;
    [SerializeField] private RectTransform tooltipRoot;
    [SerializeField] private RectTransform[] leftColumns;
    [SerializeField] private RectTransform[] rightColumns;

    public void Configure(
        ZagoQuestUIThemeAsset newTheme,
        RectTransform left, RectTransform right, RectTransform center,
        RectTransform bottom, RectTransform modal, RectTransform tooltip,
        RectTransform[] leftSlots, RectTransform[] rightSlots)
    {
        theme = newTheme;
        leftDockRoot = left;
        rightDockRoot = right;
        centerHudRoot = center;
        bottomRoot = bottom;
        modalRoot = modal;
        tooltipRoot = tooltip;
        leftColumns = leftSlots;
        rightColumns = rightSlots;
    }
}
