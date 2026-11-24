/* ============================================================
 * 월령 · 사주 계산 엔진 (saju-core.js)
 * 의존성 없음. 브라우저 / Node / quickjs 모두에서 동작.
 *
 *  - 년주: 입춘(節入) 기준 절기력
 *  - 월주: 24절기 중 12절(節) 시각 기준 + 五虎遁
 *  - 일주: 율리우스일(JDN) 기반 60갑자 순환
 *  - 시주: 日上起時法(五鼠遁)
 *  - 절입 시각: solar-terms.js (KST, 1920~2040, 천문 계산)
 * ============================================================ */
(function (root) {
  'use strict';

  var GAN = [
    { h: '갑', han: '甲', el: '목', yang: true },
    { h: '을', han: '乙', el: '목', yang: false },
    { h: '병', han: '丙', el: '화', yang: true },
    { h: '정', han: '丁', el: '화', yang: false },
    { h: '무', han: '戊', el: '토', yang: true },
    { h: '기', han: '己', el: '토', yang: false },
    { h: '경', han: '庚', el: '금', yang: true },
    { h: '신', han: '辛', el: '금', yang: false },
    { h: '임', han: '壬', el: '수', yang: true },
    { h: '계', han: '癸', el: '수', yang: false }
  ];

  var JI = [
    { h: '자', han: '子', el: '수', yang: true, animal: '쥐' },
    { h: '축', han: '丑', el: '토', yang: false, animal: '소' },
    { h: '인', han: '寅', el: '목', yang: true, animal: '호랑이' },
    { h: '묘', han: '卯', el: '목', yang: false, animal: '토끼' },
    { h: '진', han: '辰', el: '토', yang: true, animal: '용' },
    { h: '사', han: '巳', el: '화', yang: false, animal: '뱀' },
    { h: '오', han: '午', el: '화', yang: true, animal: '말' },
    { h: '미', han: '未', el: '토', yang: false, animal: '양' },
    { h: '신', han: '申', el: '금', yang: true, animal: '원숭이' },
    { h: '유', han: '酉', el: '금', yang: false, animal: '닭' },
    { h: '술', han: '戌', el: '토', yang: true, animal: '개' },
    { h: '해', han: '亥', el: '수', yang: false, animal: '돼지' }
  ];

  var ELEMENTS = ['목', '화', '토', '금', '수'];
  var ELEMENT_HAN = { 목: '木', 화: '火', 토: '土', 금: '金', 수: '水' };

  /* 월지 순서: 인월 = 0 … 축월 = 11 */
  var MONTH_ORDER_JI = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 0, 1];
  var MONTH_ORDER_NAME = ['인월', '묘월', '진월', '사월', '오월', '미월',
    '신월', '유월', '술월', '해월', '자월', '축월'];

  /* 절입 테이블 순서(소한,입춘,…,대설) → [월지순서, 년도보정] */
  var TERM_TO_MONTH = [
    { order: 11, yearShift: -1 }, // 소한
    { order: 0, yearShift: 0 },   // 입춘
    { order: 1, yearShift: 0 },   // 경칩
    { order: 2, yearShift: 0 },   // 청명
    { order: 3, yearShift: 0 },   // 입하
    { order: 4, yearShift: 0 },   // 망종
    { order: 5, yearShift: 0 },   // 소서
    { order: 6, yearShift: 0 },   // 입추
    { order: 7, yearShift: 0 },   // 백로
    { order: 8, yearShift: 0 },   // 한로
    { order: 9, yearShift: 0 },   // 입동
    { order: 10, yearShift: 0 }   // 대설
  ];

  var KST_OFFSET_MIN = 9 * 60;
  var DAY_MS = 86400000;

  /* ---------- 유틸 ---------- */

  function pad(n) { return (n < 10 ? '0' : '') + n; }

  /* 율리우스일 (그레고리력, 그 날의 정수 JDN) */
  function jdn(y, m, d) {
    var a = Math.floor((14 - m) / 12);
    var yy = y + 4800 - a;
    var mm = m + 12 * a - 3;
    return d + Math.floor((153 * mm + 2) / 5) + 365 * yy + Math.floor(yy / 4)
      - Math.floor(yy / 100) + Math.floor(yy / 400) - 32045;
  }

  /* KST 벽시계 → 절대 시각(ms) */
  function kstToMs(y, m, d, hh, mm) {
    return Date.UTC(y, m - 1, d, hh, mm) - KST_OFFSET_MIN * 60000;
  }

  /* "MMDDTHH:MM" (KST) → 절대 시각(ms) */
  function parseTerm(str, year) {
    var mm = +str.substr(0, 2);
    var dd = +str.substr(2, 2);
    var hh = +str.substr(5, 2);
    var mi = +str.substr(8, 2);
    return kstToMs(year, mm, dd, hh, mi);
  }

  function getTable() {
    if (root.SOLAR_TERMS) return root.SOLAR_TERMS;
    if (typeof require === 'function') return require('./solar-terms.js').SOLAR_TERMS;
    return null;
  }

  /* ---------- 60갑자 ---------- */

  function ganjiName(idx) {
    idx = ((idx % 60) + 60) % 60;
    return GAN[idx % 10].h + JI[idx % 12].h;
  }
  function ganjiHan(idx) {
    idx = ((idx % 60) + 60) % 60;
    return GAN[idx % 10].han + JI[idx % 12].han;
  }

  /* ---------- 오행 / 십성 ---------- */

  function elOfGan(i) { return GAN[i % 10].el; }
  function elOfJi(i) { return JI[i % 12].el; }

  function saeng(a, b) { /* a가 b를 생하는가 */
    return (a === '목' && b === '화') || (a === '화' && b === '토') ||
      (a === '토' && b === '금') || (a === '금' && b === '수') || (a === '수' && b === '목');
  }
  function geuk(a, b) { /* a가 b를 극하는가 */
    return (a === '목' && b === '토') || (a === '토' && b === '수') ||
      (a === '수' && b === '화') || (a === '화' && b === '금') || (a === '금' && b === '목');
  }

  /* 십성: 일간(dayGan)에 대한 대상 간(ganIdx)의 관계 */
  function sipsung(dayGan, targetGan) {
    var meEl = elOfGan(dayGan);
    var tgEl = elOfGan(targetGan);
    var same = GAN[dayGan % 10].yang === GAN[targetGan % 10].yang;
    if (meEl === tgEl) return same ? '비견' : '겁재';
    if (saeng(tgEl, meEl)) return same ? '편인' : '정인';
    if (saeng(meEl, tgEl)) return same ? '식신' : '상관';
    if (geuk(meEl, tgEl)) return same ? '편재' : '정재';
    if (geuk(tgEl, meEl)) return same ? '편관' : '정관';
    return '비견';
  }

  /* 지지 자체의 오행 기준 십성 (지지 표기용) */
  function sipsungJi(dayGan, jiIdx) {
    var meEl = elOfGan(dayGan);
    var tgEl = elOfJi(jiIdx);
    var same = GAN[dayGan % 10].yang === JI[jiIdx % 12].yang;
    if (meEl === tgEl) return same ? '비견' : '겁재';
    if (saeng(tgEl, meEl)) return same ? '편인' : '정인';
    if (saeng(meEl, tgEl)) return same ? '식신' : '상관';
    if (geuk(meEl, tgEl)) return same ? '편재' : '정재';
    if (geuk(tgEl, meEl)) return same ? '편관' : '정관';
    return '비견';
  }

  /* ---------- 지지 관계 ---------- */

  var CHUNG = [[0, 6], [1, 7], [2, 8], [3, 9], [4, 10], [5, 11]]; /* 자오 축미 인신 묘유 진술 사해 */
  var HAP_YUK = [[0, 1], [2, 11], [3, 10], [4, 9], [5, 8], [6, 7]]; /* 자축 인해 묘술 진유 사신 오미 */
  var PA = [[0, 9], [1, 4], [2, 11], [3, 6], [5, 8], [7, 10]]; /* 자유 축진 인해 묘오 사신 미술 */
  var HAE = [[0, 7], [1, 6], [2, 5], [3, 4], [8, 11], [9, 10]]; /* 자미 축오 인사 묘진 신해 유술 */
  var HYUNG = [ /* 형 */
    [2, 5], [5, 8], [8, 2], /* 인사신 삼형 */
    [1, 10], [10, 7], [7, 1], /* 축술미 삼형 */
    [0, 3], /* 자묘 */
    [4, 4], [6, 6], [9, 9], [11, 11] /* 진진 오오 유유 해해 자형 */
  ];

  function hasPair(list, a, b) {
    a = ((a % 12) + 12) % 12; b = ((b % 12) + 12) % 12;
    for (var i = 0; i < list.length; i++) {
      if ((list[i][0] === a && list[i][1] === b) || (list[i][0] === b && list[i][1] === a)) return true;
    }
    return false;
  }

  function relation(a, b) {
    var out = [];
    if (hasPair(CHUNG, a, b)) out.push('충');
    if (hasPair(HAP_YUK, a, b)) out.push('합');
    if (hasPair(HYUNG, a, b)) out.push('형');
    if (hasPair(PA, a, b)) out.push('파');
    if (hasPair(HAE, a, b)) out.push('해');
    return out;
  }

  /* ---------- 절기 ---------- */

  function termList(table, fromYear, toYear) {
    var list = [];
    for (var y = fromYear; y <= toYear; y++) {
      var arr = table[String(y)];
      if (!arr) continue;
      for (var i = 0; i < 12; i++) {
        var m = TERM_TO_MONTH[i];
        list.push({
          ts: parseTerm(arr[i], y),
          year: y,
          termIndex: i,
          order: m.order,
          sajuYear: y + m.yearShift
        });
      }
    }
    list.sort(function (a, b) { return a.ts - b.ts; });
    return list;
  }

  /* ---------- 한국 서머타임 (1987~1988) ---------- */
  function dstApplied(y, mo, d, hh) {
    if (y === 1987) {
      if ((mo > 5 || (mo === 5 && d >= 10)) && (mo < 10 || (mo === 10 && d <= 11))) return true;
    }
    if (y === 1988) {
      if ((mo > 5 || (mo === 5 && d >= 8)) && (mo < 10 || (mo === 10 && d <= 9))) return true;
    }
    return false;
  }

  /* ---------- 시주 ---------- */
  function hourBranchIndex(hh, mm) {
    /* 자시 23:00~00:59, 축시 01:00~02:59 … */
    var t = (hh * 60 + mm + 60) % 1440; /* 23:00 → 0 */
    return Math.floor(t / 120) % 12;
  }

  /* ---------- 본 계산 ---------- */
  function compute(opt) {
    var y = opt.year, mo = opt.month, d = opt.day;
    var hh = (opt.hour == null ? 12 : opt.hour);
    var mi = (opt.minute == null ? 0 : opt.minute);
    var timeUnknown = !!opt.timeUnknown || opt.hour == null;
    var notes = [];

    /* 서머타임 보정 */
    var dstFix = false;
    if (opt.applyDST !== false && !timeUnknown && dstApplied(y, mo, d, hh)) {
      var t0 = hh * 60 + mi - 60;
      if (t0 < 0) t0 += 1440;
      hh = Math.floor(t0 / 60); mi = t0 % 60;
      dstFix = true;
      notes.push('1987~1988년 서머타임 기간이라 시계 시각에서 1시간을 되돌려 계산했습니다.');
    }

    var birthTs = kstToMs(y, mo, d, hh, mi);
    var table = getTable();
    if (!table) throw new Error('절기 테이블을 불러오지 못했습니다.');
    if (!table[String(y)]) throw new Error('지원 범위를 벗어난 연도입니다 (1920~2040).');

    var terms = termList(table, y - 1, y + 1);
    var cur = null, next = null;
    for (var i = 0; i < terms.length; i++) {
      if (terms[i].ts <= birthTs) cur = terms[i];
      else { next = terms[i]; break; }
    }
    if (!cur) throw new Error('절기 데이터 범위를 벗어난 날짜입니다 (1920~2040년).');

    /* 년주 */
    var sajuYear = cur.sajuYear;
    var yearGan = ((sajuYear - 4) % 10 + 10) % 10;
    var yearJi = ((sajuYear - 4) % 12 + 12) % 12;

    /* 월주 */
    var monthOrder = cur.order;
    var monthGan = (yearGan * 2 + 2 + monthOrder) % 10;
    var monthJi = MONTH_ORDER_JI[monthOrder];

    /* 일주 */
    var dayIdx = ((jdn(y, mo, d) + 49) % 60 + 60) % 60;
    var dayGan = dayIdx % 10;
    var dayJi = dayIdx % 12;

    /* 시주 */
    var hour = null;
    if (!timeUnknown) {
      var hJi = hourBranchIndex(hh, mi);
      var hGan = ((dayGan % 5) * 2 + hJi) % 10;
      hour = {
        gan: hGan, ji: hJi,
        ganH: GAN[hGan].h, ganHan: GAN[hGan].han,
        jiH: JI[hJi].h, jiHan: JI[hJi].han,
        name: GAN[hGan].h + JI[hJi].h,
        han: GAN[hGan].han + JI[hJi].han,
        sipsungGan: sipsung(dayGan, hGan),
        sipsungJi: sipsungJi(dayGan, hJi),
        elGan: GAN[hGan].el, elJi: JI[hJi].el
      };
    }

    var pillars = {
      year: {
        gan: yearGan, ji: yearJi,
        ganH: GAN[yearGan].h, ganHan: GAN[yearGan].han,
        jiH: JI[yearJi].h, jiHan: JI[yearJi].han,
        name: GAN[yearGan].h + JI[yearJi].h,
        han: GAN[yearGan].han + JI[yearJi].han,
        sipsungGan: sipsung(dayGan, yearGan),
        sipsungJi: sipsungJi(dayGan, yearJi),
        elGan: GAN[yearGan].el, elJi: JI[yearJi].el
      },
      month: {
        gan: monthGan, ji: monthJi,
        ganH: GAN[monthGan].h, ganHan: GAN[monthGan].han,
        jiH: JI[monthJi].h, jiHan: JI[monthJi].han,
        name: GAN[monthGan].h + JI[monthJi].h,
        han: GAN[monthGan].han + JI[monthJi].han,
        sipsungGan: sipsung(dayGan, monthGan),
        sipsungJi: sipsungJi(dayGan, monthJi),
        elGan: GAN[monthGan].el, elJi: JI[monthJi].el
      },
      day: {
        gan: dayGan, ji: dayJi,
        ganH: GAN[dayGan].h, ganHan: GAN[dayGan].han,
        jiH: JI[dayJi].h, jiHan: JI[dayJi].han,
        name: GAN[dayGan].h + JI[dayJi].h,
        han: GAN[dayGan].han + JI[dayJi].han,
        sipsungGan: '일간',
        sipsungJi: sipsungJi(dayGan, dayJi),
        elGan: GAN[dayGan].el, elJi: JI[dayJi].el
      },
      hour: hour
    };

    /* 오행 분포 */
    var counts = { 목: 0, 화: 0, 토: 0, 금: 0, 수: 0 };
    function add(el) { counts[el] += 1; }
    add(pillars.year.elGan); add(pillars.year.elJi);
    add(pillars.month.elGan); add(pillars.month.elJi);
    add(pillars.day.elGan); add(pillars.day.elJi);
    if (hour) { add(hour.elGan); add(hour.elJi); }

    var total = hour ? 8 : 6;
    var ratio = {};
    /* 백분율은 합이 정확히 100이 되도록 최대잔여법으로 배분 */
    (function () {
      var raw = [], floorSum = 0;
      ELEMENTS.forEach(function (el) {
        var v = counts[el] / total * 100;
        var f = Math.floor(v);
        raw.push({ el: el, v: v, f: f });
        floorSum += f;
      });
      var rest = 100 - floorSum;
      raw.slice().sort(function (a, b) { return (b.v - b.f) - (a.v - a.f); })
        .forEach(function (x, i) { if (i < rest) x.f += 1; });
      raw.forEach(function (x) { ratio[x.el] = x.f; });
    })();

    return {
      input: {
        year: y, month: mo, day: d,
        hour: timeUnknown ? null : hh,
        minute: timeUnknown ? null : mi,
        timeUnknown: timeUnknown,
        gender: opt.gender || null,
        dstFixed: dstFix
      },
      birthTs: birthTs,
      sajuYear: sajuYear,
      monthOrder: monthOrder,
      monthName: MONTH_ORDER_NAME[monthOrder],
      monthOrderText: MONTH_ORDER_NAME[monthOrder],
      pillarName: pillars,
      // 편의 별칭
      yearPillar: pillars.year,
      monthPillar: pillars.month,
      dayPillar: pillars.day,
      hourPillar: pillars.hour,
      dayGan: dayGan,
      dayJi: dayJi,
      dayIndex: dayIdx,
      counts: counts,
      ratio: ratio,
      total,
      currentTerm: cur,
      nextTerm: next,
      notes: notes,
      // 8글자 문자열 (시주 미상이면 6글자)
      text: pillars.year.name + ' ' + pillars.month.name + ' ' + pillars.day.name +
        (hour ? ' ' + hour.name : ''),
      hanja: pillars.year.han + ' ' + pillars.month.han + ' ' + pillars.day.han +
        (hour ? ' ' + hour.han : '')
    };
  }

  /* 특정 연도의 월별 간지(절기 구간 기준) — 세운·월운 분석용 */
  function yearlyMonths(sajuYear) {
    var out = [];
    for (var o = 0; o < 12; o++) {
      /* 자월(10)·축월(11)도 같은 사주년(입춘~다음 입춘)의 간지를 기준으로 한다 */
      var yearGan = ((sajuYear - 4) % 10 + 10) % 10;
      var gan = (yearGan * 2 + 2 + o) % 10;
      var ji = MONTH_ORDER_JI[o];
      out.push({
        order: o,
        name: MONTH_ORDER_NAME[o],
        gan: gan, ji: ji,
        ganH: GAN[gan].h, ganHan: GAN[gan].han,
        jiH: JI[ji].h, jiHan: JI[ji].han,
        label: GAN[gan].h + JI[ji].h
      });
    }
    return out;
  }

  /* 입춘~다음 입춘 구간의 월별 절기 시각 (표시용) */
  function monthRanges(sajuYear) {
    var table = getTable();
    var arr = [];
    var y = sajuYear;
    for (var o = 0; o < 12; o++) {
      var termIdx = o + 1;          /* 입춘(1)부터 */
      var ty = y;
      if (termIdx > 11) { termIdx = 0; ty = y + 1; } /* 다음 해 소한 */
      var cur = table[String(ty)][termIdx];
      var nextIdx = termIdx + 1, ny = ty;
      if (nextIdx > 11) { nextIdx = 0; ny = ty + 1; }
      var nxt = table[String(ny)][nextIdx];
      arr.push({ start: cur, end: nxt, startYear: ty, endYear: ny, order: o });
    }
    return arr;
  }

  /* ============================================================
   * 오행 관계 · 신강/신약 · 대운(大運)
   * ============================================================ */

  var PRODUCES = { 목: '화', 화: '토', 토: '금', 금: '수', 수: '목' };
  var CONTROLS = { 목: '토', 토: '수', 수: '화', 화: '금', 금: '목' };

  function inverseOf(map, target) {
    for (var k in map) { if (map[k] === target) return k; }
    return null;
  }
  /* 일간 오행 기준 십성 오행 */
  function inElement(el) { return inverseOf(PRODUCES, el); }   /* 인성 */
  function outElement(el) { return PRODUCES[el]; }             /* 식상 */
  function jaeElement(el) { return CONTROLS[el]; }             /* 재성 */
  function gwanElement(el) { return inverseOf(CONTROLS, el); } /* 관성 */

  /* 어떤 오행이 일간에게 어떤 세력인지 */
  function kindOf(dayEl, el) {
    if (el === dayEl) return 'bi';
    if (saeng(el, dayEl)) return 'in';
    if (saeng(dayEl, el)) return 'sik';
    if (geuk(dayEl, el)) return 'jae';
    return 'gwan';
  }

  /* 자리별 비중(총 100) — 월령을 가장 무겁게, 그다음 일지·월간 */
  var POS_W = { yearGan: 9, yearJi: 10, monthGan: 15, monthJi: 30, dayJi: 15, hourGan: 11, hourJi: 10 };
  /* 세력별 힘의 정도: 비겁·재성은 그대로, 인성은 약간 덜, 관성은 약간 더 */
  var KIND_FACTOR = { bi: 1, in: 0.95, sik: 0.9, jae: 1, gwan: 1.15 };

  /* 신강/신약: 득령(월지)·득지(일지)·득세(주변 세력)를 점수화 */
  function strength(core) {
    var p = core.pillarName;
    var dayEl = GAN[core.dayGan].el;
    var rows = [
      { name: '년간', el: p.year.elGan, w: POS_W.yearGan },
      { name: '년지', el: p.year.elJi, w: POS_W.yearJi },
      { name: '월간', el: p.month.elGan, w: POS_W.monthGan },
      { name: '월지', el: p.month.elJi, w: POS_W.monthJi },
      { name: '일지', el: p.day.elJi, w: POS_W.dayJi }
    ];
    if (p.hour) {
      rows.push({ name: '시간', el: p.hour.elGan, w: POS_W.hourGan });
      rows.push({ name: '시지', el: p.hour.elJi, w: POS_W.hourJi });
    }

    var support = 0, drain = 0, detail = [];
    rows.forEach(function (r) {
      var kind = kindOf(dayEl, r.el);
      var pts = r.w * KIND_FACTOR[kind];
      if (kind === 'bi' || kind === 'in') support += pts;
      else drain += pts;
      detail.push({
        name: r.name, el: r.el, kind: kind, weight: r.w,
        points: Math.round(pts * 10) / 10
      });
    });

    var ratio = Math.round(support / (support + drain) * 100);
    var label, level;
    if (ratio >= 70) { label = '신강'; level = '태강'; }
    else if (ratio >= 58) { label = '신강'; level = '신강'; }
    else if (ratio > 42) { label = '중화'; level = '중화'; }
    else if (ratio > 30) { label = '신약'; level = '신약'; }
    else { label = '신약'; level = '태약'; }

    var inEl = inElement(dayEl), sikEl = outElement(dayEl);
    var jaeEl = jaeElement(dayEl), gwanEl = gwanElement(dayEl);
    var counts = core.counts;
    var groups = {
      bi: counts[dayEl] || 0,
      in: counts[inEl] || 0,
      sik: counts[sikEl] || 0,
      jae: counts[jaeEl] || 0,
      gwan: counts[gwanEl] || 0
    };

    var deukryeong = (kindOf(dayEl, p.month.elJi) === 'bi' || kindOf(dayEl, p.month.elJi) === 'in');
    var deukji = (kindOf(dayEl, p.day.elJi) === 'bi' || kindOf(dayEl, p.day.elJi) === 'in');
    var deukse = (groups.bi - 1 + groups.in) >= 3;

    return {
      dmEl: dayEl,
      el: { bi: dayEl, in: inEl, sik: sikEl, jae: jaeEl, gwan: gwanEl },
      groups: groups,
      support: Math.round(support * 10) / 10,
      drain: Math.round(drain * 10) / 10,
      ratio: ratio,
      label: label,
      level: level,
      deukryeong: deukryeong,
      deukji: deukji,
      deukse: deukse,
      detail: detail
    };
  }

  /* ---------- 대운 ---------- */

  function pillarIndex(p) {
    for (var i = 0; i < 60; i++) { if (i % 10 === p.gan && i % 12 === p.ji) return i; }
    return 0;
  }

  /* 만 나이 (UTC 기준 날짜 비교) */
  function ageOn(input, when) {
    var y = when.getUTCFullYear(), m = when.getUTCMonth() + 1, d = when.getUTCDate();
    var age = y - input.year;
    if (m < input.month || (m === input.month && d < input.day)) age -= 1;
    return age < 0 ? 0 : age;
  }

  /* 순행(陽男·陰女) / 역행(陰男·陽女) + 절입일 차이로 대운수 계산 */
  function daeun(core, opt) {
    opt = opt || {};
    var gender = opt.gender || (core.input && core.input.gender) || 'f';
    var yearYang = !!GAN[core.yearPillar.gan].yang;
    var forward = (yearYang && gender === 'm') || (!yearYang && gender === 'f');
    var days = forward
      ? (core.nextTerm.ts - core.birthTs) / DAY_MS
      : (core.birthTs - core.currentTerm.ts) / DAY_MS;
    var yearsExact = days / 3;              /* 3일 = 1년 */
    var startAge = Math.max(1, Math.round(yearsExact));
    var base = pillarIndex(core.monthPillar);
    var dir = forward ? 1 : -1;
    var list = [];
    for (var i = 0; i < 8; i++) {
      var idx = ((base + dir * (i + 1)) % 60 + 60) % 60;
      var g = idx % 10, j = idx % 12;
      list.push({
        no: i + 1,
        startAge: startAge + i * 10,
        endAge: startAge + i * 10 + 9,
        startYear: core.input.year + startAge + i * 10,
        gan: g, ji: j,
        ganH: GAN[g].h, jiH: JI[j].h,
        label: GAN[g].h + JI[j].h,
        han: GAN[g].han + JI[j].han,
        ganSS: sipsung(core.dayGan, g),
        jiSS: sipsungJi(core.dayGan, j),
        elGan: GAN[g].el, elJi: JI[j].el
      });
    }
    return {
      forward: forward,
      gender: gender,
      dayGap: Math.round(days * 100) / 100,
      yearsExact: Math.round(yearsExact * 100) / 100,
      startAge: startAge,
      list: list
    };
  }

  function currentDaeun(dn, age) {
    for (var i = 0; i < dn.list.length; i++) {
      var d = dn.list[i];
      if (age >= d.startAge && age <= d.endAge) return { index: i, item: d };
    }
    return null;
  }

  var API = {
    GAN: GAN, JI: JI, ELEMENTS: ELEMENTS, ELEMENT_HAN: ELEMENT_HAN,
    MONTH_ORDER_NAME: MONTH_ORDER_NAME,
    compute: compute,
    strength: strength,
    daeun: daeun,
    currentDaeun: currentDaeun,
    ageOn: ageOn,
    kindOf: kindOf,
    inElement: inElement,
    outElement: outElement,
    jaeElement: jaeElement,
    gwanElement: gwanElement,
    yearlyMonths: yearlyMonths,
    monthRanges: monthRanges,
    sipsung: sipsung,
    sipsungJi: sipsungJi,
    relation: relation,
    jdn: jdn,
    ganjiName: ganjiName,
    ganjiHan: ganjiHan,
    hourBranchIndex: hourBranchIndex,
    saeng: saeng,
    geuk: geuk
  };

  root.SajuCore = API;
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));
