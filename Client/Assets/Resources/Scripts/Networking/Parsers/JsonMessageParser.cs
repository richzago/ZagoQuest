using Newtonsoft.Json;
using Newtonsoft.Json.Linq;
using UnityEngine;

namespace ZagoQuest.Networking.Parser
{
    /// <summary>
    /// Responsável por parsear mensagens JSON recebidas do servidor.
    /// Centraliza validações, tratamento de escapes e conversão para JObject.
    /// </summary>
    public static class JsonMessageParser
    {
        /// <summary>
        /// Parseia uma string JSON bruta e retorna um JObject válido.
        /// </summary>
        /// <param name="rawMessage">String bruta recebida do WebSocket.</param>
        /// <returns>JObject se válido, caso contrário null.</returns>
        public static JObject Parse(string rawMessage)
        {
            if (string.IsNullOrEmpty(rawMessage))
            {
                Debug.LogWarning("[JsonMessageParser] Mensagem vazia ou nula.");
                return null;
            }

            try
            {
                // Remove espaços extras e caracteres de controle
                string cleaned = rawMessage.Trim();

                // 🔥 Se a mensagem veio como string JSON escapada (ex: "{\"type\":...}")
                // o Newtonsoft consegue desserializar para string, mas precisamos do objeto.
                if (cleaned.StartsWith("\"") && cleaned.EndsWith("\""))
                {
                    cleaned = JsonConvert.DeserializeObject<string>(cleaned);
                }

                // Tenta parsear como JToken
                JToken token = JToken.Parse(cleaned);

                // Verifica se é um objeto (e não array ou valor primitivo)
                if (token.Type != JTokenType.Object)
                {
                    Debug.LogWarning($"[JsonMessageParser] Mensagem não é um objeto JSON: {cleaned}");
                    return null;
                }

                return (JObject)token;
            }
            catch (JsonReaderException e)
            {
                Debug.LogError($"[JsonMessageParser] Erro de sintaxe JSON: {e.Message}\nMensagem: {rawMessage}");
                return null;
            }
            catch (JsonSerializationException e)
            {
                Debug.LogError($"[JsonMessageParser] Erro de serialização JSON: {e.Message}\nMensagem: {rawMessage}");
                return null;
            }
            catch (System.Exception e)
            {
                Debug.LogError($"[JsonMessageParser] Erro inesperado: {e.Message}\nMensagem: {rawMessage}");
                return null;
            }
        }
    }
}