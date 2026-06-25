using Newtonsoft.Json;
using Newtonsoft.Json.Linq;
using UnityEngine;

namespace ZagoQuest.Networking.Parser
{
    public static class JsonMessageParser
    {
        public static JObject Parse(string rawMessage)
        {
            try
            {
                // Remove possíveis aspas externas (caso de double stringify)
                string cleaned = rawMessage.Trim();
                if (cleaned.StartsWith("\"") && cleaned.EndsWith("\""))
                    cleaned = JsonConvert.DeserializeObject<string>(cleaned);

                JObject json = JObject.Parse(cleaned);
                return json;
            }
            catch (System.Exception e)
            {
                Debug.LogError($"[Parser] Falha ao parsear: {e.Message}\n{rawMessage}");
                return null;
            }
        }
    }
}