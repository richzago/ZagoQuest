/**
 * Item disponível para compra/venda em um NPC comerciante.
 */
export interface ShopItem {
  itemId: string;
  buyPrice: number; // preço de compra (jogador paga)
  sellPrice: number; // preço de venda (jogador recebe)
  stock?: number; // quantidade disponível
}
