using System.Collections.Generic;
using UnityEngine;

public class EntityManager : MonoBehaviour
{
    public static EntityManager Instance { get; private set; }

    private Dictionary<string, GameObject> entities = new Dictionary<string, GameObject>();
    private Dictionary<string, (GameObject prefab, bool isMonster)> prefabMap = new Dictionary<string, (GameObject prefab, bool isMonster)>();

    [Header("Prefabs de Entidades")]
    public GameObject goblinPrefab;
    public GameObject merchantPrefab;
    public GameObject bankerPrefab;
    public GameObject corpsePrefab;

    [Header("UI Prefabs")]
    public GameObject monsterUIPrefab; // Prefab da UI do monstro (barra de vida + nome)

    void Awake()
    {
        if (Instance == null) Instance = this;
        else Destroy(gameObject);

        prefabMap["goblin"] = (goblinPrefab, true);
        prefabMap["merchant"] = (merchantPrefab, false);
        prefabMap["banker"] = (bankerPrefab, false);
    }

    public void SpawnEntity(string id, string name, float x, float y, int hp = -1, string npcType = "")
    {
        if (string.IsNullOrEmpty(id))
        {
            Debug.LogError($"[Spawn] ID inválido (vazio) para entidade {name}");
            return;
        }

        if (entities.ContainsKey(id)) return;

        string lowerName = name.ToLower();
        Vector3 pos = new Vector3(x, y, 0);
        GameObject go = null;

        // ====================
        // CORPSE
        // ====================
        if (lowerName == "corpse")
        {
            if (corpsePrefab == null)
            {
                Debug.LogError("[Spawn] corpsePrefab não atribuído no EntityManager!");
                return;
            }
            go = Instantiate(corpsePrefab, pos, Quaternion.identity);
            entities[id] = go;
            CorpseIdentity corpseId = go.GetComponent<CorpseIdentity>();
            if (corpseId == null) corpseId = go.AddComponent<CorpseIdentity>();
            corpseId.corpseId = id;
            return;
        }

        // ====================
        // MONSTROS E NPCs
        // ====================
        if (!prefabMap.TryGetValue(lowerName, out var entry))
        {
            Debug.LogError($"Prefab não encontrado para entidade '{name}' (ID {id})");
            return;
        }

        GameObject prefab = entry.prefab;
        bool isMonster = entry.isMonster;

        go = Instantiate(prefab, pos, Quaternion.identity);
        entities[id] = go;

        // Remove componentes antigos (caso o prefab os tenha)
        var oldIdentity = go.GetComponent<EntityIdentity>();
        if (oldIdentity != null) Destroy(oldIdentity);
        var oldMonster = go.GetComponent<MonsterIdentity>();
        if (oldMonster != null) Destroy(oldMonster);

        // Adiciona identidade genérica
        EntityIdentity identity = go.AddComponent<EntityIdentity>();
        identity.entityId = id;

        // ====================
        // MONSTRO
        // ====================
        if (isMonster)
        {
            MonsterIdentity monsterId = go.AddComponent<MonsterIdentity>();
            monsterId.entityId = id;

            // --- Barra de vida e nome (UI) ---
            if (monsterUIPrefab != null)
            {
                GameObject ui = Instantiate(monsterUIPrefab, go.transform);
                MonsterHealthBar healthBar = ui.GetComponent<MonsterHealthBar>();
                if (healthBar != null)
                {
                    healthBar.SetTarget(go.transform);
                    healthBar.SetName(name);
                    if (hp >= 0)
                    {
                        healthBar.SetMaxHp(hp);
                        healthBar.SetHp(hp);
                    }
                    monsterId.healthBar = healthBar;
                }
                else
                {
                    Debug.LogWarning("[EntityManager] MonsterUI prefab não tem o componente MonsterHealthBar!");
                }
            }
            else
            {
                Debug.LogWarning("[EntityManager] monsterUIPrefab não atribuído! Monstros não terão barra de vida.");
            }

            // ❌ REMOVIDO: Nameplate para monstro (para evitar duplicação com a MonsterUI)
            // O nome já é exibido pela MonsterUI, então não precisamos de um nameplate separado.
        }
        // ====================
        // NPC
        // ====================
        else
        {
            NpcIdentity npcIdent = go.GetComponent<NpcIdentity>();
            if (npcIdent == null) npcIdent = go.AddComponent<NpcIdentity>();
            npcIdent.id = id;
            npcIdent.npcId = name.ToLower();

            // --- Nameplate para NPC (nome + tipo) ---
            if (NameplateManager.Instance != null)
            {
                string displayType = GetNpcTypeDisplay(npcType);
                NameplateManager.Instance.CreateNpcNameplate(
                    id,
                    go.transform,
                    name,
                    displayType,
                    NameplateManager.Instance.npcColor
                );
            }
        }
    }

    public void MoveEntity(string id, float x, float y)
    {
        if (entities.TryGetValue(id, out GameObject go))
        {
            go.transform.position = new Vector3(x, y, 0);
            NameplateManager.Instance?.UpdateNameplatePosition(id, go.transform.position);
        }
    }

    public void DespawnEntity(string id)
    {
        // Debug.Log($"[EntityManager] DespawnEntity chamado para ID {id}. Existe? {entities.ContainsKey(id)}");
        if (entities.TryGetValue(id, out GameObject go))
        {
            NameplateManager.Instance?.RemoveNameplate(id);
            if (TargetSelector.Instance != null)
                TargetSelector.Instance.ClearTargetIfMatches(go);
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

    // ====================
    // FUNÇÃO AUXILIAR
    // ====================
    private string GetNpcTypeDisplay(string npcType)
    {
        switch (npcType.ToLower())
        {
            case "merchant": return "Comerciante";
            case "banker": return "Banqueiro";
            case "quest": return "Missão";
            case "trainer": return "Treinador";
            default: return npcType;
        }
    }

    public GameObject GetGameObject(string id)
    {
        entities.TryGetValue(id, out GameObject go);
        return go;
    }
}