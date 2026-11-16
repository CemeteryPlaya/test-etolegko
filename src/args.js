import { parseArgs } from 'node:util';

export const DEFAULT_COUNT = 10;
export const DEFAULT_TIMEOUT_SEC = 30;

export const USAGE = `Использование:
  node bin/speedtest.js <url> [опции]

Опции:
  -n, --count <число>     количество последовательных запросов (по умолчанию ${DEFAULT_COUNT})
  -t, --timeout <секунды> таймаут одного запроса (по умолчанию ${DEFAULT_TIMEOUT_SEC})
  -h, --help              показать эту справку

Пример:
  node bin/speedtest.js https://proof.ovh.net/files/10Mb.dat`;

export class UsageError extends Error {
  name = 'UsageError';
}

/**
 * Разбирает аргументы командной строки.
 * @param {string[]} argv аргументы без `node` и пути к скрипту
 * @returns {{ help: true } | { help: false, url: URL, count: number, timeoutMs: number }}
 */
export function parseCliArgs(argv) {
  let parsed;
  try {
    parsed = parseArgs({
      args: argv,
      allowPositionals: true,
      options: {
        count: { type: 'string', short: 'n' },
        timeout: { type: 'string', short: 't' },
        help: { type: 'boolean', short: 'h' },
      },
    });
  } catch (error) {
    throw new UsageError(error.message);
  }

  const { values, positionals } = parsed;
  if (values.help) return { help: true };

  if (positionals.length !== 1) {
    throw new UsageError('Нужно указать ровно один URL');
  }

  return {
    help: false,
    url: parseHttpUrl(positionals[0]),
    count: parsePositiveInteger(values.count ?? String(DEFAULT_COUNT), '--count'),
    timeoutMs: parsePositiveNumber(values.timeout ?? String(DEFAULT_TIMEOUT_SEC), '--timeout') * 1000,
  };
}

function parseHttpUrl(raw) {
  let url;
  try {
    url = new URL(raw);
  } catch {
    throw new UsageError(`Некорректный URL: ${raw}`);
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new UsageError(`Поддерживаются только http и https, получено: ${url.protocol}`);
  }
  return url;
}

function parsePositiveInteger(raw, name) {
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 1) {
    throw new UsageError(`${name} должно быть целым числом больше 0, получено: ${raw}`);
  }
  return value;
}

function parsePositiveNumber(raw, name) {
  const value = Number(raw);
  if (!Number.isFinite(value) || value <= 0) {
    throw new UsageError(`${name} должно быть числом больше 0, получено: ${raw}`);
  }
  return value;
}
