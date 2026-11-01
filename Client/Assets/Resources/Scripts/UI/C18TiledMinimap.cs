using UnityEngine;
using UnityEngine.UI;

/// <summary>
/// C18 — minimapa real do JSON Tiled já usado pelo cliente e pelo Node.
/// Atualiza apenas quando o servidor confirma outra célula do jogador.
/// Não transmite localização extra, não decide colisões nem caminho.
/// </summary>
[DisallowMultipleComponent]
public sealed class C18TiledMinimap : MonoBehaviour
{
    private const int Size = 96;
    private const int Radius = 16;
    private Texture2D texture;
    private Sprite sprite;
    private Image image;
    private TiledMap map;
    private TiledLayer ground, collision;
    private Vector2Int lastTile = new Vector2Int(int.MinValue, int.MinValue);
    private Color32[] pixels;
    private float retryAt;

    private void Awake()
    {
        image = GetComponent<Image>();
        pixels = new Color32[Size * Size];
    }

    private void LateUpdate()
    {
        var net = NetworkManager.Instance;
        if (net == null || !net.isConnected) return;
        if (map == null && Time.unscaledTime >= retryAt)
        {
            retryAt = Time.unscaledTime + 1f;
            var renderer = FindAnyObjectByType<TiledMapRenderer>();
            if (renderer == null || renderer.mapJson == null) return;
            try { map = JsonUtility.FromJson<TiledMap>(renderer.mapJson.text); }
            catch (System.Exception e)
            {
                Debug.LogWarning("[Minimap C18] JSON Tiled inválido: " + e.Message);
                return;
            }
            if (map == null || map.width <= 0 || map.height <= 0 ||
                map.layers == null) { map = null; return; }
            ground = map.layers.Find(l => l.name == "Ground" && l.type == "tilelayer");
            collision = map.layers.Find(l => l.name == "Collision" && l.type == "tilelayer");
            if (ground == null || ground.data == null ||
                ground.data.Length != map.width * map.height)
            {
                map = null; return;
            }
            texture = new Texture2D(Size, Size, TextureFormat.RGBA32, false);
            texture.filterMode = FilterMode.Point;
            texture.wrapMode = TextureWrapMode.Clamp;
            sprite = Sprite.Create(texture, new Rect(0,0,Size,Size),
                new Vector2(.5f,.5f), 100f);
            image.sprite = sprite;
            var waiting = transform.Find("MapWaiting");
            if (waiting != null) waiting.gameObject.SetActive(false);
        }
        var player = PlayerController.Instance;
        if (map == null || player == null ||
            !player.TryGetConfirmedGridPosition(out var tile) || tile == lastTile)
            return;
        lastTile = tile;
        Render(tile);
    }

    private void Render(Vector2Int center)
    {
        // Centro = posição do player AUTORIZADA pelo servidor.
        // Dados do terreno vêm do mesmo Tiled JSON usado para renderizar.
        for (int py = 0; py < Size; py++)
        for (int px = 0; px < Size; px++)
        {
            int dx = Mathf.FloorToInt((px - Size / 2f) * (2f * Radius / Size));
            int dy = Mathf.FloorToInt((py - Size / 2f) * (2f * Radius / Size));
            int x = center.x + dx;
            int y = center.y + dy;
            Color32 color = new Color32(12, 21, 30, 255);
            if (x >= 0 && y >= 0 && x < map.width && y < map.height)
            {
                int i = (map.height - 1 - y) * map.width + x;
                int gid = ground.data[i] & 0x1fffffff; // Tiled flip flags
                if (gid != 0)
                {
                    // Tonalidades determinísticas por ID de tile: geometria real,
                    // não imagem de fantasia e sem dependência de textura Readable.
                    byte shade = (byte)(38 + (gid * 31 % 61));
                    color = new Color32((byte)(shade/2+22),
                        (byte)(shade+48), (byte)(shade/2+40), 255);
                }
                if (collision != null && collision.data != null &&
                    i < collision.data.Length && collision.data[i] != 0)
                    color = new Color32(51, 66, 74, 255);
            }
            // Marca visível do jogador no centro do mapa, sem mostrar sua
            // localização em outras regiões.
            if (Mathf.Abs(px - Size / 2) <= 2 &&
                Mathf.Abs(py - Size / 2) <= 2)
                color = new Color32(244, 188, 75, 255);
            pixels[py * Size + px] = color;
        }
        texture.SetPixels32(pixels);
        texture.Apply(false);
    }

    private void OnDestroy()
    {
        if (sprite != null) Destroy(sprite);
        if (texture != null) Destroy(texture);
    }
}
