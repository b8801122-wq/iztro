
/**
 * Taiwan true-solar-time approximation.
 *
 * Input:
 * - date: YYYY-MM-DD
 * - time: HH:mm, Asia/Taipei local wall-clock time
 * - longitude: Taiwan longitude, east positive
 *
 * Method:
 * Local standard time
 * + longitude correction
 * + equation of time
 */

export function equationOfTimeMinutes(date) {
  const start = Date.UTC(date.getUTCFullYear(), 0, 1);

  const dayOfYear = Math.floor(
    (
      Date.UTC(
        date.getUTCFullYear(),
        date.getUTCMonth(),
        date.getUTCDate()
      ) - start
    ) / 86400000
  ) + 1;

  const hour =
    date.getUTCHours() + date.getUTCMinutes() / 60;

  const gamma =
    (2 * Math.PI / 365) *
    (dayOfYear - 1 + (hour - 12) / 24);

  return 229.18 * (
    0.000075
    + 0.001868 * Math.cos(gamma)
    - 0.032077 * Math.sin(gamma)
    - 0.014615 * Math.cos(2 * gamma)
    - 0.040849 * Math.sin(2 * gamma)
  );
}

export function correctTaiwanTrueSolarTime({
  date,
  time,
  longitude
}) {
  if (
    typeof date !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}$/.test(date)
  ) {
    throw new Error('date 格式必須為 YYYY-MM-DD');
  }

  const dateCheck = new Date(`${date}T00:00:00Z`);

  if (
    Number.isNaN(dateCheck.getTime()) ||
    dateCheck.toISOString().slice(0, 10) !== date
  ) {
    throw new Error('date 不是有效日期');
  }

  if (
    typeof time !== 'string' ||
    !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)
  ) {
    throw new Error('time 格式必須為 HH:mm（24 小時制）');
  }

  if (
    typeof longitude !== 'number' ||
    !Number.isFinite(longitude) ||
    longitude < 73 ||
    longitude > 135
  ) {
    throw new Error('longitude 必須是台灣合理經度範圍內的數字（73–135）');
  }

  const [year, month, day] = date.split('-').map(Number);
  const [hour, minute] = time.split(':').map(Number);

  // 將台灣標準時間視為 UTC 數值容器，
  // 避免伺服器所在地時區影響計算。
  const base = new Date(
    Date.UTC(year, month - 1, day, hour, minute)
  );

  const eot = equationOfTimeMinutes(base);

  // 台灣標準經線為東經 120 度。
  const longitudeCorrection = 4 * (longitude - 120);

  const totalCorrection =
    longitudeCorrection + eot;

  // 四捨五入至最接近的分鐘。
  const corrected = new Date(
    base.getTime() + Math.round(totalCorrection) * 60000
  );

  const pad = n => String(n).padStart(2, '0');

  return {
    original: {
      date,
      time,
      timezone: 'Asia/Taipei',
      longitude
    },

    corrected: {
      date: [
        corrected.getUTCFullYear(),
        pad(corrected.getUTCMonth() + 1),
        pad(corrected.getUTCDate())
      ].join('-'),

      time: [
        pad(corrected.getUTCHours()),
        pad(corrected.getUTCMinutes())
      ].join(':')
    },

    correctionMinutes: Number(totalCorrection.toFixed(2)),

    longitudeCorrectionMinutes:
      Number(longitudeCorrection.toFixed(2)),

    equationOfTimeMinutes:
      Number(eot.toFixed(2)),

    method:
      'local standard time + 4 × (longitude − 120°E) + equation of time',

    note:
      '此為 NOAA 方程時近似值；未納入歷史地方時制度、出生地海拔、地形或出生證時間誤差。校正時間四捨五入至分鐘。'
  };
}

export function hourToIztroIndex(hour) {
  if (
    !Number.isInteger(hour) ||
    hour < 0 ||
    hour > 23
  ) {
    throw new Error('hour 必須是 0–23');
  }

  if (hour === 23) return 12; // 晚子時
  if (hour === 0) return 0;   // 早子時

  return Math.ceil(hour / 2);
}
