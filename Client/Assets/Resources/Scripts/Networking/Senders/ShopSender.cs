using UnityEngine;
using NativeWebSocket;
using ZagoQuest.Networking.Messages;

namespace ZagoQuest.Networking.Senders
{
    /// <summary>
    /// Responsável por enviar comandos da loja.
    /// </summary>
    public class ShopSender : BaseSender
    {
        public ShopSender(WebSocket websocket) : base(websocket) { }

        public void SendOpenShop(string npcId)
        {
            var msg = new OpenShopMessage
            {
                type = "openShop",
                npcId = npcId
            };
            Debug.Log($"[ShopSender] Abrindo loja de {npcId}");
            Send(msg);
        }

        /// <summary>Fecha somente a loja correspondente a esta janela.</summary>
        public void SendCloseShop(string npcId)
        {
            if (string.IsNullOrEmpty(npcId)) return;
            Send(new CloseShopMessage { type = "closeShop", npcId = npcId });
        }

        public void SendSellItem(string npcId, string itemId, int amount)
        {
            if (string.IsNullOrEmpty(npcId) || string.IsNullOrEmpty(itemId) || amount <= 0) return;
            Send(new SellItemMessage { type = "sellItem", npcId = npcId,
                itemId = itemId, amount = amount });
        }

        public void SendBuyItem(string npcId, string itemId, int amount)
        {
            var msg = new BuyItemMessage
            {
                type = "buyItem",
                npcId = npcId,
                itemId = itemId,
                amount = amount
            };
            Debug.Log($"[ShopSender] Comprando {amount}x {itemId} de {npcId}");
            Send(msg);
        }
    }
}