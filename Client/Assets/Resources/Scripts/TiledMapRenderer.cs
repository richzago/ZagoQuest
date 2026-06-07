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
        CenterCamera();
    }

    void LoadMap()
    {
        if (mapJson == null)
        {
            Debug.LogError("mapJson não atribuído!");
            return;
        }
        mapData = JsonUtility.FromJson<TiledMap>(mapJson.text);
        if (mapData == null)
        {
            Debug.LogError("Falha ao parsear JSON.");
            return;
        }
        Debug.Log($"Mapa carregado: {mapData.width}x{mapData.height}");
        Debug.Log($"Tilesets no JSON: {mapData.tilesets.Count}");
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
            Debug.LogError($"Tileset vazio: {path}");
            continue;
        }

        foreach (var sprite in sprites)
        {
            // 🔥 pega número final do nome: _0, _1, _2...
            string[] split = sprite.name.Split('_');
            if (!int.TryParse(split[^1], out int index))
            {
                Debug.LogWarning($"Sprite sem índice válido: {sprite.name}");
                continue;
            }

            int gid = tileset.firstgid + index;

            Tile tile = ScriptableObject.CreateInstance<Tile>();
            tile.sprite = sprite;

            tileCache[gid] = tile;
        }

        Debug.Log($"Tileset '{tileset.name}' carregado com segurança");
    }

    Debug.Log($"Cache final: {tileCache.Count}");
}

    // ------------------------------------------------------------
    // Os métodos abaixo permanecem iguais (RenderGround, RenderAllTileLayers, etc.)
    // ------------------------------------------------------------
    void RenderGround()
    {
        if (groundTilemap == null)
        {
            Debug.LogError("groundTilemap não atribuído!");
            return;
        }

        TiledLayer ground = mapData.layers.Find(l => l.type == "tilelayer");
        if (ground == null)
        {
            Debug.LogError("Nenhuma tile layer encontrada!");
            return;
        }

        Debug.Log($"Renderizando chão: layer '{ground.name}'");
        DrawLayer(ground, groundTilemap);
    }

    void RenderAllTileLayers()
    {
        int order = 5;
        foreach (var layer in mapData.layers)
        {
            if (layer.type != "tilelayer") continue;
            if (layer == mapData.layers.Find(l => l.type == "tilelayer")) continue; // já é o chão

            GameObject layerObj = new GameObject($"Tilemap_{layer.name}");
            layerObj.transform.SetParent(this.transform);
            Tilemap tilemap = layerObj.AddComponent<Tilemap>();
            TilemapRenderer renderer = layerObj.AddComponent<TilemapRenderer>();
            renderer.sortingOrder = order++;

            DrawLayer(layer, tilemap);
        }
    }

    void DrawLayer(TiledLayer layer, Tilemap targetTilemap)
    {
        int tilesRendered = 0;
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
                    tilesRendered++;
                }
                else
                {
                    Debug.LogWarning($"GID {gid} não encontrado (layer '{layer.name}')");
                }
            }
        }
        Debug.Log($"Layer '{layer.name}': {tilesRendered} tiles desenhados.");
    }

    void ApplyCollision()
    {
        TiledLayer collision = mapData.layers.Find(l => l.name == "Collision" && l.type == "tilelayer");
        if (collision == null)
        {
            Debug.LogWarning("Camada 'Collision' não encontrada. Tudo caminhável.");
            return;
        }

        bool[,] blocked = new bool[mapData.width, mapData.height];
        for (int y = 0; y < mapData.height; y++)
        {
            for (int x = 0; x < mapData.width; x++)
            {
                int idx = y * mapData.width + x;
                blocked[x, y] = collision.data[idx] != 0;
            }
        }

        if (GameManager.Instance != null)
            GameManager.Instance.SetCollisionMatrix(blocked, mapData.width, mapData.height);
        else
            Debug.LogError("GameManager.Instance não encontrado!");
        Debug.Log("Colisão aplicada.");
    }
    

    void CenterCamera()
    {
        Camera cam = Camera.main;
        if (cam == null) return;
        cam.transform.position = new Vector3(mapData.width / 2f, mapData.height / 2f, -10f);
        cam.orthographicSize = mapData.height / 2f;
    }
}