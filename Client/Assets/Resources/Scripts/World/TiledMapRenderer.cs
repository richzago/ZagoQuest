using System.Collections.Generic;
using System.IO;
using UnityEngine;
using UnityEngine.Tilemaps;

public class TiledMapRenderer : MonoBehaviour
{
    [Header("Referências")]
    public TextAsset mapJson;
    public Tilemap groundTilemap;

    private TiledMap mapData;
    private Dictionary<int, Tile> tileCache = new Dictionary<int, Tile>();

    void Start()
    {
        LoadMap();
        if (mapData == null) return;

        BuildTileCache();
        RenderGround();
        RenderAllTileLayers();
        ApplyCollision();
    }

    void LoadMap()
    {
        if (mapJson == null)
        {
            Debug.LogError("TiledMapRenderer: mapJson não atribuído!");
            return;
        }
        mapData = JsonUtility.FromJson<TiledMap>(mapJson.text);
        if (mapData == null)
        {
            Debug.LogError("TiledMapRenderer: Falha ao parsear JSON.");
            return;
        }
        Debug.Log($"Mapa carregado: {mapData.width}x{mapData.height}");
    }

    void BuildTileCache()
    {
        foreach (var tileset in mapData.tilesets)
        {
            string fileName = Path.GetFileNameWithoutExtension(tileset.image);
            string path = $"Tilesets/{fileName}";

            Sprite[] sprites = Resources.LoadAll<Sprite>(path);

            if (sprites == null || sprites.Length == 0)
            {
                Debug.LogError($"[Tiled][ASSET] Nenhum Sprite importado em Resources/{path}; verifique se o PNG está em Client/Assets/Resources/Tilesets e importado como Sprite (2D and UI), Multiple, com slices *_0, *_1... (tileset firstgid={tileset.firstgid}).");
                continue;
            }

            foreach (var sprite in sprites)
            {
                string[] split = sprite.name.Split('_');
                if (!int.TryParse(split[^1], out int index))
                {
                    continue;
                }

                int gid = tileset.firstgid + index;

                Tile tile = ScriptableObject.CreateInstance<Tile>();
                tile.sprite = sprite;
                tileCache[gid] = tile;
            }
        }
        Debug.Log($"TileCache: {tileCache.Count} tiles carregados.");
    }

    // ------------------------------------------------------------
    // RENDERIZAÇÃO DAS TILE LAYERS
    // ------------------------------------------------------------
    void RenderGround()
    {
        if (groundTilemap == null)
        {
            Debug.LogError("TiledMapRenderer: groundTilemap não atribuído!");
            return;
        }

        TiledLayer ground = mapData.layers.Find(l => l.type == "tilelayer" && l.name == "Ground");
        if (ground == null)
        {
            Debug.LogError("[Tiled] Camada visual 'Ground' não encontrada; confira o mapa exportado.");
            return;
        }

        DrawLayer(ground, groundTilemap);
    }

    void RenderAllTileLayers()
    {
        if (groundTilemap == null || groundTilemap.transform.parent == null)
        {
            Debug.LogError("[Tiled] Ground precisa ser filho de um Grid para alinhar camadas visuais.");
            return;
        }

        // MapManager carrega dados; as camadas visuais pertencem ao mesmo Grid do Ground.
        var groundRenderer = groundTilemap.GetComponent<TilemapRenderer>();
        int order = groundRenderer != null ? groundRenderer.sortingOrder + 1 : 5;
        foreach (var layer in mapData.layers)
        {
            // Collision é dado lógico; Ground já tem Tilemap próprio.
            if (layer.type != "tilelayer" || layer.name == "Collision" || layer.name == "Ground")
                continue;

            if (!HasValidTileData(layer)) continue;
            // Decoration pode estar vazia: não criar Tilemap sem conteúdo.
            if (!System.Array.Exists(layer.data, gid => gid != 0)) continue;

            GameObject layerObj = new GameObject($"Tilemap_{layer.name}");
            layerObj.transform.SetParent(groundTilemap.transform.parent, false);
            layerObj.transform.localPosition = groundTilemap.transform.localPosition;
            layerObj.transform.localRotation = groundTilemap.transform.localRotation;
            layerObj.transform.localScale = groundTilemap.transform.localScale;

            Tilemap tilemap = layerObj.AddComponent<Tilemap>();
            TilemapRenderer renderer = layerObj.AddComponent<TilemapRenderer>();
            if (groundRenderer != null)
                renderer.sortingLayerID = groundRenderer.sortingLayerID;
            renderer.sortingOrder = order++;
            DrawLayer(layer, tilemap);
        }
    }

    private bool HasValidTileData(TiledLayer layer)
    {
        int expected = mapData.width * mapData.height;
        if (layer.data != null && layer.data.Length == expected) return true;
        Debug.LogError($"[Tiled] Camada '{layer.name}' inválida: esperados {expected} GIDs; encontrados {layer.data?.Length ?? 0}.");
        return false;
    }

