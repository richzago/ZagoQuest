using TMPro;
using UnityEngine;
using UnityEngine.UI;

/// <summary>
/// C0: tema cosmético para a HUD 2D, sem substituir referências ou lógica de gameplay.
/// Aplica também nos painéis inicialmente inativos (loja, banco, loot, inventário).
/// Pode ser desativado pelo Inspector em tempo de execução.
/// </summary>
[DisallowMultipleComponent]
public sealed class ZagoQuestUiTheme : MonoBehaviour
{
    [Header("Visual da interface — sem mudanças de gameplay")]
    [SerializeField] private bool applyThemeAtRuntime = true;

    private static readonly Color Panel = new Color32(19, 27, 38, 244);
    private static readonly Color PanelSoft = new Color32(23, 33, 47, 227);
    private static readonly Color InnerPanel = new Color32(14, 22, 33, 217);
    private static readonly Color Border = new Color32(173, 136, 74, 190);
    private static readonly Color Text = new Color32(233, 229, 218, 255);
    private static readonly Color Gold = new Color32(235, 191, 109, 255);

    private void Start()
    {
        if (applyThemeAtRuntime)
            ApplyTheme();
    }

    [ContextMenu("Aplicar tema à HUD agora")]
    public void ApplyTheme()
    {
        // Apenas a árvore da HUD, nunca sprites do mapa ou World/UI de terceiros.
        foreach (var image in GetComponentsInChildren<Image>(true))
        {
            switch (image.gameObject.name)
            {
                case "StatusPanel":
                case "InventoryPanel":
                case "EquipmentPanel":
                case "BankPanel":
                case "ShopPanel":
                case "ChatPanel":
                    image.color = Panel;
                    AddBorder(image);
                    break;
                case "PanelVisual": // fundo efetivo da janela de loot; LootPanel é transparente.
                    image.color = PanelSoft;
                    AddBorder(image);
                    break;
                case "ChatScrollView":
                    image.color = InnerPanel;
                    break;
            }
        }

        foreach (var button in GetComponentsInChildren<Button>(true))
        {
            if (button.transition != Selectable.Transition.ColorTint)
                continue;

            ColorBlock colors = button.colors;
            colors.normalColor = new Color32(49, 65, 80, 255);
            colors.highlightedColor = new Color32(82, 107, 119, 255);
            colors.pressedColor = new Color32(154, 116, 62, 255);
            colors.selectedColor = new Color32(91, 110, 119, 255);
            colors.disabledColor = new Color32(54, 60, 66, 135);
            colors.colorMultiplier = 1f;
            colors.fadeDuration = 0.12f;
            button.colors = colors;
        }

        foreach (var label in GetComponentsInChildren<TextMeshProUGUI>(true))
        {
            string name = label.gameObject.name;
            label.color = name == "PlayerName" || name == "GoldText" ||
                          name == "BankGoldText" ? Gold : Text;
        }

        foreach (var field in GetComponentsInChildren<TMP_InputField>(true))
        {
            if (field.textComponent != null)
                field.textComponent.color = Text;
            if (field.placeholder != null)
                field.placeholder.color = new Color32(151, 160, 166, 255);
        }

        foreach (var slider in GetComponentsInChildren<Slider>(true))
        {
            if (slider.fillRect == null) continue;

            var fill = slider.fillRect.GetComponent<Image>();
            if (fill == null) continue;

            switch (slider.gameObject.name)
            {
                case "HPSlider":
                    fill.color = new Color32(189, 69, 65, 255);
                    break;
                case "ManaSlider":
                    fill.color = new Color32(73, 138, 205, 255);
                    break;
                case "ExperienceSlider":
                    fill.color = Gold;
                    break;
            }
        }
    }

    private static void AddBorder(Image image)
    {
        // Não instala listeners, animações ou novos objetos na Hierarchy.
        var outline = image.GetComponent<Outline>();
        if (outline == null)
            outline = image.gameObject.AddComponent<Outline>();
        outline.effectColor = Border;
        outline.effectDistance = new Vector2(1.4f, -1.4f);
        outline.useGraphicAlpha = true;
    }
}
