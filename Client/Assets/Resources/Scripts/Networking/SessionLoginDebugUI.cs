using System;
using System.Collections;
using System.Text;
using Newtonsoft.Json.Linq;
using UnityEngine;
using UnityEngine.Networking;
using UnityEngine.UI;
using TMPro;

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
    private GameObject logoutOverlay;
    private TextMeshProUGUI authFeedbackLabel;
    private RectTransform logoutButtonRect;
    private TextMeshProUGUI logoutButtonLabel;
    private bool logoutDocked;

    // Ícone compacto no rodapé direito. Não conflita com Status (esquerda)
    // nem com o espaço reservado para o minimapa (canto superior direito).
    private void OnGUI()
    {
        var network = NetworkManager.Instance;
        if (network == null || !network.requireAuthenticatedSession) return;

        // HUD autenticada usa UGUI e texto compatível com o atlas TMP.
        if (network.isConnected || network.HasCredentials) return;

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

    private void Update()
    {
        var network = NetworkManager.Instance;
        bool visible = network != null && network.requireAuthenticatedSession &&
            (network.isConnected || network.HasCredentials);
        if (visible && logoutOverlay == null) BuildLogoutButton();
        if (logoutOverlay != null && logoutOverlay.activeSelf != visible)
            logoutOverlay.SetActive(visible);
        TryDockLogout(network != null && network.isConnected);
        if (authFeedbackLabel != null && network != null)
        {
            bool hasMessage = visible && !network.isConnected &&
                !string.IsNullOrWhiteSpace(network.AuthenticationStatusMessage);
            authFeedbackLabel.gameObject.SetActive(hasMessage);
            if (hasMessage) authFeedbackLabel.text = network.AuthenticationStatusMessage;
        }
    }

    /// <summary>
    /// Canvas superior independente da Hierarchy serializada. O usuário não
    /// precisa criar botão, prefab, imagem nem configurar Inspector.
    /// </summary>
    private void BuildLogoutButton()
    {
        logoutOverlay = new GameObject("C6LogoutOverlay", typeof(RectTransform),
            typeof(Canvas), typeof(CanvasScaler), typeof(GraphicRaycaster));
        var canvas = logoutOverlay.GetComponent<Canvas>();
        canvas.renderMode = RenderMode.ScreenSpaceOverlay;
        canvas.overrideSorting = true;
        canvas.sortingOrder = 500;
        var scaler = logoutOverlay.GetComponent<CanvasScaler>();
        scaler.uiScaleMode = CanvasScaler.ScaleMode.ScaleWithScreenSize;
        scaler.referenceResolution = new Vector2(1920, 1080);

        var go = new GameObject("C6LogoutButton", typeof(RectTransform),
            typeof(Image), typeof(Button));
        go.transform.SetParent(logoutOverlay.transform, false);
        var rt = go.GetComponent<RectTransform>();
        logoutButtonRect = rt;
        rt.anchorMin = rt.anchorMax = rt.pivot = new Vector2(1, 0);
        rt.anchoredPosition = new Vector2(-18, 18);
        rt.sizeDelta = new Vector2(112, 40);
        go.GetComponent<Image>().color = new Color32(38, 51, 66, 245);
        var btn = go.GetComponent<Button>();
        btn.onClick.AddListener(Logout);
        var label = new GameObject("Label", typeof(RectTransform), typeof(TextMeshProUGUI));
        label.transform.SetParent(go.transform, false);
        var text = label.GetComponent<TextMeshProUGUI>();
        logoutButtonLabel = text;
        text.text = "SAIR";
        text.alignment = TextAlignmentOptions.Center;
        text.fontSize = 17;
        text.color = new Color32(237, 195, 117, 255);
        text.raycastTarget = false;
        var labelRt = text.rectTransform;
        labelRt.anchorMin = Vector2.zero;
        labelRt.anchorMax = Vector2.one;
        labelRt.offsetMin = Vector2.zero;
        labelRt.offsetMax = Vector2.zero;
        var feedback = new GameObject("C6AuthenticationFeedback",
            typeof(RectTransform), typeof(TextMeshProUGUI));
        feedback.transform.SetParent(logoutOverlay.transform, false);
        authFeedbackLabel = feedback.GetComponent<TextMeshProUGUI>();
        authFeedbackLabel.fontSize = 15;
        authFeedbackLabel.textWrappingMode = TextWrappingModes.Normal;
        authFeedbackLabel.color = new Color32(239, 199, 135, 255);
        authFeedbackLabel.alignment = TextAlignmentOptions.MidlineRight;
        authFeedbackLabel.raycastTarget = false;
        var feedbackRect = authFeedbackLabel.rectTransform;
        feedbackRect.anchorMin = feedbackRect.anchorMax = new Vector2(1, 0);
        feedbackRect.pivot = new Vector2(1, 0);
        feedbackRect.anchoredPosition = new Vector2(-18, 66);
        feedbackRect.sizeDelta = new Vector2(500, 56);
        authFeedbackLabel.gameObject.SetActive(false);
        FindAnyObjectByType<C7UiAccessibility>()?.ApplyCurrent();
        Debug.Log("[LOGIN] Botão SAIR criado automaticamente em C6LogoutOverlay.");
    }

    private void TryDockLogout(bool connected)
    {
        if (logoutButtonRect == null || logoutOverlay == null) return;
        var sidebar = FindAnyObjectByType<C8SidebarShell>();
        var host = sidebar != null ? sidebar.QuickAccessHost : null;
        if (connected && host != null && host.gameObject.activeInHierarchy)
        {
            if (logoutDocked) return;
            var help = host.Find("HelpIcon");
            if (help != null) help.gameObject.SetActive(false);
            logoutButtonRect.SetParent(host, false);
            // Sexto pictograma. Mantem o Button REAL (mesmo listener Logout).
            logoutButtonRect.anchorMin = new Vector2(5f / 6f + 0.008f, 0f);
            logoutButtonRect.anchorMax = new Vector2(1f - 0.008f, 1f);
            logoutButtonRect.offsetMin = logoutButtonRect.offsetMax = Vector2.zero;
            if (logoutButtonLabel != null)
            {
                logoutButtonLabel.text = "OFF";
                logoutButtonLabel.fontSize = 14f;
            }
            logoutDocked = true;
        }
        else if (logoutDocked)
        {
            logoutButtonRect.SetParent(logoutOverlay.transform, false);
            logoutButtonRect.anchorMin = logoutButtonRect.anchorMax =
                logoutButtonRect.pivot = new Vector2(1f, 0f);
            logoutButtonRect.anchoredPosition = new Vector2(-18, 18);
            logoutButtonRect.sizeDelta = new Vector2(112, 40);
            if (logoutButtonLabel != null)
            {
                logoutButtonLabel.text = "SAIR";
                logoutButtonLabel.fontSize = 17f;
            }
            if (host != null)
            {
                var help = host.Find("HelpIcon");
                if (help != null) help.gameObject.SetActive(true);
            }
            logoutDocked = false;
        }
    }

    private void OnDestroy()
    {
        if (logoutDocked) TryDockLogout(false);
        if (logoutOverlay != null) Destroy(logoutOverlay);
    }

    private void OnDisable()
    {
        if (logoutOverlay != null) logoutOverlay.SetActive(false);
    }

    private void Logout()
    {
        var network = NetworkManager.Instance;
        if (network == null || !network.HasCredentials) return;
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
