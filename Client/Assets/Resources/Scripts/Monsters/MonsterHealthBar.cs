using UnityEngine;
using UnityEngine.UI;
using TMPro;

public class MonsterHealthBar : MonoBehaviour
{
    public Slider slider;
    public TextMeshProUGUI hpText;
    public TextMeshProUGUI nameText;

    private Canvas canvas;
    private Transform target;

    void Awake()
    {
        canvas = GetComponent<Canvas>();
        if (canvas != null)
        {
            canvas.renderMode = RenderMode.WorldSpace;
            transform.localScale = Vector3.one * 0.01f;
        }
    }

    void LateUpdate()
    {
        if (Camera.main != null && target != null)
        {
            transform.position = target.position + Vector3.up * 1.2f;
            transform.forward = Camera.main.transform.forward;
        }
    }

    public void SetTarget(Transform targetTransform)
    {
        target = targetTransform;
    }

    public void SetName(string name)
    {
        if (nameText != null) nameText.text = name;
    }

    public void SetMaxHp(int maxHp)
    {
        if (slider != null) slider.maxValue = maxHp;
        UpdateHpText();
    }

    public void SetHp(int hp)
    {
        if (slider != null) slider.value = hp;
        UpdateHpText();
    }

    private void UpdateHpText()
    {
        if (hpText != null && slider != null)
            hpText.text = $"{slider.value}/{slider.maxValue}";
    }
}