    void DrawLayer(TiledLayer layer, Tilemap targetTilemap)
    {
        if (!HasValidTileData(layer)) return;
        var missingGids = new HashSet<int>();
        for (int y = 0; y < mapData.height; y++)
        {
            for (int x = 0; x < mapData.width; x++)
            {
                int idx = y * mapData.width + x;
                int gid = layer.data[idx];
                if (gid == 0) continue;

                if (tileCache.TryGetValue(gid, out Tile tile))
                {
                    Vector3Int cell = new Vector3Int(x, mapData.height - 1 - y, 0);
                    targetTilemap.SetTile(cell, tile);
                }
                else
                {
                    missingGids.Add(gid);
                }
            }
        }
        // Uma mensagem por layer (não uma por tile) ao investigar assets ausentes.
        if (missingGids.Count > 0)
            Debug.LogWarning($"[Tiled] Camada '{layer.name}': {missingGids.Count} GIDs distintos sem sprite: {string.Join(", ", missingGids)}.");
    }

    // ------------------------------------------------------------
    // COLISÃO
    // ------------------------------------------------------------
    void ApplyCollision()
    {
        TiledLayer collision = mapData.layers.Find(l => l.name == "Collision" && l.type == "tilelayer");
        if (collision == null)
        {
            Debug.LogWarning("TiledMapRenderer: Camada 'Collision' não encontrada. Tudo caminhável.");
            return;
        }

        if (!HasValidTileData(collision)) return;

        bool[,] blocked = new bool[mapData.width, mapData.height];
        for (int y = 0; y < mapData.height; y++)
        {
            for (int x = 0; x < mapData.width; x++)
            {
                int idx = y * mapData.width + x;
                // Mesma inversão Y do DrawLayer: linha 0 do Tiled é o topo,
                // índice Y do Unity/World cresce para cima.
                blocked[x, mapData.height - 1 - y] = collision.data[idx] != 0;
            }
        }

        if (GameManager.Instance != null)
            GameManager.Instance.SetCollisionMatrix(blocked, mapData.width, mapData.height);
        else
            Debug.LogError("TiledMapRenderer: GameManager.Instance não encontrado!");
    }

#if UNITY_EDITOR
    [Header("C1 - Diagnostico visual (apenas Editor)")]
    [Tooltip("Desenha os 4 limites de agua (vermelho) e chao (verde) no Scene/Game View quando Gizmos estiver ativo.")]
    public bool showC1BorderGizmos = false;

    // Pintar SOMENTE as celulas que formam a fronteira relevante.
    // Nunca muda colisao ou posicoes de entidades.
    private void OnDrawGizmos()
    {
        if (!showC1BorderGizmos || !Application.isPlaying || mapData == null || groundTilemap == null)
            return;
        var collision = mapData.layers.Find(l => l.name == "Collision" && l.type == "tilelayer");
        if (collision == null || collision.data == null || collision.data.Length != mapData.width * mapData.height)
            return;

        for (int y = 0; y < mapData.height; y++)
        {
            for (int x = 0; x < mapData.width; x++)
            {
                // Agua e chao imediatamente adjacentes nas bordas deste mapa.
                bool border = x == 2 || x == 3 || x == mapData.width - 4 || x == mapData.width - 3 ||
                              y == 2 || y == 3 || y == mapData.height - 4 || y == mapData.height - 3;
                if (!border) continue;

                int row = mapData.height - 1 - y;
                bool blocked = collision.data[row * mapData.width + x] != 0;
                Gizmos.color = blocked ? Color.red : Color.green;
                var cell = new Vector3Int(x, y, 0);
                var center = groundTilemap.GetCellCenterWorld(cell);
                // A célula física tem 1x1 unidade neste mapa, também verificada pela cena.
                Gizmos.DrawWireCube(center, new Vector3(0.96f, 0.96f, 0.05f));
            }
        }

        if (PlayerController.Instance != null)
        {
            Gizmos.color = Color.yellow;
            Gizmos.DrawWireSphere(PlayerController.Instance.transform.position, 0.14f);
        }
    }

