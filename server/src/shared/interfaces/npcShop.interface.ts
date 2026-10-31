/**
 * Item disponível para compra/venda em um NPC comerciante.
 */
export interface ShopItem {
  itemId: string;
  buyPrice: number; // preço de compra (jogador paga)
  sellPrice: number; // preço de venda (jogador recebe)
  /** @deprecated Legado: ignorado pelo catálogo permanente.
   * Mantido temporariamente para catálogos de teste e migração gradual.
   * O protocolo novo não expõe esta propriedade. */
  stock?: number;
}
