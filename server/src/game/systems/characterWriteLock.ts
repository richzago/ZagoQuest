/** Mutex FIFO por UUID: autosave e REST online não sobrescrevem o mesmo Character. */
const tails = new Map<string, Promise<void>>();

export async function withCharacterWriteLock<T>(
  characterId: string, action: () => Promise<T>,
): Promise<T> {
  const previous = tails.get(characterId);
  let release!: () => void;
  const current = new Promise<void>((resolve) => { release = resolve; });
  tails.set(characterId, current);
  if (previous) await previous;
  try { return await action(); }
  finally {
    release();
    if (tails.get(characterId) === current) tails.delete(characterId);
  }
}
