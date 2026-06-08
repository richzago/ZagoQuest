using UnityEngine;

public class GameManager : MonoBehaviour
{
    public static GameManager Instance;

    private bool[,] collisionMatrix;
    private int mapWidth;
    private int mapHeight;

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

    private int CountBlocked()
    {
        int count = 0;
        for (int x = 0; x < mapWidth; x++)
        {
            for (int y = 0; y < mapHeight; y++)
            {
                if (collisionMatrix[x, y])
                    count++;
            }
        }
        return count;
    }
}