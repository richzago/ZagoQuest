using UnityEngine;
using TMPro;

public class Nameplate : MonoBehaviour
{
    [Header("Configurações")]
    public float offsetY = 1.2f;
    public float scale = 0.01f;

    [Header("Textos")]
    public TextMeshProUGUI nameText;
    public TextMeshProUGUI typeText;

    private Transform target;
    private Camera mainCamera;

    void Awake()
    {
        // Busca os textos se não estiverem atribuídos
        if (nameText == null)
            nameText = GetComponentInChildren<TextMeshProUGUI>();

        if (nameText == null)
        {
            TextMeshProUGUI[] texts = GetComponentsInChildren<TextMeshProUGUI>();
            foreach (var t in texts)
            {
                if (t.gameObject.name == "NameText")
                    nameText = t;
                else if (t.gameObject.name == "TypeText")
                    typeText = t;
            }
        }

        if (typeText == null)
        {
            TextMeshProUGUI[] texts = GetComponentsInChildren<TextMeshProUGUI>();
            if (texts.Length > 1)
                typeText = texts[1];
        }

        // 🔥 NUNCA desative o GameObject raiz ou o typeText aqui.
        // Apenas configure o Canvas.
        mainCamera = Camera.main;

        Canvas canvas = GetComponent<Canvas>();
        if (canvas != null)
        {
            canvas.renderMode = RenderMode.WorldSpace;
            canvas.worldCamera = Camera.main;
            canvas.sortingLayerName = "Default";
            canvas.sortingOrder = 100;
            transform.localScale = Vector3.one * scale;
        }

        // 🔥 O typeText será controlado exclusivamente pelo método SetType.
        // Não o desative aqui para evitar interferências.
    }

    void LateUpdate()
    {
        if (target == null)
        {
            if (transform.parent != null)
                target = transform.parent;
            else
                return;
        }

        Vector3 worldPos = target.position + Vector3.up * offsetY;
        transform.position = worldPos;
        if (mainCamera != null)
            transform.forward = mainCamera.transform.forward;
    }

    public void SetTarget(Transform targetTransform, string name, Color color = default)
    {
        target = targetTransform;
        if (nameText != null)
        {
            nameText.text = name;
            if (color != default) nameText.color = color;
        }
    }

    public void SetType(string type, Color color = default)
    {
        if (typeText != null)
        {
            if (!string.IsNullOrEmpty(type))
            {
                typeText.text = type;
                typeText.color = color != default ? color : new Color(1f, 0.8f, 0.2f);
                typeText.gameObject.SetActive(true);
            }
            else
            {
                // 🔥 Em vez de desativar o GameObject, apenas esconde o texto (tamanho 0 ou cor transparente)
                // Isso evita que o estado do GameObject afete o pai.
                typeText.text = "";
                typeText.color = new Color(0, 0, 0, 0); // transparente
                // Ou use: typeText.gameObject.SetActive(false); – mas isso pode desativar o pai se o GameObject for filho direto.
                // A melhor abordagem: definir texto vazio e cor transparente.
            }
        }
    }

    public void SetColor(Color color)
    {
        if (nameText != null) nameText.color = color;
    }
}