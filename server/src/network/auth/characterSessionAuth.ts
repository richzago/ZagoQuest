/**
 * Fase 5 — autorização de sessão por conta E personagem.
 *
 * Esta função não abre socket, não cria jogador, nem envia snapshot: é um
 * guardião reutilizável pela etapa futura do handshake WebSocket.
 * Token tem identidade de conta, mas só a consulta SQL comprova propriedade.
 */
import jwt from "jsonwebtoken";
import { AppDataSource } from "../../api/data-source";
import { Character } from "../../api/entities/Character";

export type AuthorizedCharacter = {
  accountId: string;
  characterId: string;
  characterName: string;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Falhas de autenticação retornam null. Falhas PostgreSQL são propagadas. */
export async function authorizeCharacterSession(
  token: unknown,
  characterId: unknown,
): Promise<AuthorizedCharacter | null> {
  if (typeof token !== "string" || !token || token.length > 8192 ||
      typeof characterId !== "string" || !UUID.test(characterId)) return null;

  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET não configurado.");

  let accountId: string;
  try {
    const payload = jwt.verify(token, secret, { algorithms: ["HS256"] });
    if (typeof payload === "string" || typeof payload.id !== "string" ||
        !UUID.test(payload.id)) return null;
    accountId = payload.id;
  } catch {
    return null;
  }

  const character = await AppDataSource.getRepository(Character).findOne({
    where: { id: characterId, accountId },
    select: { id: true, name: true, accountId: true },
  });
  if (!character) return null;
  return { accountId, characterId: character.id, characterName: character.name };
}
