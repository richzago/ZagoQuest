using UnityEngine;
using UnityEngine.UI;

public class MonsterHealthBar : MonoBehaviour
{
    public Slider hpSlider;

    void Start()
    {
        // Fallback: se o slider ainda não foi criado, chama Initialize automaticamente
        if (hpSlider == null)
            Initialize();
    }

    /// <summary>
    /// Cria a barra de HP se ela não existir.
    /// Deve ser chamada manualmente após adicionar o componente.
    /// </summary>
    public void Initialize()
    {
        if (hpSlider != null) return;

        GameObject sliderObj = new GameObject("HPBar");
        sliderObj.transform.SetParent(transform);
        sliderObj.transform.localPosition = new Vector3(0, 1.2f, 0);

        Canvas canvas = sliderObj.AddComponent<Canvas>();
        canvas.renderMode = RenderMode.WorldSpace;
        canvas.scaleFactor = 0.01f;

        hpSlider = sliderObj.AddComponent<Slider>();
        hpSlider.minValue = 0;
        hpSlider.maxValue = 100;
        hpSlider.value = 100;

        RectTransform rect = hpSlider.GetComponent<RectTransform>();
        rect.sizeDelta = new Vector2(1, 0.2f);
    }

    public void SetMaxHp(int max)
    {
        if (hpSlider != null)
            hpSlider.maxValue = max;
    }

    public void SetHp(int hp)
    {
        if (hpSlider != null)
            hpSlider.value = hp;
    }
}