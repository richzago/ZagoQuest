/** Fase 6: validação de produção e redaction, sem banco real. */
import assert from "node:assert/strict";
import { test } from "node:test";
import { redactLogMessage } from "../src/game/core/logger/logRedaction";
import { validateServerRuntime } from "../src/game/core/runtimeConfig";
import { Logger } from "../src/game/core/logger/logger";
import { LoggerConfig } from "../src/game/core/logger/loggerConfig";
import { LogLevel } from "../src/shared/enums/logLevel.enum";
import { LogChannel } from "../src/shared/enums/logChannel.enum";

test("logs ocultam JWT Bearer, senha em JSON e connection URL", () => {
  const raw = 'Authorization: Bearer eyJhbGciOiJIUzI1NiJ9.abc.def password="123abc" ' +
    '{"access_token":"hello","secret": "hidden"} postgresql://user:private@localhost:5432/db';
  const clean = redactLogMessage(raw);
  for (const secret of ["eyJhbG", "123abc", "hello", "hidden", "private"]) {
    assert.equal(clean.includes(secret), false, secret);
  }
  assert.match(clean, /Bearer \[REDACTED\]/);
  assert.match(clean, /password="\[REDACTED\]/);
  assert.match(clean, /postgresql:\/\/\[REDACTED\]@/);
});

test("níveis WARN/ERROR de SYSTEM nunca somem com modo debug desligado", () => {
  const old = { debug: LoggerConfig.debug, level: LoggerConfig.level,
    channels: LoggerConfig.enabledChannels, file: LoggerConfig.fileLogging };
  const logged: string[] = [];
  const prior = console.log;
  try {
    LoggerConfig.debug = false;
    LoggerConfig.level = LogLevel.ERROR;
    LoggerConfig.enabledChannels = [] as LogChannel[];
    LoggerConfig.fileLogging = false;
    console.log = (line) => { logged.push(String(line)); };
    Logger.system("informacao");
    Logger.warn("password=private");
    Logger.error("token=private2");
    assert.equal(logged.length, 2);
    assert.ok(logged.every(line => !line.includes("private")));
    assert.match(logged[0], /WARN/);
    assert.match(logged[1], /ERROR/);
  } finally {
    console.log = prior;
    LoggerConfig.debug = old.debug;
    LoggerConfig.level = old.level;
    LoggerConfig.enabledChannels = old.channels;
    LoggerConfig.fileLogging = old.file;
  }
});

const production = {
  NODE_ENV: "production",
  API_PORT: "3000",
  DB_HOST: "127.0.0.1",
  DB_USER: "game",
  DB_NAME: "zagoquest_prod",
  DB_PORT: "5432",
  DB_PASSWORD: "some-long-random-database-password",
  JWT_SECRET: "a-very-long-production-secret-string-over-32",
  DB_SYNCHRONIZE: "false",
  DB_LOGGING: "false",
};

test("production validates critical secrets and forbids schema sync / DB query logs", () => {
  assert.doesNotThrow(() => validateServerRuntime(production));
  assert.throws(() => validateServerRuntime({ ...production, JWT_SECRET: "dev" }), /JWT_SECRET/);
  assert.throws(() => validateServerRuntime({ ...production, JWT_SECRET: "" }), /JWT_SECRET/);
  assert.throws(() => validateServerRuntime({ ...production, DB_PASSWORD: "replace-me" }), /DB_PASSWORD/);
  assert.throws(() => validateServerRuntime({ ...production, DB_NAME: "" }), /DB_NAME/);
  assert.throws(() => validateServerRuntime({ ...production, DB_LOGGING: "true" }), /DB_LOGGING/);
  assert.throws(() => validateServerRuntime({ ...production, DB_SYNCHRONIZE: "true" }), /proibido em produção/);
  assert.throws(() => validateServerRuntime({ ...production, API_PORT: "70000" }), /API_PORT/);
});

test("runtime local remains compatible with development, CI and missing env", () => {
  assert.doesNotThrow(() => validateServerRuntime({ NODE_ENV: "test" }));
  assert.doesNotThrow(() => validateServerRuntime({ NODE_ENV: "development" }));
  assert.doesNotThrow(() => validateServerRuntime({}));
  assert.throws(() => validateServerRuntime({ NODE_ENV: "typo" }), /NODE_ENV/);
});
