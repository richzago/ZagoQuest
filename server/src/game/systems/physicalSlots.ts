/**
 * C18: slots físicos persistidos. O Map legado por itemId continua como
 * índice agregado até todos os protocolos serem migrados.
 * Cada pilha ganha slotId próprio e não pode exceder maxStack do JSON.
 */
import { generateId } from "../../shared/utils/idUtils";
import { ItemRegistry } from "../../data/items/itemRegistry";
export interface PhysicalSlot {
  id: string; itemId: string; amount: number;
}

export function stackLimit(itemId: string): number {
  try {
    const info=ItemRegistry.get(itemId);
    if (!info.stackable) return 1;
    const limit=info.maxStack;
    return Number.isSafeInteger(limit) && (limit ?? 0)>0
      ? limit! : Number.MAX_SAFE_INTEGER;
  } catch { return 1; } // IDs legados são conservadores
}

export function countPhysicalSlots(items: ReadonlyMap<string,number>): number {
  let count=0;
  for(const [itemId,qty] of items){
    if(!Number.isSafeInteger(qty)||qty<=0) return Number.MAX_SAFE_INTEGER;
    count+=Math.ceil(qty/stackLimit(itemId));
    if(!Number.isSafeInteger(count)) return Number.MAX_SAFE_INTEGER;
  }
  return count;
}

/** Reconciliar sem apagar quantidade do save. Manter UUID de pilha quando
 * possível, mesmo que o Map tenha sido modificado por sistemas legados. */
export function reconcilePhysicalSlots(
  items: ReadonlyMap<string,number>,
  previous: ReadonlyArray<PhysicalSlot> = [],
): PhysicalSlot[] {
  const remaining = new Map(items);
  const slots: PhysicalSlot[] = [];
  const ids = new Set<string>();
  for(const old of previous){
    if(!old || typeof old.id!=="string" || ids.has(old.id) ||
       !Number.isSafeInteger(old.amount) || old.amount<=0) continue;
    const remain=remaining.get(old.itemId) ?? 0;
    if(remain<=0) continue;
    // Completar a pilha antiga primeiro, sem trocar seu UUID.
    const amount=Math.min(remain,stackLimit(old.itemId));
    if(amount<=0) continue;
    slots.push({id:old.id,itemId:old.itemId,amount});
    ids.add(old.id);
    remaining.set(old.itemId,remain-amount);
  }
  for(const [itemId,qty] of remaining){
    let rest=qty;
    const limit=stackLimit(itemId);
    // Saves adulterados/legados extremos nunca devem gerar milhões de
    // objetos no heap. Não apagar dados: rejeitar para migração assistida.
    if (rest / limit > 10000)
      throw new Error("Bag excede 10000 pilhas; migração deve ser auditada.");
    while(rest>0){
      const amount=Math.min(rest,limit);
      const id=generateId();
      slots.push({id,itemId,amount});
      rest-=amount;
    }
  }
  return slots;
}
