using System;
using System.Collections.Generic;
using Newtonsoft.Json.Linq;
using UnityEngine;
using ZagoQuest.Networking.Messages;

namespace ZagoQuest.Networking.Handlers
{
    public class EquipmentHandler : IMessageHandler
    {
        public void Handle(JObject json, NetworkContext context)
        {
            Debug.Log($"[RAW] Mensagem equipment (bruta): '{json}'");
            try
            {
                JArray itemsArray = json["items"] as JArray;
                var equipDict = new Dictionary<EquipmentSlot, string>();

                if (itemsArray != null)
                {
                    foreach (var item in itemsArray)
                    {
                        string slotStr = item["slot"]?.ToString();
                        string itemId = item["itemId"]?.ToString();
                        if (!string.IsNullOrEmpty(slotStr) && !string.IsNullOrEmpty(itemId))
                        {
                            if (Enum.TryParse<EquipmentSlot>(slotStr, true, out var slot))
                            {
                                equipDict[slot] = itemId;
                                Debug.Log($"[EQUIPMENT] Slot: {slot}, Item: {itemId}");
                            }
                            else
                            {
                                Debug.LogWarning($"[EQUIPMENT] Slot inválido: {slotStr}");
                            }
                        }
                    }
                }
                else
                {
                    Debug.LogWarning("[EQUIPMENT] items é nulo ou não é um array!");
                }

                context.EquipmentUI?.UpdateEquipment(equipDict);
            }
            catch (Exception e)
            {
                Debug.LogError($"[EQUIPMENT] Erro ao parsear JSON: {e.Message}\n{e.StackTrace}");
            }
        }
    }
}