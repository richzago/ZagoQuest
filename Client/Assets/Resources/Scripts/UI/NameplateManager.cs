using UnityEngine;
using TMPro;
using System.Collections.Generic;

public class NameplateManager : MonoBehaviour
{
    public static NameplateManager Instance { get; private set; }

    [Header("Prefabs")]
    public GameObject nameplatePrefab;
    public GameObject floatingTextPrefab;

    [Header("Cores")]
    public Color playerColor = Color.cyan;
    public Color monsterColor = Color.red;
    public Color npcColor = Color.green;

    private Dictionary<string, GameObject> nameplates = new Dictionary<string, GameObject>();
    private Queue<GameObject> floatingTextPool = new Queue<GameObject>();

    void Awake()
    {
        if (Instance != null && Instance != this)
        {
            Destroy(gameObject);
            return;
        }
        Instance = this;
    }

    void OnDestroy()
    {
        if (Instance == this) Instance = null;
    }

    void Start()
    {
        // Debug.Log("[NameplateManager] Start chamado.");
        if (floatingTextPrefab != null)
        {
            // Debug.Log("[NameplateManager] floatingTextPrefab está atribuído.");
            for (int i = 0; i < 10; i++)
            {
                GameObject ft = Instantiate(floatingTextPrefab, transform);
                ft.SetActive(false);
                floatingTextPool.Enqueue(ft);
            }
            // Debug.Log($"[NameplateManager] Pool criado com {floatingTextPool.Count} itens.");
        }
        else
        {
            Debug.LogError("[NameplateManager] floatingTextPrefab é nulo!");
        }
    }

    // =========================
    // NAMEPLATE PARA MONSTROS
    // =========================
    public GameObject CreateMonsterNameplate(string entityId, Transform target, string name, Color color)
    {
        return CreateNameplate(entityId, target, name, color, "");
    }

    // =========================
    // NAMEPLATE PARA NPCS
    // =========================
    public GameObject CreateNpcNameplate(string entityId, Transform target, string name, string type, Color color)
    {
        return CreateNameplate(entityId, target, name, color, type);
    }

    // =========================
    // NAMEPLATE GENÉRICO
    // =========================
    public GameObject CreateNameplate(string entityId, Transform target, string name, Color color, string type = "")
    {
        if (nameplatePrefab == null)
        {
            Debug.LogError("NameplateManager: nameplatePrefab não atribuído!");
            return null;
        }

        if (nameplates.TryGetValue(entityId, out GameObject existing))
        {
            Destroy(existing);
            nameplates.Remove(entityId);
        }

        GameObject go = Instantiate(nameplatePrefab, transform);
        Nameplate np = go.GetComponent<Nameplate>();
        if (np != null)
        {
            np.SetTarget(target, name, color);
            if (!string.IsNullOrEmpty(type))
            {
                np.SetType(type, new Color(1f, 0.8f, 0.2f));
            }
        }

        nameplates[entityId] = go;
        return go;
    }

    public void RemoveNameplate(string entityId)
    {
        if (nameplates.TryGetValue(entityId, out GameObject go))
        {
            Destroy(go);
            nameplates.Remove(entityId);
        }
    }

    // =========================
    // DANO FLUTUANTE
    // =========================
    public void ShowFloatingText(Vector3 worldPosition, string text, Color color)
    {
        // Debug.Log($"[FLOATING] ShowFloatingText chamado! text={text}, pos={worldPosition}");

        GameObject ft = GetFloatingTextFromPool();
        if (ft == null)
        {
            Debug.LogError("[FLOATING] ft é nulo!");
            return;
        }

        // Debug.Log($"[FLOATING] ft instanciado: {ft.name}");

        Vector3 screenPos = Camera.main.WorldToScreenPoint(worldPosition + Vector3.up * 0.5f);
        ft.transform.position = screenPos;
        ft.SetActive(true);
        // Debug.Log($"[FLOATING] ft ativo? {ft.activeSelf}, pos: {ft.transform.position}, scale: {ft.transform.localScale}");

        FloatingText ftScript = ft.GetComponent<FloatingText>();
        if (ftScript != null)
        {
            ftScript.SetText(text, color);
            ftScript.StopAllCoroutines();
            ftScript.StartCoroutine(ftScript.Animate());
            // Debug.Log("[FLOATING] Animação iniciada.");
        }
        else
        {
            Debug.LogError("[FLOATING] ftScript é nulo!");
        }

        if (Camera.main == null)
        {
            Debug.LogError("[FLOATING] Camera.main é nulo!");
            return;
        }

        // Debug.Log($"[FLOATING] worldPos: {worldPosition}, screenPos: {screenPos}, Screen.width: {Screen.width}, Screen.height: {Screen.height}");
    }

    // =========================
    // POOL DE FLOATING TEXT
    // =========================
    private GameObject GetFloatingTextFromPool()
    {
        if (floatingTextPool.Count > 0)
        {
            // Debug.Log($"[FLOATING] Pool tem {floatingTextPool.Count} itens.");
            return floatingTextPool.Dequeue();
        }
        else
        {
            Debug.LogWarning("[FLOATING] Pool vazio. Criando nova instância.");
            if (floatingTextPrefab == null)
            {
                Debug.LogError("[FLOATING] floatingTextPrefab é nulo!");
                return null;
            }
            return Instantiate(floatingTextPrefab, transform);
        }
    }

    public void ReturnFloatingText(GameObject ft)
    {
        ft.SetActive(false);
        floatingTextPool.Enqueue(ft);
    }

    public void UpdateNameplatePosition(string entityId, Vector3 position)
    {
        // O Nameplate já se atualiza via LateUpdate
    }
}