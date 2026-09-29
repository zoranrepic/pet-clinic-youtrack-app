// Adds working minutes to a timestamp using the clinic working hours (Monday to Friday).
const dateTime = require('@jetbrains/youtrack-scripting-api/date-time');

const MINUTE_MS = 60 * 1000;
const DAY_MS = 24 * 60 * MINUTE_MS;
const pad = (n) => (n < 10 ? '0' : '') + n;

function readConfig(settings) {
  const s = settings || {};
  const start = typeof s.workdayStartHour === 'number' ? s.workdayStartHour : 9;
  const end = typeof s.workdayEndHour === 'number' ? s.workdayEndHour : 17;
  return {
    startHour: start,
    endHour: end > start ? end : start + 8,
    timeZone: s.timeZone || 'UTC'
  };
}

function addWorkingMinutes(startTs, minutes, settings) {
  const cfg = readConfig(settings);
  const localDay = (ts) => dateTime.format(ts, 'yyyy-MM-dd', cfg.timeZone);
  const at = (day, hour) => (hour === 24 ?
    dateTime.parse(day + ' 00:00', 'yyyy-MM-dd HH:mm', cfg.timeZone) + DAY_MS :
    dateTime.parse(day + ' ' + pad(hour) + ':00', 'yyyy-MM-dd HH:mm', cfg.timeZone));
  const isWorkday = (day) => {
    const p = day.split('-');
    const weekday = new Date(Date.UTC(+p[0], +p[1] - 1, +p[2])).getUTCDay();
    return weekday >= 1 && weekday <= 5;
  };

  let t = startTs;
  let remaining = minutes;
  for (let i = 0; i < 60; i++) {
    const day = localDay(t);
    if (isWorkday(day)) {
      const windowStart = at(day, cfg.startHour);
      const windowEnd = at(day, cfg.endHour);
      if (t < windowStart) {
        t = windowStart;
      }
      if (t < windowEnd) {
        const available = (windowEnd - t) / MINUTE_MS;
        if (remaining <= available) {
          return t + remaining * MINUTE_MS;
        }
        remaining -= available;
      }
    }
    // Jump to the start of the next local day.
    t = dateTime.parse(localDay(at(day, 12) + DAY_MS) + ' 00:00', 'yyyy-MM-dd HH:mm', cfg.timeZone);
  }
  throw new Error('Could not fit ' + minutes + ' working minutes into the working calendar');
}

exports.addWorkingMinutes = addWorkingMinutes;
