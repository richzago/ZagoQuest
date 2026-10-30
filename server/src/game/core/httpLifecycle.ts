/**
 * HTTP transport lifecycle, separate from Express routes and database setup.
 * Node's server.listen reports errors asynchronously via "error" (EADDRINUSE,
 * EACCES), so a try/catch around listen() alone is not sufficient.
 */
import type { Server as HttpServer } from "node:http";

export function resolveApiPort(value: string | undefined, fallback = 3000): number {
  if (value === undefined || value === "") return fallback;
  if (!/^\d+$/.test(value)) throw new Error(`API_PORT inválida: ${value}`);
  const port = Number(value);
  if (!Number.isSafeInteger(port) || port < 0 || port > 65535) {
    throw new Error(`API_PORT fora dos limites: ${value}`);
  }
  return port;
}

export function listenHttp(server: HttpServer, port: number): Promise<void> {
  if (!Number.isSafeInteger(port) || port < 0 || port > 65535) {
    return Promise.reject(new Error(`Porta HTTP inválida: ${port}`));
  }

  return new Promise<void>((resolve, reject) => {
    const cleanup = () => server.off("error", onError);
    const onError = (error: Error) => {
      cleanup();
      reject(error);
    };

    server.once("error", onError);
    try {
      server.listen(port, () => {
        cleanup();
        resolve();
      });
    } catch (error) {
      cleanup();
      reject(error);
    }
  });
}

/** Resolves if the server never reached listen(), including failed bootstrap. */
export function closeHttp(server: HttpServer | undefined): Promise<void> {
  if (!server || !server.listening) return Promise.resolve();

  return new Promise<void>((resolve, reject) => {
    server.close((error?: Error) => {
      if (error) reject(error);
      else resolve();
    });
  });
}
