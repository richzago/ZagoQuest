using TMPro;
using UnityEngine;

public class PlayerHUD : MonoBehaviour
{
    public TextMeshProUGUI playerNameText;
    public TextMeshProUGUI playerHPText;
    public TextMeshProUGUI playerPosText;
    public TextMeshProUGUI fpsText;

    public PlayerController player;

    private float deltaTime = 0.0f;

    void Start()
    {
        if (player == null)
            player = FindAnyObjectByType<PlayerController>();

        if (player != null)
        {
            playerNameText.text = player.gameObject.name;
        }
        else
        {
            playerNameText.text = "Player";
        }
    }

    void Update()
    {
        if (player != null)
        {
            Vector3 pos = player.transform.position;
            playerPosText.text = $"Pos: ({pos.x:F2}, {pos.y:F2})";
        }

        deltaTime += (Time.deltaTime - deltaTime) * 0.1f;
        float fps = 1.0f / deltaTime;
        fpsText.text = $"FPS: {Mathf.Ceil(fps)}";
    }
}