    [ContextMenu("C1 QA - Registrar alinhamento das bordas no Console")]
    public void LogC1BorderAlignment()
    {
        if (!Application.isPlaying || mapData == null || groundTilemap == null)
        {
            Debug.LogWarning("[C1 QA] Execute em Play Mode com o TiledMapRenderer carregado.");
            return;
        }

        var ground = mapData.layers.Find(l => l.name == "Ground" && l.type == "tilelayer");
        var collision = mapData.layers.Find(l => l.name == "Collision" && l.type == "tilelayer");
        if (ground == null || collision == null || !HasValidTileData(ground) || !HasValidTileData(collision))
            return;

        var player = PlayerController.Instance;
        var playerPos = player != null ? player.transform.position : Vector3.zero;
        var playerCell = new Vector3Int(Mathf.RoundToInt(playerPos.x), Mathf.RoundToInt(playerPos.y), 0);
        var playerVisualCell = groundTilemap.WorldToCell(playerPos);
        Debug.Log($"[C1 QA] Player world={playerPos}; logicalCell={playerCell}; tilemap.WorldToCell={playerVisualCell}; " +
                  $"tilemap.GetCellCenterWorld(logicalCell)={groundTilemap.GetCellCenterWorld(playerCell)}; " +
                  $"Grid origin={groundTilemap.layoutGrid.transform.position}; Tilemap origin={groundTilemap.transform.position}; " +
                  $"TileAnchor={groundTilemap.tileAnchor}.");

        // Ordem: terra / agua imediatamente à esquerda, direita, baixo, cima.
        Vector2Int[] samples = {
            new Vector2Int(3, 10), new Vector2Int(2, 10),
            new Vector2Int(26, 10), new Vector2Int(27, 10),
            new Vector2Int(15, 3), new Vector2Int(15, 2),
            new Vector2Int(15, 16), new Vector2Int(15, 17)
        };
        foreach (var p in samples)
        {
            int index = (mapData.height - 1 - p.y) * mapData.width + p.x;
            int gid = ground.data[index];
            bool blocked = collision.data[index] != 0;
            var cell = new Vector3Int(p.x, p.y, 0);
            var sprite = groundTilemap.GetSprite(cell);
            bool walkableInUnity = GameManager.Instance != null && GameManager.Instance.IsTileWalkable(p.x, p.y);
            Debug.Log($"[C1 QA] XY=({p.x},{p.y}) groundGID={gid} " +
                      $"collisionBlocked={blocked} unityWalkable={walkableInUnity} " +
                      $"renderSprite={(sprite == null ? "<AUSENTE>" : sprite.name)} " +
                      $"renderCenter={groundTilemap.GetCellCenterWorld(cell)}.");
        }
    }
#endif

    // ------------------------------------------------------------
    // SPAWN DE ENTIDADES (NPCs e MONSTROS) - OFFLINE
    // ------------------------------------------------------------
    void SpawnEntitiesFromTiled()
    {
        // ====================
        // 1. Spawn de NPCs (layer NpcSpawn)
        // ====================
        TiledLayer npcLayer = mapData.layers.Find(l => l.name == "NPCSpawn" && l.type == "objectgroup");
        if (npcLayer != null && npcLayer.objects != null)
        {
            foreach (var obj in npcLayer.objects)
            {
                string npcId = obj.properties?.Find(p => p.name == "npcId")?.value;
                if (string.IsNullOrEmpty(npcId))
                {
                    Debug.LogWarning($"TiledMapRenderer: Objeto na layer 'NpcSpawn' sem 'npcId' (ID: {obj.id})");
                    continue;
                }

                float x = obj.x / mapData.tilewidth;
                float y = (mapData.height - 1) - (obj.y / mapData.tileheight);
                Vector3 position = new Vector3(x, y, 0);

                GameObject prefab = Resources.Load<GameObject>($"Prefabs/{npcId}");
                if (prefab == null)
                {
                    Debug.LogWarning($"TiledMapRenderer: Prefab não encontrado para NPC '{npcId}'");
                    continue;
                }

                Instantiate(prefab, position, Quaternion.identity);
            }
        }

        // ====================
        // 2. Spawn de Monstros (layer MonsterSpawn)
        // ====================
        TiledLayer monsterLayer = mapData.layers.Find(l => l.name == "MonsterSpawn" && l.type == "objectgroup");
        if (monsterLayer != null && monsterLayer.objects != null)
        {
            foreach (var obj in monsterLayer.objects)
            {
                string monsterId = obj.properties?.Find(p => p.name == "monsterId")?.value;
                if (string.IsNullOrEmpty(monsterId))
                {
                    Debug.LogWarning($"TiledMapRenderer: Objeto na layer 'MonsterSpawn' sem 'monsterId' (ID: {obj.id})");
                    continue;
                }

                float x = obj.x / mapData.tilewidth;
                float y = (mapData.height - 1) - (obj.y / mapData.tileheight);
                Vector3 position = new Vector3(x, y, 0);

                GameObject prefab = Resources.Load<GameObject>($"Prefabs/{monsterId}");
                if (prefab == null)
                {
                    Debug.LogWarning($"TiledMapRenderer: Prefab não encontrado para monstro '{monsterId}'");
                    continue;
                }

                Instantiate(prefab, position, Quaternion.identity);
            }
        }
    }

    // ------------------------------------------------------------
    // CÂMERA
    // ------------------------------------------------------------
    void CenterCamera()
    {
        Camera cam = Camera.main;
        if (cam == null) return;
        cam.transform.position = new Vector3(mapData.width / 2f, mapData.height / 2f, -10f);
        cam.orthographicSize = mapData.height / 2f;
    }
}