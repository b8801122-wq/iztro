
import iztro from '../lib/index.js';
import {
  correctTaiwanTrueSolarTime,
  hourToIztroIndex
} from './solar-time.js';

const { astro } = iztro;

function cleanStar(star) {
  return {
    name: star.name,
    category: star.type,
    scope: star.scope,
    brightness: star.brightness || null,
    mutagen: star.mutagen || null
  };
}

function cleanPalace(p) {
  const engineMajor = (p.majorStars || []).map(cleanStar);
  const engineMinor = (p.minorStars || []).map(cleanStar);
  const engineAdjective = (p.adjectiveStars || []).map(cleanStar);

  const allStars = [
    ...engineMajor,
    ...engineMinor,
    ...engineAdjective
  ];

  return {
    name: p.name,
    isBodyPalace: p.isBodyPalace,
    isOriginalPalace: p.isOriginalPalace,
    heavenlyStem: p.heavenlyStem,
    earthlyBranch: p.earthlyBranch,
    majorStars: engineMajor.filter(
      star => star.category === 'major'
    ),
    auxiliaryStars: [
      ...engineMinor,
      ...engineMajor.filter(
        star => ['lucun', 'tianma'].includes(star.category)
      )
    ],
    miscellaneousStars: engineAdjective,
    fourTransformations: allStars.filter(star => star.mutagen),
    engineGroups: {
      majorStars: engineMajor,
      minorStars: engineMinor,
      adjectiveStars: engineAdjective
    },
    shenSha: {
      changsheng12: p.changsheng12,
      boshi12: p.boshi12,
      suiqian12: p.suiqian12,
      jiangqian12: p.jiangqian12
    },
    decadal: p.decadal,
    ages: p.ages
  };
}

