using System.Collections.Generic;
using UnityEngine;

public class EntityManager : MonoBehaviour
{
    public static EntityManager Instance { get; private set; }

    private Dictionary<string, GameObject> entities = new Dictionary<string, GameObject>();
    private Dictionary<string, (GameObject prefab, bool isMonster)> prefabMap = new Dictionary<string, (GameObject prefab, bool isMonster)>();

    [Header("Prefabs")]
    public GameObject goblinPrefab;
    public GameObject merchantPrefab;
    public GameObject bankerPrefab;

    void Awake()
    {
        if (Instance == null) Instance = this;
        else Destroy(gameObject);

        prefabMap["goblin"] = (goblinPrefab, true);
        prefabMap["merchant"] = (merchantPrefab, false);
        prefabMap["banker"] = (bankerPrefab, false);
    }

    /// <summary>
    /// Instancia uma entidade (monstro ou NPC) a partir dos dados recebidos do servidor.
    /// </summary>
    public void SpawnEntity(string id, string name, float x, float y, int hp = -1)
    {
        if (string.IsNullOrEmpty(id))
        {
            Debug.LogError($"[Spawn] ID inválido (vazio) para entidade {name}");
            return;
        }

        if (entities.ContainsKey(id))
        {
            Debug.LogWarning($"Entidade {id} já existe, ignorando spawn.");
            return;
        }

        string key = name.ToLower();
        if (!prefabMap.TryGetValue(key, out var entry))
        {
            Debug.LogError($"Prefab não encontrado para entidade '{name}' (ID {id})");
            return;
        }

        GameObject prefab = entry.prefab;
        bool isMonster = entry.isMonster;

        Vector3 pos = new Vector3(x, y, 0);
        GameObject go = Instantiate(prefab, pos, Quaternion.identity);
        entities[id] = go;

        // Remove componentes antigos (caso o prefab os tenha)
        var oldIdentity = go.GetComponent<EntityIdentity>();
        if (oldIdentity != null) Destroy(oldIdentity);
        var oldMonster = go.GetComponent<MonsterIdentity>();
        if (oldMonster != null) Destroy(oldMonster);

        // Adiciona componentes novos com o ID correto
        EntityIdentity identity = go.AddComponent<EntityIdentity>();
        identity.entityId = id;

        if (isMonster)
        {
            MonsterIdentity monsterId = go.AddComponent<MonsterIdentity>();
            monsterId.entityId = id;
            Debug.Log($"[Spawn] Monstro {name} (ID {id})");

            MonsterHealthBar healthBar = go.GetComponentInChildren<MonsterHealthBar>();
            if (healthBar == null)
            {
                healthBar = go.AddComponent<MonsterHealthBar>();
                healthBar.Initialize();
            }
            monsterId.healthBar = healthBar;
            if (hp >= 0)
            {
                healthBar.SetMaxHp(hp);
                healthBar.SetHp(hp);
            }
        }
        else
        {
            Debug.Log($"[Spawn] NPC {name} (ID {id})");
        }
    }

    public void MoveEntity(string id, float x, float y)
    {
        if (entities.TryGetValue(id, out GameObject go))
            go.transform.position = new Vector3(x, y, 0);
    }

    public void DespawnEntity(string id)
    {
        if (entities.TryGetValue(id, out GameObject go))
        {
            // Notifica o TargetSelector para limpar a seleção se for este GameObject
            if (TargetSelector.Instance != null)
                TargetSelector.Instance.ClearTargetIfMatches(go);

            Debug.Log($"[Despawn] Removendo entidade ID {id}");
            Destroy(go);
            entities.Remove(id);
        }
    }

    public void UpdateMonsterHp(string id, int newHp, int maxHp)
    {
        if (entities.TryGetValue(id, out GameObject go))
        {
            MonsterIdentity identity = go.GetComponent<MonsterIdentity>();
            if (identity != null && identity.healthBar != null)
            {
                identity.healthBar.SetMaxHp(maxHp);
                identity.healthBar.SetHp(newHp);
            }
        }
    }

    public GameObject GetGameObject(string id)
    {
        entities.TryGetValue(id, out GameObject go);
        return go;
    }
}