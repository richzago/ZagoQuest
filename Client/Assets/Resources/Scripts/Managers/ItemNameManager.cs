using UnityEngine;
using TMPro;
using System.Collections.Generic;

/// <summary>
/// Gerencia a exibição de nomes de itens no chão usando UI (Screen Space).
/// Cada item no chão tem um texto correspondente na tela.
/// </summary>
public class ItemNameManager : MonoBehaviour
{
    public static ItemNameManager Instance { get; private set; }

    [Header("Prefab")]
    [Tooltip("Prefab do texto do item (deve ter um componente TextMeshProUGUI).")]
    public GameObject itemNamePrefab;

    private Dictionary<string, TextMeshProUGUI> activeTexts = new Dictionary<string, TextMeshProUGUI>();

    void Awake()
    {
        if (Instance == null) Instance = this;
        else Destroy(gameObject);
    }

    /// <summary>
    /// Cria ou atualiza um texto de item na tela.
    /// </summary>
    /// <param name="id">ID único do item no chão (UUID).</param>
    /// <param name="displayName">Nome do item (ex: "Bone Armor x1").</param>
    /// <param name="worldPosition">Posição do item no mundo.</param>
    public void ShowItemName(string id, string displayName, Vector3 worldPosition)
    {
        // Se já existe, apenas atualiza o texto e a posição
        if (activeTexts.TryGetValue(id, out TextMeshProUGUI text))
        {
            text.text = displayName;
            UpdateTextPosition(text, worldPosition);
            return;
        }

        // Cria um novo texto
        if (itemNamePrefab == null)
        {
            Debug.LogError("[ItemNameManager] itemNamePrefab não atribuído!");
            return;
        }

        GameObject go = Instantiate(itemNamePrefab, transform);
        TextMeshProUGUI newText = go.GetComponent<TextMeshProUGUI>();
        if (newText == null)
        {
            Debug.LogError("[ItemNameManager] O prefab não tem um componente TextMeshProUGUI!");
            Destroy(go);
            return;
        }

        newText.text = displayName;
        activeTexts[id] = newText;
        UpdateTextPosition(newText, worldPosition);
    }

    /// <summary>
    /// Atualiza a posição do texto na tela (se o item se mover).
    /// </summary>
    public void UpdateItemPosition(string id, Vector3 worldPosition)
    {
        if (activeTexts.TryGetValue(id, out TextMeshProUGUI text))
        {
            UpdateTextPosition(text, worldPosition);
        }
    }

    /// <summary>
    /// Remove o texto de um item.
    /// </summary>
    public void HideItemName(string id)
    {
        if (activeTexts.TryGetValue(id, out TextMeshProUGUI text))
        {
            Destroy(text.gameObject);
            activeTexts.Remove(id);
        }
    }

    /// <summary>
    /// Converte uma posição do mundo para a tela e aplica ao texto.
    /// </summary>
    private void UpdateTextPosition(TextMeshProUGUI text, Vector3 worldPosition)
    {
        if (Camera.main == null) return;
        Vector3 screenPos = Camera.main.WorldToScreenPoint(worldPosition + Vector3.up * 0.6f);
        text.transform.position = screenPos;
    }

    void LateUpdate()
    {
        // Atualiza posições a cada frame (caso os itens se movam)
        // Usamos o EntityManager para obter a posição atual de cada item
        foreach (var kvp in activeTexts)
        {
            GameObject itemGo = EntityManager.Instance?.GetGameObject(kvp.Key);
            if (itemGo != null)
            {
                UpdateTextPosition(kvp.Value, itemGo.transform.position);
            }
        }
    }
}