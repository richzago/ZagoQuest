// Assets/Resources/Scripts/Core/GameManager.cs
using UnityEngine;
using System.Collections.Generic;

public class GameManager : MonoBehaviour
{
    public static GameManager Instance;

    // 🔥 NOVO: Armazenar os stats do jogador
    public PlayerStatsData PlayerStats { get; set; }

    private bool[,] collisionMatrix;
    private int mapWidth;
    private int mapHeight;

    // Direções para pathfinding (4 direções)
    private readonly Vector2Int[] neighbors = new Vector2Int[]
    {
        Vector2Int.up, Vector2Int.down, Vector2Int.left, Vector2Int.right
    };

    void Awake()
    {
        if (Instance == null)
            Instance = this;
        else
            Destroy(gameObject);
    }

    public void SetCollisionMatrix(bool[,] matrix, int width, int height)
    {
        collisionMatrix = matrix;
        mapWidth = width;
        mapHeight = height;
    }

    public bool IsTileWalkable(int x, int y)
    {
        if (x < 0 || y < 0 || x >= mapWidth || y >= mapHeight)
            return false;
        return !collisionMatrix[x, y];
    }

    public List<Vector2Int> FindPath(Vector2Int start, Vector2Int target)
    {
        if (!IsTileWalkable(target.x, target.y)) return null;

        Queue<Vector2Int> queue = new Queue<Vector2Int>();
        Dictionary<Vector2Int, Vector2Int> cameFrom = new Dictionary<Vector2Int, Vector2Int>();
        queue.Enqueue(start);
        cameFrom[start] = start;

        while (queue.Count > 0)
        {
            Vector2Int current = queue.Dequeue();
            if (current == target)
            {
                List<Vector2Int> path = new List<Vector2Int>();
                while (current != start)
                {
                    path.Add(current);
                    current = cameFrom[current];
                }
                path.Reverse();
                return path;
            }
            foreach (Vector2Int dir in neighbors)
            {
                Vector2Int next = current + dir;
                if (IsTileWalkable(next.x, next.y) && !cameFrom.ContainsKey(next))
                {
                    queue.Enqueue(next);
                    cameFrom[next] = current;
                }
            }
        }
        return null;
    }
}