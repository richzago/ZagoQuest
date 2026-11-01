using UnityEngine;

/// <summary>
/// U03-A: seleciona, via Inspector, a moldura visual usada pelas colunas
/// laterais EXISTENTES do C10. Nao cria novas Bags, equipamentos, Canvas,
/// cameras ou mensagens de rede. Opt-in na scenebasic (off por padrao).
/// </summary>
[DisallowMultipleComponent]
public sealed class U03DockColumnConfig : MonoBehaviour
{
    public static U03DockColumnConfig Current { get; private set; }

    [Header("U03 - colunas editoraveis")]
    [SerializeField] private bool useAuthoredColumns;
    [SerializeField] private GameObject dockColumnPrefab;

    public bool UseAuthoredColumns => useAuthoredColumns && dockColumnPrefab != null;
    public GameObject DockColumnPrefab => dockColumnPrefab;

    private void OnEnable()
    {
        if (Current != null && Current != this)
        {
            Debug.LogWarning("[U03] Mais de uma configuracao de dock. " +
                "A primeira sera preservada.");
            return;
        }
        Current = this;
    }

    private void OnDisable()
    {
        if (Current == this) Current = null;
    }
}
