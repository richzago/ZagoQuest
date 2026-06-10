using UnityEngine;
using UnityEngine.EventSystems;

/// <summary>
/// Permite interagir com um NPC clicando nele com o mouse.
/// Envia o comando "/hi" para o servidor via NetworkManager.
/// </summary>
public class ClickInteract : MonoBehaviour, IPointerClickHandler
{
    public void OnPointerClick(PointerEventData eventData)
    {
        // Envia o comando de interação via WebSocket
        NetworkManager.Instance.SendChat("/hi");
        Debug.Log($"Interagiu com {gameObject.name}");
    }
}