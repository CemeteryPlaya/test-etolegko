import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseCliArgs, UsageError, DEFAULT_COUNT, DEFAULT_TIMEOUT_SEC } from '../src/args.js';

test('URL без опций — значения по умолчанию', () => {
  const opts = parseCliArgs(['https://example.com/a.jpg']);
  assert.equal(opts.help, false);
  assert.equal(opts.url.href, 'https://example.com/a.jpg');
  assert.equal(opts.count, DEFAULT_COUNT);
  assert.equal(opts.timeoutMs, DEFAULT_TIMEOUT_SEC * 1000);
});

test('короткие и длинные опции', () => {
  assert.equal(parseCliArgs(['http://x.test', '-n', '3']).count, 3);
  assert.equal(parseCliArgs(['--count', '5', 'http://x.test']).count, 5);
  assert.equal(parseCliArgs(['http://x.test', '-t', '1.5']).timeoutMs, 1500);
});

test('--help не требует URL', () => {
  assert.deepEqual(parseCliArgs(['--help']), { help: true });
});

test('некорректный ввод даёт UsageError', () => {
  const bad = [
    [],
    ['a', 'b'],
    ['not a url'],
    ['ftp://example.com/file'],
    ['http://x.test', '-n', '0'],
    ['http://x.test', '-n', '2.5'],
    ['http://x.test', '-n', 'abc'],
    ['http://x.test', '-t', '-1'],
    ['http://x.test', '--unknown'],
  ];
  for (const argv of bad) {
    assert.throws(() => parseCliArgs(argv), UsageError, `argv: ${JSON.stringify(argv)}`);
  }
});
