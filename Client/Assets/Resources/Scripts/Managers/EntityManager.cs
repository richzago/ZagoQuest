using System.Collections.Generic;
using UnityEngine;
using TMPro;

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
    public GameObject itemOnGroundPrefab;

    [Header("UI Prefabs")]
    public GameObject monsterUIPrefab;

    void Awake()
    {
        if (Instance == null) Instance = this;
        else Destroy(gameObject);

        prefabMap["goblin"] = (goblinPrefab, true);
        prefabMap["merchant"] = (merchantPrefab, false);
        prefabMap["banker"] = (bankerPrefab, false);
    }

    /// <summary>
    /// Outros jogadores são avatares de rede: não têm PlayerController, câmera
    /// nem InputActions. Apenas recebem spawns/moves/despawns do servidor.
    /// </summary>
    public void SpawnRemotePlayer(string id, string name, float x, float y)
    {
        if (string.IsNullOrEmpty(id) || string.IsNullOrEmpty(name)) return;
        if (id == NetworkManager.Instance?.LocalPlayerId) return;
        if (entities.ContainsKey(id)) return;

        // Reutiliza somente o visual do jogador local, SEM clonar seu
        // GameObject (o clone receberia InputActions e controlaria outro avatar).
        var local = PlayerController.Instance?.GetComponent<SpriteRenderer>();
        Sprite sprite = local != null ? local.sprite : null;
        if (sprite == null)
        {
            var sprites = Resources.LoadAll<Sprite>("Tilesets/player_human_01");
            if (sprites.Length > 0) sprite = sprites[0];
        }
        if (sprite == null)
        {
            Debug.LogError("[MULTIPLAYER] Sprite de jogador ausente para avatar remoto.");
            return;
        }

        var go = new GameObject("RemotePlayer_" + name);
        go.transform.position = new Vector3(x, y, 0);
        go.transform.localScale = PlayerController.Instance != null
            ? PlayerController.Instance.transform.localScale : Vector3.one;
        var renderer = go.AddComponent<SpriteRenderer>();
        renderer.sprite = sprite;
        renderer.sortingOrder = local != null ? local.sortingOrder - 1 : 99;
        if (local != null)
        {
            renderer.sortingLayerID = local.sortingLayerID;
            renderer.sharedMaterial = local.sharedMaterial;
        }
        var identity = go.AddComponent<EntityIdentity>();
        identity.entityId = id;
        entities[id] = go;
        var nameplates = NameplateManager.Instance;
        if (nameplates != null)
            nameplates.CreateNameplate(id, go.transform, name, nameplates.playerColor);
        Debug.Log($"[MULTIPLAYER] Jogador remoto criado: {name} ({id}).");
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
            // Atualiza a posição do texto do item na tela (se for um item no chão)
            if (ItemNameManager.Instance != null)
            {
                ItemNameManager.Instance.UpdateItemPosition(id, go.transform.position);
            }
        }
    }

    /// <summary>
    /// Limpa somente entidades recebidas do servidor antigo para não manter
    /// NPCs e monstros duplicados depois da reconexão. Não remove UI da cena.
    /// </summary>
    public void ClearNetworkEntities()
    {
        if (entities.Count == 0) return;
        TargetSelector.Instance?.ClearTarget();
        foreach (var pair in entities)
        {
            NameplateManager.Instance?.RemoveNameplate(pair.Key);
            ItemNameManager.Instance?.HideItemName(pair.Key);
            if (pair.Value != null) Destroy(pair.Value);
        }
        entities.Clear();
        Debug.Log("[EntityManager] Entidades da conexão anterior limpas.");
    }

    public void DespawnEntity(string id)
    {
        Debug.Log($"[EntityManager] DespawnEntity chamado para ID {id}. Existe? {entities.ContainsKey(id)}");
        if (entities.TryGetValue(id, out GameObject go))
        {
            Debug.Log($"[EntityManager] Removendo entidade {go.name}");
            NameplateManager.Instance?.RemoveNameplate(id);
            // 🔥 Remove o texto do item na tela (se for item no chão)
            ItemNameManager.Instance?.HideItemName(id);

            if (TargetSelector.Instance != null)
                TargetSelector.Instance.ClearTargetIfMatches(go);

            Destroy(go);
            entities.Remove(id);
            Debug.Log($"[EntityManager] Entidade removida. Total: {entities.Count}");
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

    // =========================
    // SPAWN DE ITEM NO CHÃO
    // =========================

    public void SpawnItemOnGround(string id, string itemId, string name, float x, float y, int amount)
    {
        // 1. VALIDA ID
        if (string.IsNullOrEmpty(id))
        {
            Debug.LogError($"[SpawnItem] ❌ ID inválido para item no chão");
            return;
        }

        // 2. VERIFICA SE JÁ EXISTE
        if (entities.ContainsKey(id))
        {
            Debug.LogWarning($"[SpawnItem] ⚠️ Item com ID {id} já existe, ignorando.");
            return;
        }

        Vector3 pos = new Vector3(x, y, 0);
        Debug.Log($"[SpawnItem] 📦 Instanciando item '{name}' em posição ({x}, {y})");

        // 3. INSTANCIA O PREFAB
        if (itemOnGroundPrefab == null)
        {
            Debug.LogError("[SpawnItem] ❌ itemOnGroundPrefab é NULL! Atribua no Inspector.");
            return;
        }

        GameObject go = Instantiate(itemOnGroundPrefab, pos, Quaternion.identity);
        entities[id] = go;
        Debug.Log($"[SpawnItem] ✅ GameObject instanciado: {go.name}, posição: {go.transform.position}");

        // 4. CONFIGURA IDENTIDADE
        ItemOnGroundIdentity identity = go.GetComponent<ItemOnGroundIdentity>();
        if (identity == null) identity = go.AddComponent<ItemOnGroundIdentity>();
        identity.groundItemId = id;               // 🔥 UUID do item no chão (para pickup)
        identity.itemId = itemId;
        identity.amount = amount;
        identity.itemName = name;
        Debug.Log($"[SpawnItem] 🏷️ Identidade configurada: groundItemId={id}, itemId={itemId}, amount={amount}, name={name}");

        // 5. VERIFICA SPRITE RENDERER
        SpriteRenderer sr = go.GetComponent<SpriteRenderer>();
        if (sr != null)
        {
            Debug.Log($"[SpawnItem] 🖼️ SpriteRenderer encontrado. Sprite: {(sr.sprite != null ? sr.sprite.name : "NULL")}, enabled: {sr.enabled}");
            if (sr.sprite == null)
            {
                Debug.LogWarning("[SpawnItem] ⚠️ SpriteRenderer sem sprite! Atribua um sprite no prefab.");
            }
            else
            {
                sr.enabled = true;
                Debug.Log($"[SpawnItem] ✅ SpriteRenderer ativado. Tamanho do sprite: {sr.sprite.bounds.size}");
            }
        }
        else
        {
            Debug.LogWarning("[SpawnItem] ⚠️ SpriteRenderer não encontrado no prefab! Adicionando um padrão.");
            sr = go.AddComponent<SpriteRenderer>();
            // Cria um sprite placeholder (quadrado branco)
            Texture2D tex = new Texture2D(32, 32);
            for (int i = 0; i < tex.width * tex.height; i++) tex.SetPixel(i % 32, i / 32, Color.white);
            tex.Apply();
            sr.sprite = Sprite.Create(tex, new Rect(0, 0, 32, 32), new Vector2(0.5f, 0.5f), 1);
            sr.enabled = true;
            Debug.Log("[SpawnItem] ✅ SpriteRenderer padrão adicionado.");
        }

        // 6. VERIFICA TEXTMESHPRO (opcional – caso ainda haja texto 3D, mantido para compatibilidade)
        TextMeshPro text3D = go.GetComponentInChildren<TextMeshPro>();
        if (text3D != null)
        {
            string displayName = name;
            if (amount > 1) displayName += $" x{amount}";
            text3D.text = displayName;
            text3D.gameObject.SetActive(true);
            Debug.Log($"[SpawnItem] 📝 TextMeshPro 3D configurado: '{displayName}', pos local: {text3D.transform.localPosition}, escala: {text3D.transform.localScale}");
        }
        else
        {
            // Fallback: tenta encontrar TextMeshProUGUI (UI) – caso exista Canvas
            TextMeshProUGUI textUI = go.GetComponentInChildren<TextMeshProUGUI>();
            if (textUI != null)
            {
                string displayName = name;
                if (amount > 1) displayName += $" x{amount}";
                textUI.text = displayName;
                textUI.gameObject.SetActive(true);
                Debug.Log($"[SpawnItem] 📝 TextMeshProUGUI configurado: '{displayName}'");
            }
        }

        // 7. VERIFICA BOX COLLIDER (para clique)
        BoxCollider2D col = go.GetComponent<BoxCollider2D>();
        if (col == null)
        {
            Debug.LogWarning("[SpawnItem] ⚠️ BoxCollider2D não encontrado! Adicionando.");
            col = go.AddComponent<BoxCollider2D>();
            col.isTrigger = true;
            col.size = new Vector2(0.8f, 0.8f);
            Debug.Log("[SpawnItem] ✅ BoxCollider2D adicionado.");
        }
        else
        {
            Debug.Log($"[SpawnItem] ✅ BoxCollider2D encontrado. isTrigger: {col.isTrigger}, size: {col.size}");
        }

        // 8. VERIFICA TAG
        if (go.tag != "ItemOnGround")
        {
            Debug.LogWarning($"[SpawnItem] ⚠️ Tag do GameObject é '{go.tag}', esperado 'ItemOnGround'. Corrigindo.");
            go.tag = "ItemOnGround";
        }
        Debug.Log($"[SpawnItem] 🏷️ Tag definida: {go.tag}");

        // 9. ATIVA O GAMEOBJECT
        go.SetActive(true);
        Debug.Log($"[SpawnItem] ✅ GameObject ativado. Posição final: {go.transform.position}, ativo: {go.activeSelf}");

        // =========================
        // EXIBE O NOME NA TELA (UI)
        // =========================
        if (ItemNameManager.Instance != null)
        {
            string displayName = name;
            if (amount > 1) displayName += $" x{amount}";
            ItemNameManager.Instance.ShowItemName(id, displayName, pos);
            Debug.Log($"[SpawnItem] 📝 Nome do item exibido na UI: '{displayName}'");
        }
        else
        {
            Debug.LogWarning("[SpawnItem] ⚠️ ItemNameManager não encontrado! Nomes não serão exibidos.");
        }

        // 10. LOG FINAL
        Debug.Log($"[SpawnItem] 🎯 Item no chão: {name} x{amount} em ({x}, {y})");
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