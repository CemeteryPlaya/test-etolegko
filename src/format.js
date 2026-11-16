// Все единицы десятичные (SI): 1 МБ = 1 000 000 байт, 1 Мбит/с = 1 000 000 бит/с —
// так же считают провайдеры и сервисы вроде speedtest.net.

export function toMegabitsPerSecond(bytesPerSecond) {
  return (bytesPerSecond * 8) / 1e6;
}

export function toMegabytesPerSecond(bytesPerSecond) {
  return bytesPerSecond / 1e6;
}

export function formatBytes(bytes) {
  if (bytes >= 1e9) return `${(bytes / 1e9).toFixed(2)} ГБ`;
  if (bytes >= 1e6) return `${(bytes / 1e6).toFixed(2)} МБ`;
  if (bytes >= 1e3) return `${(bytes / 1e3).toFixed(2)} КБ`;
  return `${bytes} Б`;
}

export function formatMs(ms) {
  return `${ms.toFixed(1)} мс`;
}

export function formatMbps(bytesPerSecond) {
  return `${toMegabitsPerSecond(bytesPerSecond).toFixed(2)} Мбит/с`;
}

export function formatMBps(bytesPerSecond) {
  return `${toMegabytesPerSecond(bytesPerSecond).toFixed(2)} МБ/с`;
}
