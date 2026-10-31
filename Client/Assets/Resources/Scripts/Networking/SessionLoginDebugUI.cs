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

    // Ícone compacto no rodapé direito. Não conflita com Status (esquerda)
    // nem com o espaço reservado para o minimapa (canto superior direito).
    private void OnGUI()
    {
        var network = NetworkManager.Instance;
        if (network == null || !network.requireAuthenticatedSession) return;

        if (network.isConnected)
        {
            // Nada de caixa de login após autenticar. Apenas Logout visível.
            var oldBackground = GUI.backgroundColor;
            var oldContent = GUI.contentColor;
            GUI.backgroundColor = new Color(0.18f, 0.25f, 0.33f, 1f);
            GUI.contentColor = new Color(0.98f, 0.82f, 0.57f, 1f);
            var style = new GUIStyle(GUI.skin.button)
            {
                fontSize = 25,
                fontStyle = FontStyle.Bold,
                alignment = TextAnchor.MiddleCenter
            };
            if (GUI.Button(new Rect(Screen.width - 66, Screen.height - 66, 48, 48),
                new GUIContent("⏻", "Sair da sessão"), style))
            {
                Logout();
            }
            GUI.backgroundColor = oldBackground;
            GUI.contentColor = oldContent;
            if (!string.IsNullOrEmpty(GUI.tooltip))
                GUI.Label(new Rect(Screen.width - 180, Screen.height - 90, 150, 24),
                    GUI.tooltip);
            return;
        }

        // Tela de entrada compacta só aparece fora da sessão autenticada.
        GUILayout.BeginArea(new Rect(16, 16, 366, 335), GUI.skin.box);
        var title = new GUIStyle(GUI.skin.label) { fontSize = 18, fontStyle = FontStyle.Bold };
        GUILayout.Label("ZAGOQUEST  |  ENTRAR", title);
        GUILayout.Space(6);

        if (characters == null)
        {
            GUILayout.Label("E-mail");
            email = GUILayout.TextField(email);
            GUILayout.Label("Senha");
            password = GUILayout.PasswordField(password, '*');
            GUI.enabled = !busy;
            if (GUILayout.Button(busy ? "Autenticando..." : "Entrar", GUILayout.Height(36)))
                StartCoroutine(Login());
            GUI.enabled = true;
        }
        else
        {
            GUILayout.Label("Escolha o personagem:");
            foreach (var entry in characters)
            {
                var id = entry["id"]?.ToString();
                var name = entry["name"]?.ToString();
                if (string.IsNullOrEmpty(id)) continue;
                if (GUILayout.Button(name, GUILayout.Height(34)))
                {
                    network.ConfigureAuthenticatedSession(token, id);
                    status = "Conectando personagem selecionado...";
                }
            }
        }

        GUILayout.Space(8);
        if (!string.IsNullOrWhiteSpace(network.AuthenticationStatusMessage))
            GUILayout.Label(network.AuthenticationStatusMessage);
        else
            GUILayout.Label(status);
        GUILayout.EndArea();
    }

    private void Logout()
    {
        var network = NetworkManager.Instance;
        if (network == null || !network.isConnected) return;
        // Não reter JWT, lista de personagens nem dados de login no painel.
        email = "";
        password = "";
        accountId = null;
        token = null;
        characters = null;
        busy = false;
        status = "Sessão encerrada. Faça login para voltar.";
        _ = network.LogoutAuthenticatedSession();
        StatusManager.Instance?.ClosePanel();
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
