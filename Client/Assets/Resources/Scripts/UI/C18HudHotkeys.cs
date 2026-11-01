using UnityEngine;
using UnityEngine.EventSystems;
using UnityEngine.InputSystem;
using TMPro;

/// <summary>
/// C18: atalhos locais configuráveis por PlayerPrefs, sem protocolo novo.
/// Não roubar teclas enquanto Chat/TMP_InputField/Settings estiver com foco.
/// </summary>
[DisallowMultipleComponent]
public sealed class C18HudHotkeys : MonoBehaviour
{
    private const string Prefix = "ZagoQuest.C18.Hotkey.";
    private static readonly Key[] Options = {Key.F6, Key.F7, Key.F8, Key.F9,
        Key.F11, Key.F12, Key.None};
    public static C18HudHotkeys Instance { get; private set; }
    public static Key BagKey => Read("Bag", Key.F6);
    public static Key StatsKey => Read("Stats", Key.F7);
    public static Key LootKey => Read("Loot", Key.F8);
    public static string Caption(Key key) => key == Key.None ? "DESLIGADO" : key.ToString();

    private static Key Read(string name, Key fallback)
    {
        var value = (Key)PlayerPrefs.GetInt(Prefix + name, (int)fallback);
        foreach (var key in Options) if (key == value) return value;
        return fallback;
    }
    public static void Cycle(string name, int direction)
    {
        if (name != "Bag" && name != "Stats" && name != "Loot") return;
        Key current = Read(name, name == "Bag" ? Key.F6 :
            name == "Stats" ? Key.F7 : Key.F8);
        int index = System.Array.IndexOf(Options, current);
        for (int i = 0; i < Options.Length; i++)
        {
            index = (index + direction + Options.Length) % Options.Length;
            Key next = Options[index];
            if (next == Key.None || !Conflicts(name, next))
            {
                PlayerPrefs.SetInt(Prefix + name, (int)next);
                PlayerPrefs.Save();
                return;
            }
        }
    }
    private static bool Conflicts(string name, Key key) =>
        (name != "Bag" && BagKey == key) ||
        (name != "Stats" && StatsKey == key) ||
        (name != "Loot" && LootKey == key);

    private void Awake() { Instance = this; }
    private void OnDestroy() { if (Instance == this) Instance = null; }
    private void Update()
    {
        if (Keyboard.current == null || NetworkManager.Instance == null ||
            !NetworkManager.Instance.isConnected) return;
        if (C10ClientLayoutSettings.Instance != null &&
            C10ClientLayoutSettings.Instance.IsSettingsOpen) return;
        var selected = EventSystem.current != null ?
            EventSystem.current.currentSelectedGameObject : null;
        if (selected != null && selected.GetComponentInParent<TMP_InputField>() != null)
            return;
        var keyboard = Keyboard.current;
        if (BagKey != Key.None && keyboard[BagKey].wasPressedThisFrame)
        {
            var bag = InventoryUI.Instance;
            if (bag != null) bag.ToggleBackpack();
        }
        else if (StatsKey != Key.None && keyboard[StatsKey].wasPressedThisFrame)
            StatusManager.Instance?.TogglePanel();
        else if (LootKey != Key.None && keyboard[LootKey].wasPressedThisFrame)
        {
            // Loot fechado requer escolher cadáver no mundo: não inventar
            // corpseId. Hotkey F8 apenas fecha a janela existente.
            if (LootUI.Instance != null && LootUI.Instance.IsLootOpen)
                LootUI.Instance.CloseLootWindow();
        }
    }
}
