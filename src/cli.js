import { parseCliArgs, UsageError, USAGE } from './args.js';
import { runBenchmark, summarize } from './benchmark.js';
import { formatBytes, formatMBps, formatMbps, formatMs } from './format.js';

export const EXIT_OK = 0;
export const EXIT_REQUEST_FAILED = 1;
export const EXIT_USAGE = 2;

/**
 * Точка входа CLI. Потоки вывода передаются параметром, чтобы main можно было тестировать.
 * @returns {Promise<number>} код выхода
 */
export async function main(argv, { stdout = process.stdout, stderr = process.stderr } = {}) {
  const print = (line = '') => stdout.write(`${line}\n`);

  let options;
  try {
    options = parseCliArgs(argv);
  } catch (error) {
    if (!(error instanceof UsageError)) throw error;
    stderr.write(`Ошибка: ${error.message}\n\n${USAGE}\n`);
    return EXIT_USAGE;
  }

  if (options.help) {
    print(USAGE);
    return EXIT_OK;
  }

  const { url, count, timeoutMs } = options;
  print(`URL: ${url.href}`);
  print(`Запросов: ${count} (последовательно), таймаут: ${timeoutMs / 1000} с`);
  print();

  const width = String(count).length + 1;
  const results = await runBenchmark(url, {
    count,
    timeoutMs,
    onResult(r) {
      const label = `#${r.index}`.padStart(width);
      if (r.ok) {
        const speed = r.durationMs > 0 ? r.bytes / (r.durationMs / 1000) : 0;
        print(`${label}  ${formatBytes(r.bytes).padStart(10)}  ${formatMs(r.durationMs).padStart(11)}  ${formatMbps(speed).padStart(15)}`);
      } else {
        print(`${label}  ошибка: ${r.error}`);
      }
    },
  });

  const s = summarize(results);
  print();
  print(`Успешных запросов:     ${s.succeeded} из ${s.requests}`);

  if (s.succeeded === 0) {
    stderr.write('Ни один запрос не завершился успешно — скорость посчитать нельзя.\n');
    return EXIT_REQUEST_FAILED;
  }

  print(`Среднее время запроса: ${formatMs(s.avgMs)} (мин ${formatMs(s.minMs)}, макс ${formatMs(s.maxMs)})`);
  print(`Скачано всего:         ${formatBytes(s.totalBytes)} (${s.totalBytes} байт)`);
  if (s.bytesPerSecond === null) {
    print('Скорость скачивания:   не определена (нулевое время)');
  } else {
    print(`Скорость скачивания:   ${formatMbps(s.bytesPerSecond)} (${formatMBps(s.bytesPerSecond)})`);
  }

  return s.failed > 0 ? EXIT_REQUEST_FAILED : EXIT_OK;
}
