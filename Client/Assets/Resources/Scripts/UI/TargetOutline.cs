using UnityEngine;

/// <summary>
/// Borda de seleção ao redor de um alvo (monstro, NPC, etc.).
/// Acompanha o alvo automaticamente e se ajusta ao tamanho do sprite.
/// </summary>
public class TargetOutline : MonoBehaviour
{
    [Header("Aparência")]
    public Color outlineColor = Color.red;
    public float offsetY = 0.2f;
    public float extraMargin = 0.4f;

    private SpriteRenderer spriteRenderer;
    private Transform target;

    void Awake()
    {
        spriteRenderer = GetComponent<SpriteRenderer>();
        if (spriteRenderer == null)
            spriteRenderer = gameObject.AddComponent<SpriteRenderer>();

        spriteRenderer.color = outlineColor;
        spriteRenderer.sortingOrder = 10000;
        gameObject.SetActive(false);
    }

    /// <summary>
    /// Atualiza a posição e escala da borda a cada frame após o movimento.
    /// </summary>
    void LateUpdate()
    {
        if (target == null) return;
        if (!gameObject.activeSelf) return;

        // Posição
        Vector3 pos = target.position + Vector3.up * offsetY;
        pos.z = -1; // Mantém à frente da câmera
        transform.position = pos;

        // Escala (recalcula caso o monstro mude de tamanho – raro, mas seguro)
        Vector2 targetSize = GetTargetSize(target);
        float scaleX = targetSize.x + extraMargin;
        float scaleY = targetSize.y + extraMargin;
        transform.localScale = new Vector3(scaleX, scaleY, 1);

        // Mantém virado para a câmera (billboard)
        if (Camera.main != null)
            transform.forward = Camera.main.transform.forward;
    }

    public void SetTarget(Transform targetTransform)
    {
        target = targetTransform;
        if (target == null)
        {
            Hide();
            return;
        }

        gameObject.SetActive(true);
        // A primeira atualização ocorrerá no LateUpdate seguinte
    }

    private Vector2 GetTargetSize(Transform targetTransform)
    {
        SpriteRenderer sr = targetTransform.GetComponent<SpriteRenderer>();
        if (sr != null && sr.sprite != null)
        {
            Vector2 baseSize = sr.sprite.bounds.size;
            Vector3 scale = targetTransform.lossyScale;
            return new Vector2(baseSize.x * scale.x, baseSize.y * scale.y);
        }

        BoxCollider2D col = targetTransform.GetComponent<BoxCollider2D>();
        if (col != null)
        {
            return col.bounds.size;
        }

        return new Vector2(1.5f, 1.5f);
    }

    public void SetColor(Color color)
    {
        outlineColor = color;
        if (spriteRenderer != null)
            spriteRenderer.color = color;
    }

    public void Show() => gameObject.SetActive(true);
    public void Hide() => gameObject.SetActive(false);
}