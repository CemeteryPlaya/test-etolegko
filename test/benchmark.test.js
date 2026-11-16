import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { runBenchmark, summarize } from '../src/benchmark.js';
import { main, EXIT_OK, EXIT_REQUEST_FAILED, EXIT_USAGE } from '../src/cli.js';

const PAYLOAD_SIZE = 256 * 1024;
const payload = Buffer.alloc(PAYLOAD_SIZE, 0xab);

let server;
let baseUrl;
let hits = 0;
let concurrent = 0;
let maxConcurrent = 0;

before(async () => {
  server = http.createServer((req, res) => {
    if (req.url === '/hang') return; // никогда не отвечает — для проверки таймаута
    if (req.url === '/error') {
      res.writeHead(500).end('boom');
      return;
    }
    hits++;
    concurrent++;
    maxConcurrent = Math.max(maxConcurrent, concurrent);
    res.writeHead(200, { 'content-type': 'application/octet-stream' });
    // отдаём кусками с паузой, чтобы запрос длился заметное время
    res.write(payload.subarray(0, PAYLOAD_SIZE / 2));
    setTimeout(() => {
      res.end(payload.subarray(PAYLOAD_SIZE / 2));
      concurrent--;
    }, 10);
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(() => {
  server.closeAllConnections();
  server.close();
});

test('10 последовательных запросов, полный объём каждого', async () => {
  hits = 0;
  maxConcurrent = 0;
  const seen = [];
  const results = await runBenchmark(new URL(`${baseUrl}/file`), {
    count: 10,
    timeoutMs: 5000,
    onResult: (r) => seen.push(r.index),
  });

  assert.equal(hits, 10);
  assert.equal(maxConcurrent, 1, 'запросы не должны идти параллельно');
  assert.deepEqual(seen, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  for (const r of results) {
    assert.equal(r.ok, true);
    assert.equal(r.bytes, PAYLOAD_SIZE);
    assert.ok(r.durationMs >= 10, `durationMs=${r.durationMs} включает дочитывание тела`);
  }

  const s = summarize(results);
  assert.equal(s.totalBytes, PAYLOAD_SIZE * 10);
  assert.equal(s.succeeded, 10);
  assert.ok(Math.abs(s.avgMs - s.totalMs / 10) < 1e-9);
  assert.ok(Math.abs(s.bytesPerSecond - s.totalBytes / (s.totalMs / 1000)) < 1e-6);
});

test('HTTP-ошибка и таймаут не прерывают серию', async () => {
  const errors = await runBenchmark(new URL(`${baseUrl}/error`), { count: 2, timeoutMs: 5000 });
  assert.deepEqual(errors.map((r) => [r.ok, r.error]), [
    [false, 'HTTP 500 Internal Server Error'],
    [false, 'HTTP 500 Internal Server Error'],
  ]);

  const [timedOut] = await runBenchmark(new URL(`${baseUrl}/hang`), { count: 1, timeoutMs: 100 });
  assert.equal(timedOut.ok, false);
  assert.equal(timedOut.error, 'превышен таймаут');
});

test('summarize считает только успешные запросы', () => {
  const s = summarize([
    { ok: true, bytes: 1000, durationMs: 100 },
    { ok: false, error: 'x' },
    { ok: true, bytes: 3000, durationMs: 300 },
  ]);
  assert.equal(s.succeeded, 2);
  assert.equal(s.failed, 1);
  assert.equal(s.totalBytes, 4000);
  assert.equal(s.avgMs, 200);
  assert.equal(s.minMs, 100);
  assert.equal(s.maxMs, 300);
  assert.equal(s.bytesPerSecond, 10_000);
});

function capture() {
  let text = '';
  return { stream: { write: (chunk) => { text += chunk; } }, get text() { return text; } };
}

test('CLI: итоговый вывод и коды выхода', async () => {
  const out = capture();
  const err = capture();
  const code = await main([`${baseUrl}/file`, '-n', '3'], { stdout: out.stream, stderr: err.stream });
  assert.equal(code, EXIT_OK);
  assert.match(out.text, /Успешных запросов:\s+3 из 3/);
  assert.match(out.text, /Скачано всего:\s+786\.43 КБ \(786432 байт\)/);
  assert.match(out.text, /Скорость скачивания:\s+[\d.]+ Мбит\/с \([\d.]+ МБ\/с\)/);

  const failed = await main([`${baseUrl}/error`, '-n', '1'], { stdout: capture().stream, stderr: capture().stream });
  assert.equal(failed, EXIT_REQUEST_FAILED);

  const usage = capture();
  assert.equal(await main([], { stdout: capture().stream, stderr: usage.stream }), EXIT_USAGE);
  assert.match(usage.text, /Использование/);
});
