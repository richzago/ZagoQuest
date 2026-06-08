using System.Collections.Generic;
using UnityEngine;

public class EntityManager : MonoBehaviour
{
    public static EntityManager Instance { get; private set; }

    private Dictionary<int, GameObject> entities = new Dictionary<int, GameObject>();

    [Header("Prefabs")]
    public GameObject goblinPrefab;
    public GameObject merchantPrefab;
    public GameObject bankerPrefab;
    void Awake()
    {
        if (Instance == null) Instance = this;
        else Destroy(gameObject);
    }

    public void SpawnEntity(int id, string name, float x, float y, int hp = -1)
    {
        if (entities.ContainsKey(id))
        {
            Debug.LogWarning($"Entidade {id} já existe, ignorando spawn.");
            return;
        }

        string lowerName = name.ToLower();

        GameObject prefab = null;
        switch (lowerName)
        {
            case "goblin":
                prefab = goblinPrefab;
                break;
            case "merchant":
                prefab = merchantPrefab;
                break;
            case "banker":
                prefab = bankerPrefab;
                break;
            default:
                Debug.LogError($"Prefab não encontrado para entidade '{name}' (ID {id})");
                return;
        }

        if (prefab == null)
        {
            Debug.LogError($"Prefab não atribuído no EntityManager para '{name}'");
            return;
        }

        Vector3 pos = new Vector3(x, y, 0);
        GameObject go = Instantiate(prefab, pos, Quaternion.identity);
        entities[id] = go;

        // Garante que o GameObject tenha o componente EntityIdentity
        EntityIdentity identity = go.GetComponent<EntityIdentity>();
        if (identity == null) identity = go.AddComponent<EntityIdentity>();
        identity.entityId = id;

        Debug.Log($"Spawned {name} (ID {id}) at ({x}, {y})");
    }

    public void MoveEntity(int id, float x, float y)
    {
        if (entities.TryGetValue(id, out GameObject go))
            go.transform.position = new Vector3(x, y, 0);
    }

    public void DespawnEntity(int id)
    {
        if (entities.TryGetValue(id, out GameObject go))
        {
            Destroy(go);
            entities.Remove(id);
        }
    }
}