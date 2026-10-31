using System;
using System.Collections;
using System.Text;
using Newtonsoft.Json.Linq;
using UnityEngine;
using UnityEngine.Networking;

/// <summary>
/// Interface TEMPORÁRIA da Fase 5, para testes em duas instâncias Unity.
/// Adicionar a um GameObject da cena e habilitar requireAuthenticatedSession
/// em NetworkManager. JWT e senha ficam somente na memória, nunca Inspector.
/// </summary>
public class SessionLoginDebugUI : MonoBehaviour
{
    [SerializeField] private string apiUrl = "http://localhost:3000";
    private string email = "";
    private string password = "";
    private string accountId;
    private string token;
    private JArray characters;
    private string status = "Login de teste para sessão autenticada.";
    private bool busy;

    private void OnGUI()
    {
        if (NetworkManager.Instance == null ||
            !NetworkManager.Instance.requireAuthenticatedSession) return;
        GUILayout.BeginArea(new Rect(12, 12, 360, 330), GUI.skin.box);
        GUILayout.Label("ZagoQuest - Sessão autenticada (QA)");

        if (characters == null)
        {
            GUILayout.Label("E-mail");
            email = GUILayout.TextField(email);
            GUILayout.Label("Senha");
            password = GUILayout.PasswordField(password, '*');
            GUI.enabled = !busy;
            if (GUILayout.Button(busy ? "Autenticando..." : "Entrar"))
                StartCoroutine(Login());
            GUI.enabled = true;
        }
        else
        {
            GUILayout.Label("Escolhe um personagem da tua conta:");
            foreach (var entry in characters)
            {
                var id = entry["id"]?.ToString();
                var name = entry["name"]?.ToString();
                if (string.IsNullOrEmpty(id)) continue;
                if (GUILayout.Button(name))
                {
                    NetworkManager.Instance.ConfigureAuthenticatedSession(token, id);
                    status = "Conectando personagem selecionado...";
                }
            }
        }

        // Mensagem da camada WS, inclusive personagem já conectado.
        // O login REST pode ser válido mesmo quando o personagem está online.
        var manager = NetworkManager.Instance;
        if (!string.IsNullOrWhiteSpace(manager.AuthenticationStatusMessage))
            GUILayout.Label(manager.AuthenticationStatusMessage);
        else if (manager.isConnected)
            GUILayout.Label("Personagem conectado.");
        else
            GUILayout.Label(status);
        GUILayout.EndArea();
    }

    private IEnumerator Login()
    {
        busy = true;
        status = "Validando credenciais...";
        var body = new JObject { ["email"] = email, ["password"] = password };
        using (var request = new UnityWebRequest(apiUrl.TrimEnd('/') + "/api/sessions", "POST"))
        {
            request.uploadHandler = new UploadHandlerRaw(Encoding.UTF8.GetBytes(body.ToString()));
            request.downloadHandler = new DownloadHandlerBuffer();
            request.SetRequestHeader("Content-Type", "application/json");
            yield return request.SendWebRequest();
            password = "";
            if (request.result != UnityWebRequest.Result.Success)
            {
                status = "Login recusado ou API indisponível.";
                busy = false;
                yield break;
            }
            try
            {
                var reply = JObject.Parse(request.downloadHandler.text);
                token = reply["token"]?.ToString();
                accountId = reply["accountId"]?.ToString();
            }
            catch (Exception)
            {
                status = "Resposta de login inválida.";
                busy = false;
                yield break;
            }
        }

        if (string.IsNullOrEmpty(token) || string.IsNullOrEmpty(accountId))
        {
            status = "Login sem sessão válida.";
            busy = false;
            yield break;
        }
        using (var request = UnityWebRequest.Get(apiUrl.TrimEnd('/') + "/api/characters/account/" + UnityWebRequest.EscapeURL(accountId)))
        {
            request.SetRequestHeader("Authorization", "Bearer " + token);
            yield return request.SendWebRequest();
            if (request.result != UnityWebRequest.Result.Success)
            {
                status = "Não foi possível listar os personagens da conta.";
                busy = false;
                yield break;
            }
            try
            {
                characters = JArray.Parse(request.downloadHandler.text);
                status = characters.Count == 0 ? "A conta não tem personagens. Cria um na API." :
                    "Seleciona o personagem para abrir o WebSocket.";
            }
            catch (Exception)
            {
                status = "Lista de personagens inválida.";
            }
        }
        busy = false;
    }
}
