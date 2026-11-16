// Запрашиваем несжатый ответ, чтобы считать реально переданные байты,
// и просим промежуточные кэши не отдавать сохранённую копию.
// Явный User-Agent: часть CDN режет запросы с безымянными клиентами.
const REQUEST_HEADERS = Object.freeze({
  'user-agent': 'speedtest-cli/1.0 (Node.js)',
  'accept-encoding': 'identity',
  'cache-control': 'no-cache',
  pragma: 'no-cache',
});

export class HttpStatusError extends Error {
  name = 'HttpStatusError';

  constructor(status, statusText) {
    super(`HTTP ${status}${statusText ? ` ${statusText}` : ''}`);
    this.status = status;
  }
}

/**
 * Выполняет один запрос и дочитывает тело ответа до конца.
 * Время отсчитывается от отправки запроса до получения последнего байта.
 * @returns {Promise<{ status: number, bytes: number, durationMs: number }>}
 */
export async function measureRequest(url, { timeoutMs }) {
  const startedAt = performance.now();
  const response = await fetch(url, {
    headers: REQUEST_HEADERS,
    signal: AbortSignal.timeout(timeoutMs),
  });

  if (!response.ok) {
    await response.body?.cancel();
    throw new HttpStatusError(response.status, response.statusText);
  }

  // Считаем байты по мере поступления, не держа весь ответ в памяти.
  let bytes = 0;
  if (response.body) {
    for await (const chunk of response.body) bytes += chunk.byteLength;
  }

  return { status: response.status, bytes, durationMs: performance.now() - startedAt };
}

/**
 * Делает `count` запросов строго последовательно.
 * Ошибка одного запроса не прерывает серию — она попадает в результат.
 */
export async function runBenchmark(url, { count, timeoutMs, onResult }) {
  const results = [];
  for (let index = 1; index <= count; index++) {
    let result;
    try {
      result = { index, ok: true, ...(await measureRequest(url, { timeoutMs })) };
    } catch (error) {
      result = { index, ok: false, error: describeError(error) };
    }
    results.push(result);
    onResult?.(result);
  }
  return results;
}

/**
 * Итоговая статистика по успешным запросам.
 * Скорость = суммарный объём / суммарное время, то есть средневзвешенная,
 * а не среднее арифметическое скоростей отдельных запросов.
 */
export function summarize(results) {
  const ok = results.filter((r) => r.ok);
  const durations = ok.map((r) => r.durationMs);
  const totalBytes = ok.reduce((acc, r) => acc + r.bytes, 0);
  const totalMs = durations.reduce((acc, d) => acc + d, 0);

  return {
    requests: results.length,
    succeeded: ok.length,
    failed: results.length - ok.length,
    totalBytes,
    totalMs,
    avgMs: ok.length > 0 ? totalMs / ok.length : null,
    minMs: ok.length > 0 ? Math.min(...durations) : null,
    maxMs: ok.length > 0 ? Math.max(...durations) : null,
    bytesPerSecond: totalMs > 0 ? totalBytes / (totalMs / 1000) : null,
  };
}

export function describeError(error) {
  if (error?.name === 'TimeoutError') return 'превышен таймаут';
  if (error instanceof HttpStatusError) return error.message;
  const cause = error?.cause;
  if (cause) return `${error.message}: ${cause.code ?? cause.message}`;
  return error?.message ?? String(error);
}
