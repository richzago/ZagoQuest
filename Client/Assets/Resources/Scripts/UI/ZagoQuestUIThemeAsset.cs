using TMPro;
using UnityEngine;

/// <summary>
/// U01: tokens cosméticos configuráveis via Inspector.
/// Não altera UI, cenas, PlayerPrefs, servidor ou gameplay ao existir.
/// O tema só é aplicado pelos prefabs/visuais que o referenciarem.
/// </summary>
[CreateAssetMenu(fileName = "ZagoQuestObsidianBronze",
    menuName = "ZagoQuest/UI/Tema Obsidian & Bronze")]
public sealed class ZagoQuestUIThemeAsset : ScriptableObject
{
    [Header("Superficies — Cyleria/Tibia como referencia de composicao, arte original")]
    public Color32 surface = new Color32(16, 19, 24, 248);
    public Color32 recess = new Color32(23, 28, 34, 248);
    public Color32 row = new Color32(34, 40, 43, 250);
    public Color32 bronze = new Color32(180, 133, 69, 255);
    public Color32 bronzeLight = new Color32(208, 170, 108, 255);
    public Color32 bronzeDark = new Color32(84, 63, 42, 245);
    public Color32 cyanAccent = new Color32(108, 165, 172, 255);
    public Color32 text = new Color32(231, 226, 213, 255);
    public Color32 mutedText = new Color32(163, 170, 170, 255);

    [Header("Semantica das barras")]
    public Color32 hp = new Color32(189, 69, 65, 255);
    public Color32 mana = new Color32(73, 138, 205, 255);
    public Color32 experience = new Color32(208, 170, 108, 255);
    public Color32 skillProgress = new Color32(108, 165, 172, 255);

    [Header("Densidade (pontos de referencia em Canvas 1920 x 1080)")]
    [Min(20f)] public float panelHeaderHeight = 27f;
    [Min(1f)] public float panelPadding = 6f;
    [Min(22f)] public float equipmentSlotSize = 38f;
    [Min(16f)] public float utilityIconSize = 23f;
    [Min(16f)] public float skillRowHeight = 23f;
    [Min(1f)] public float progressBarHeight = 5f;
    [Min(8f)] public float panelGap = 8f;

    [Header("Fontes TextMesh Pro (opcionais, adicionar fonte licenciada)")]
    public TMP_FontAsset bodyFont;
    public TMP_FontAsset titleFont;
}
