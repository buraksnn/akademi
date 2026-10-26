export const TZ = 'Europe/Istanbul';
export function today(zone = TZ) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: zone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}
export function weekDay(date: string) {
  return (new Date(date + 'T12:00:00Z').getUTCDay() + 6) % 7;
}
export function dateText(value: Date | string) {
  return new Intl.DateTimeFormat('tr-TR', {
    timeZone: TZ,
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date(value));
}
export const clock = (minutes: number) =>
  `${Math.floor(minutes / 60)
    .toString()
    .padStart(2, '0')}:${(minutes % 60).toString().padStart(2, '0')}`;
export const days = ['Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi', 'Pazar'];
export function dateTimeToUtc(value: string, zone = TZ) {
  const naive = Date.parse(value + 'Z');
  if (!Number.isFinite(naive)) throw new Error('Geçersiz tarih');
  let result = naive;
  for (let i = 0; i < 3; i++) {
    const parts = new Intl.DateTimeFormat('sv-SE', {
      timeZone: zone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23',
    })
      .format(new Date(result))
      .replace(' ', 'T');
    result += naive - Date.parse(parts + 'Z');
  }
  return new Date(result).toISOString();
}
