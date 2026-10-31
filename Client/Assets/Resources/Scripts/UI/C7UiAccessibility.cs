using System.Collections.Generic;
using TMPro;
using UnityEngine;
using UnityEngine.InputSystem;
using UnityEngine.UI;

/// <summary>
/// C7: acessibilidade não-autoritativa. F10 alterna escala de interface
/// 100 / 115 / 130 %, mantendo a mesma proporção em 1280 e 1920 px.
/// Guarda as resoluções originais por CanvasScaler e não escala o mundo 2D.
/// </summary>
public sealed class C7UiAccessibility : MonoBehaviour
{
    private static readonly float[] Scales = { 1f, 1.15f, 1.30f };
    private const string PrefKey = "ZagoQuest.C7.UiScaleIndex";
    private readonly Dictionary<CanvasScaler, Vector2> baselines = new();
    private int current;

    private void Start()
    {
        current = Mathf.Clamp(PlayerPrefs.GetInt(PrefKey, 0), 0, Scales.Length - 1);
        Apply();
    }

    private void Update()
    {
        if (Keyboard.current == null || !Keyboard.current.f10Key.wasPressedThisFrame ||
            ChatUI.IsChatActive) return;
        var currentSelection = UnityEngine.EventSystems.EventSystem.current != null
            ? UnityEngine.EventSystems.EventSystem.current.currentSelectedGameObject : null;
        if (currentSelection != null &&
            currentSelection.GetComponentInParent<TMP_InputField>() != null) return;
        current = (current + 1) % Scales.Length;
        PlayerPrefs.SetInt(PrefKey, current);
        Apply();
        ChatUI.Instance?.AddMessage($"Interface: {Mathf.RoundToInt(Scales[current] * 100)}% (F10).");
    }

    private void Apply()
    {
        // Só altera Canvas UI; o render do mundo e colisões permanecem iguais.
        var scalers = FindObjectsByType<CanvasScaler>(
            FindObjectsInactive.Include, FindObjectsSortMode.None);
        foreach (var scaler in scalers)
        {
            if (scaler == null || scaler.uiScaleMode != CanvasScaler.ScaleMode.ScaleWithScreenSize)
                continue;
            if (!baselines.TryGetValue(scaler, out Vector2 initial))
            {
                initial = scaler.referenceResolution;
                baselines[scaler] = initial;
            }
            scaler.referenceResolution = initial / Scales[current];
            scaler.matchWidthOrHeight = 0.5f;
        }
    }

    private void OnDestroy()
    {
        // Não desfazer prefs. OnPlay restart recria todos os CanvasScaler.
        baselines.Clear();
    }
}
