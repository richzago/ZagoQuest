using UnityEngine;
using TMPro;
using System.Collections;

public class FloatingText : MonoBehaviour
{
    [Header("Configurações")]
    public float lifetime = 1.5f;
    public float floatSpeed = 2f;
    public float fadeSpeed = 2f;

    private TextMeshProUGUI textComponent;
    private Color originalColor;

    void Awake()
    {
        textComponent = GetComponent<TextMeshProUGUI>();
        if (textComponent == null)
            textComponent = GetComponentInChildren<TextMeshProUGUI>();

        if (textComponent != null)
            originalColor = textComponent.color;
    }

    void OnEnable()
    {
        StartCoroutine(Animate());
    }

    public IEnumerator Animate()

    {
        // Debug.Log("[FLOATING] Animate iniciado!");

        float elapsed = 0f;
        Vector3 startPos = transform.position;
        Color color = originalColor;

        while (elapsed < lifetime)
        {
            elapsed += Time.deltaTime;

            // Sobe
            transform.position = startPos + Vector3.up * (elapsed * floatSpeed);

            // Desaparece
            float alpha = 1f - (elapsed / lifetime);
            if (textComponent != null)
            {
                color.a = alpha;
                textComponent.color = color;
            }

            yield return null;
        }

        // Destroi após terminar
        Destroy(gameObject);
    }

    /// <summary>
    /// Define o texto e a cor do dano flutuante.
    /// </summary>
    public void SetText(string text, Color color)
    {
        // Debug.Log($"[FLOATING] SetText: text='{text}', color={color}, textComponent={textComponent != null}");
        if (textComponent != null)
        {
            textComponent.text = text;
            textComponent.color = color;
            originalColor = color;
        }
    }

    /// <summary>
    /// Define o texto com cor padrão (vermelho para dano, verde para cura, amarelo para XP).
    /// </summary>
    public void SetDamage(int amount)
    {
        SetText($"-{amount}", Color.red);
    }

    public void SetHeal(int amount)
    {
        SetText($"+{amount}", Color.green);
    }

    public void SetXP(int amount)
    {
        SetText($"+{amount} XP", Color.yellow);
    }
}