export function buildChart(input) {
  const {
    birthDate,
    birthTime,
    gender,
    longitude,
    calendar = 'solar',
    isLeapMonth = false,
    fixLeap = true,
    targetDate
  } = input;

  if (
    typeof birthDate !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}$/.test(birthDate)
  ) {
    throw new Error('birthDate 必須是 YYYY-MM-DD');
  }

  const dateCheck = new Date(`${birthDate}T00:00:00Z`);
  if (
    Number.isNaN(dateCheck.getTime()) ||
    dateCheck.toISOString().slice(0, 10) !== birthDate
  ) {
    throw new Error('birthDate 不是有效日期');
  }

  if (
    typeof birthTime !== 'string' ||
    !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(birthTime)
  ) {
    throw new Error('birthTime 必須是 HH:mm 格式');
  }

  if (!['男', '女'].includes(gender)) {
    throw new Error('gender 必須是「男」或「女」');
  }

  if (!['solar', 'lunar'].includes(calendar)) {
    throw new Error('calendar 必須是 solar 或 lunar');
  }

  if (typeof longitude !== 'number' || !Number.isFinite(longitude)) {
    throw new Error('longitude 必須是有效數字');
  }

  if (longitude < 73 || longitude > 135) {
    throw new Error('longitude 超出合理經度範圍');
  }

  if (calendar === 'lunar' && typeof isLeapMonth !== 'boolean') {
    throw new Error('isLeapMonth 必須是布林值');
  }

  if (targetDate !== undefined) {
    if (
      typeof targetDate !== 'string' ||
      !/^\d{4}-\d{2}-\d{2}$/.test(targetDate)
    ) {
      throw new Error('targetDate 必須是 YYYY-MM-DD');
    }

    const targetCheck = new Date(`${targetDate}T00:00:00Z`);
    if (
      Number.isNaN(targetCheck.getTime()) ||
      targetCheck.toISOString().slice(0, 10) !== targetDate
    ) {
      throw new Error('targetDate 不是有效日期');
    }
  }

  const [rawHour] = birthTime.split(':').map(Number);
  const rawTimeIndex = hourToIztroIndex(rawHour);

  const preliminary = calendar === 'lunar'
    ? astro.byLunar(
        birthDate,
        rawTimeIndex,
        gender,
        isLeapMonth,
        fixLeap,
        'zh-TW'
      )
    : null;

  const solarDateForCorrection =
    calendar === 'lunar'
      ? preliminary.solarDate
      : birthDate;

  const corrected = correctTaiwanTrueSolarTime({
    date: solarDateForCorrection,
    time: birthTime,
    longitude
  });

  const [correctedHour] = corrected.corrected.time
    .split(':')
    .map(Number);

  const timeIndex = hourToIztroIndex(correctedHour);

  const [y, m, d] = corrected.corrected.date
    .split('-')
    .map(Number);

  const normalizedDate =
    `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

  const astrolabe = astro.bySolar(
    normalizedDate,
    timeIndex,
    gender,
    fixLeap,
    'zh-TW'
  );

  const chart = typeof astrolabe.toJSON === 'function'
    ? astrolabe.toJSON()
    : astrolabe;

  const taiwanDate = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Taipei',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(new Date());

  // 未指定流時時，固定採用午時（iztro 索引 6）。
  const horoscopeDate = targetDate || taiwanDate;
  const horoscopeTimeIndex = 6;

  const horoscope = astrolabe.horoscope(
    horoscopeDate,
    horoscopeTimeIndex
  );

  const horoscopeJSON =
    typeof horoscope.toJSON === 'function'
      ? horoscope.toJSON()
      : horoscope;

  return {
    meta: {
      engine: 'iztro',
      language: 'zh-TW',
      timezone: 'Asia/Taipei',
      calendarInput: calendar,
      solarTimeCorrection: corrected,
      timeIndex,
      timeIndexMeaning:
        timeIndex === 0
          ? '早子時'
          : timeIndex === 12
            ? '晚子時'
            : '依 iztro 0–12 時辰索引',
      horoscopeDate,
      horoscopeTimeIndex,
      horoscopeTimeMeaning: '午時（12:00，預設）'
    },

    birth: {
      gender,
      originalDate: birthDate,
      originalTime: birthTime,
      chartDate: chart.solarDate,
      lunarDate: chart.lunarDate,
      chineseDate: chart.chineseDate,
      time: chart.time,
      timeRange: chart.timeRange
    },

    core: {
      sign: chart.sign,
      zodiac: chart.zodiac,
      soulPalaceBranch: chart.earthlyBranchOfSoulPalace,
      bodyPalaceBranch: chart.earthlyBranchOfBodyPalace,
      soulStar: chart.soul,
      bodyStar: chart.body,
      fiveElementsClass: chart.fiveElementsClass
    },

    palaces: (chart.palaces || []).map(cleanPalace),

    threeDirections: Object.fromEntries(
      (chart.palaces || []).map(p => {
        const surrounded = astrolabe.surroundedPalaces(p.name);

        return [
          p.name,
          {
            target: cleanPalace(surrounded.target),
            opposite: cleanPalace(surrounded.opposite),
            wealth: cleanPalace(surrounded.wealth),
            career: cleanPalace(surrounded.career)
          }
        ];
      })
    ),

    horoscope: horoscopeJSON,

    dataNotes: [
      'iztro 原始星曜類型與亮度依引擎輸出；亮度空值代表引擎未提供，不自行補值。',
      '四化標記保留在各星曜 mutagen 欄位；宮干飛化等延伸判讀應以來源宮干及引擎資料再計算。',
      '歲前、將前、長生、博士神煞分別保存在各宮 shenSha 欄位。',
      '本工具提供盤面資料及基礎結構整理，不將格局判定或吉凶斷語偽裝成引擎原始資料。'
    ]
  };
}

export function getPalaceData(chartData, palaceName) {
  const palace = chartData.palaces.find(
    p => p.name === palaceName ||
      `${p.name}宮` === palaceName
  );

  if (!palace) {
    throw new Error(`找不到宮位：${palaceName}`);
  }

  return palace;
}

export function getThreeDirections(chartData, palaceName) {
  const normalizedName = palaceName.endsWith('宮')
    ? palaceName.slice(0, -1)
    : palaceName;

  const fullName = `${normalizedName}宮`;

  const result =
    chartData.threeDirections[fullName] ||
    chartData.threeDirections[normalizedName];

  if (!result) {
    throw new Error(`找不到宮位或三方四正資料：${palaceName}`);
  }

  return result;
}

export function getMutagens(chartData) {
  return chartData.palaces.flatMap(palace =>
    (palace.fourTransformations || []).map(star => ({
      palace: palace.name,
      star: star.name,
      mutagen: star.mutagen,
      scope: star.scope
    }))
  );
}
