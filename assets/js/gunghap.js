/* ============================================================
 * 월령 · 2인 궁합 계산 엔진 (gunghap.js)
 * 의존성 없음(SajuCore만 사용). 브라우저 / Node / quickjs 모두 동작.
 *
 *  - 입력: 두 사람의 사주 원국(SajuCore.compute 결과) + 관계 모드(lover|business)
 *  - 규칙: 명세서(wolryeong-gunghap-spec.md) 2.3 계산 규칙
 *         천간합·충, 지지 육합·삼합·충·형·파·해, 오행 생극, 십성, 용신 보완, 2027 정미년
 *  - 점수: 명세서 2.4 (끌림 30 · 소통 20 · 재물 시너지 25 · 안정 15 · 2027 흐름 10)
 *  - 무작위 없음. 같은 입력이면 언제나 같은 점수·같은 문구.
 *
 *  명세서가 수치를 고정하지 않은 부분(각 축의 가점·감점)은 아래 POINTS에 모았다.
 *  해석 문구는 전부 GUNGHAP_CONTENT(JSON)에서만 가져오고 코드에는 두지 않는다.
 * ============================================================ */
(function (root) {
  'use strict';

  var MAX = { attraction: 30, communication: 20, wealth: 25, stability: 15, flow2027: 10 };

  var POINTS = {
    /* 합·충이 하나도 없는 짝이 각 축의 중간 문구에 닿도록 기본점을 두고,
       천간합·지지합은 크게 올리고 충·형·파·해는 일지 기준으로만 크게 깎는다. */
    attraction: { base: 15, stemHap: 10, stemChung: 2, dayYukhap: 9, daySamhap: 6, extraHap: 1, extraCap: 3 },
    communication: { base: 10, saeng: 8, same: 5, geuk: 2, sikSang: 5, biGyeop: 4 },
    wealth: { base: 14, jae: 7, businessBonus: 5, yongsinFill: 4 },
    stability: { base: 15, dayChung: 5, dayHyeong: 3, dayPa: 2, dayHae: 2, other: 1, otherCap: 5 },
    flow2027: { base: 5, stemHap: 3, stemChung: -3, yukhap: 3, chung: -3, samhap: 2, hyeongPa: -2, hae: -2 }
  };

  var POS = ['년', '월', '일', '시'];
  var MODES = ['lover', 'business'];
  var MODE_LABEL = { lover: '연인', business: '동업자' };
  var MI = 7, JEONG = 3;

  function S() { return root.SajuCore; }
  function C() { return root.GUNGHAP_CONTENT; }

  function clamp(v, lo, hi) { return v < lo ? lo : (v > hi ? hi : v); }
  function normMode(m) { return MODES.indexOf(m) >= 0 ? m : 'lover'; }

  function pillarsOf(core) {
    var p = core.pillarName, out = [];
    ['year', 'month', 'day', 'hour'].forEach(function (k, i) {
      if (p[k]) out.push({ key: k, pos: POS[i], gan: p[k].gan, ji: p[k].ji, name: p[k].name });
    });
    return out;
  }

  function isStemHap(a, b) { return Math.abs(a - b) === 5; }
  function isStemChung(a, b) { return Math.abs(a - b) === 6; }

  function samhapGroupOf(ji) {
    if ([8, 0, 4].indexOf(ji) >= 0) return 0;   /* 신자진 */
    if ([11, 3, 7].indexOf(ji) >= 0) return 1;  /* 해묘미 */
    if ([2, 6, 10].indexOf(ji) >= 0) return 2;  /* 인오술 */
    if ([5, 9, 1].indexOf(ji) >= 0) return 3;   /* 사유축 */
    return -1;
  }
  function isSamhap(a, b) {
    if (a === b) return false;
    var g = samhapGroupOf(a);
    return g >= 0 && g === samhapGroupOf(b);
  }

  /* 두 지지의 관계 — 육합은 SajuCore.relation의 '합' */
  function branchFacts(a, b) {
    var rel = S().relation(a, b);
    return {
      yukhap: rel.indexOf('합') >= 0,
      chung: rel.indexOf('충') >= 0,
      hyeong: rel.indexOf('형') >= 0,
      pa: rel.indexOf('파') >= 0,
      hae: rel.indexOf('해') >= 0,
      samhap: isSamhap(a, b)
    };
  }

  function jiName(i) { return S().JI[i].h; }

  function pairKey(a, b) {
    var G = S().GAN;
    return a < b ? G[a].h + '-' + G[b].h : G[b].h + '-' + G[a].h;
  }

  function findPair(list, key) {
    for (var i = 0; i < list.length; i++) { if (list[i].pair === key) return list[i]; }
    return null;
  }

  function findSamhap(list, a, b) {
    var ha = jiName(a), hb = jiName(b);
    for (var i = 0; i < list.length; i++) {
      var parts = String(list[i].group).split('-');
      if (parts.indexOf(ha) >= 0 && parts.indexOf(hb) >= 0) return list[i];
    }
    return null;
  }

  function axisDef(id) {
    var list = C().axes;
    for (var i = 0; i < list.length; i++) { if (list[i].id === id) return list[i]; }
    return null;
  }

  function axisLevel(id, score) {
    var ax = axisDef(id);
    if (!ax) return { text: '' };
    for (var i = 0; i < ax.levels.length; i++) {
      if (score >= ax.levels[i].min) return ax.levels[i];
    }
    return ax.levels[ax.levels.length - 1];
  }

  function bandOf(score) {
    var list = C().scoreBands;
    for (var i = 0; i < list.length; i++) {
      if (score >= list[i].min && score <= list[i].max) return list[i];
    }
    return list[list.length - 1];
  }

  function weakestElement(core) {
    var els = S().ELEMENTS, best = els[0];
    for (var i = 1; i < els.length; i++) {
      if (core.counts[els[i]] < core.counts[best]) best = els[i];
    }
    return best;
  }
  function strongestElement(core) {
    var els = S().ELEMENTS, best = els[0];
    for (var i = 1; i < els.length; i++) {
      if (core.counts[els[i]] > core.counts[best]) best = els[i];
    }
    return best;
  }

  /* ---------- 두 사람의 관계 사실 ---------- */
  function collect(a, b) {
    var pa = pillarsOf(a), pb = pillarsOf(b);
    var dayPair = null, haps = [], chungs = [], hyeongs = [], pas = [], haes = [];

    pa.forEach(function (x) {
      pb.forEach(function (y) {
        var f = branchFacts(x.ji, y.ji);
        var rec = {
          aPos: x.pos, bPos: y.pos, aJi: x.ji, bJi: y.ji,
          key: pairKey2(x.ji, y.ji), facts: f,
          day: (x.pos === '일' && y.pos === '일')
        };
        if (rec.day) dayPair = rec;
        if (f.yukhap) haps.push({ type: 'yukhap', rec: rec });
        if (f.samhap) haps.push({ type: 'samhap', rec: rec });
        if (f.chung) chungs.push(rec);
        if (f.hyeong) hyeongs.push(rec);
        if (f.pa) pas.push(rec);
        if (f.hae) haes.push(rec);
      });
    });

    return {
      dayGanA: a.dayGan, dayGanB: b.dayGan,
      dayJiA: a.dayJi, dayJiB: b.dayJi,
      stemHap: isStemHap(a.dayGan, b.dayGan),
      stemChung: isStemChung(a.dayGan, b.dayGan),
      dayPair: dayPair,
      haps: haps, chungs: chungs, hyeongs: hyeongs, pas: pas, haes: haes
    };
  }

  function pairKey2(a, b) {
    var ha = jiName(a), hb = jiName(b);
    return a < b ? ha + '-' + hb : hb + '-' + ha;
  }

  /* ---------- 축별 점수 ---------- */

  function scoreAttraction(col) {
    var P = POINTS.attraction, s = P.base;
    if (col.stemHap) s += P.stemHap;
    else if (col.stemChung) s += P.stemChung;

    if (col.dayPair) {
      if (col.dayPair.facts.yukhap) s += P.dayYukhap;
      else if (col.dayPair.facts.samhap) s += P.daySamhap;
    }

    var extra = 0;
    col.haps.forEach(function (h) { if (!h.rec.day) extra += P.extraHap; });
    s += Math.min(extra, P.extraCap);

    return clamp(s, 0, MAX.attraction);
  }

  function scoreCommunication(col) {
    var P = POINTS.communication, s = P.base;
    var SC = S();
    var elA = SC.GAN[col.dayGanA].el, elB = SC.GAN[col.dayGanB].el;

    if (SC.saeng(elA, elB) || SC.saeng(elB, elA)) s += P.saeng;
    else if (elA === elB) s += P.same;
    else s += P.geuk;

    var ab = SC.sipsung(col.dayGanA, col.dayGanB);
    var ba = SC.sipsung(col.dayGanB, col.dayGanA);
    var sik = ['식신', '상관'], bi = ['비견', '겁재'];
    if (sik.indexOf(ab) >= 0 || sik.indexOf(ba) >= 0) s += P.sikSang;
    if (bi.indexOf(ab) >= 0) s += P.biGyeop;

    return clamp(s, 0, MAX.communication);
  }

  function isJae(name) { return name === '정재' || name === '편재'; }

  function scoreWealth(a, b, col, mode) {
    var P = POINTS.wealth, s = P.base, SC = S();
    var ab = SC.sipsung(col.dayGanA, col.dayGanB);
    var ba = SC.sipsung(col.dayGanB, col.dayGanA);

    if (isJae(ab) || isJae(ba)) {
      s += P.jae;
      if (normMode(mode) === 'business') s += P.businessBonus;
    }

    if (strongestElement(b) === weakestElement(a)) s += P.yongsinFill;
    if (strongestElement(a) === weakestElement(b)) s += P.yongsinFill;

    return clamp(s, 0, MAX.wealth);
  }

  /* 안정 — 충·형·파·해. 일지(배우자궁)에 걸린 것은 크게, 다른 기둥끼리는 가볍게 깎는다. */
  function scoreStability(col) {
    var P = POINTS.stability;
    var dayPenalty = 0, otherPenalty = 0;

    col.chungs.forEach(function (c) { if (c.day) dayPenalty += P.dayChung; else otherPenalty += P.other; });
    col.hyeongs.forEach(function (c) { if (c.day) dayPenalty += P.dayHyeong; else otherPenalty += P.other; });
    col.pas.forEach(function (c) { if (c.day) dayPenalty += P.dayPa; else otherPenalty += P.other; });
    col.haes.forEach(function (c) { if (c.day) dayPenalty += P.dayHae; else otherPenalty += P.other; });

    var penalty = dayPenalty + Math.min(otherPenalty, P.otherCap);
    return clamp(P.base - penalty, 0, MAX.stability);
  }

  /* 2027 정미년(丁未)과 한 사람의 일간·일지 */
  function flowOfPerson(core) {
    var P = POINTS.flow2027, s = 0;
    var gan = core.dayGan, ji = core.dayJi;
    if (isStemHap(gan, JEONG)) s += P.stemHap;        /* 정임합 */
    if (isStemChung(gan, JEONG)) s += P.stemChung;    /* 정계충 */
    var f = branchFacts(ji, MI);
    if (f.yukhap) s += P.yukhap;                      /* 오미합 */
    else if (f.chung) s += P.chung;                   /* 축미충 */
    else if (f.samhap) s += P.samhap;                 /* 해묘미 삼합 */
    else if (f.hyeong || f.pa) s += P.hyeongPa;       /* 축술미 형 · 미술 파 */
    else if (f.hae) s += P.hae;                       /* 자미 해 */
    return s;
  }

  function scoreFlow(a, b) {
    return clamp(POINTS.flow2027.base + flowOfPerson(a) + flowOfPerson(b), 0, MAX.flow2027);
  }

  /* ---------- 2027 월별 ---------- */
  /* JSON 12개월 배열에 맞춘 지지: 1월=입춘 전 자월, 2월=인월 … 11월=해월, 12월=대설 자월 */
  var MONTH_JI = [0, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 0];

  function relationName(f) {
    if (f.yukhap) return '육합';
    if (f.samhap) return '삼합';
    if (f.chung) return '충';
    if (f.hyeong) return '형';
    if (f.pa) return '파';
    if (f.hae) return '해';
    return '';
  }

  function monthPersonal(ji, col) {
    var fa = branchFacts(ji, col.dayJiA);
    var fb = branchFacts(ji, col.dayJiB);
    var score = 0;
    [fa, fb].forEach(function (f) {
      if (f.yukhap) score += 3;
      else if (f.samhap) score += 2;
      else if (f.chung) score -= 3;
      else if (f.hyeong || f.pa) score -= 2;
      else if (f.hae) score -= 2;
    });
    return { score: score, a: relationName(fa), b: relationName(fb) };
  }

  function buildMonths(col) {
    var list = C().monthlySynergy2027;
    var r27 = null;
    try { r27 = S().monthRanges(2027); } catch (e) { r27 = null; }

    function fmt(term) {
      if (!term || typeof term !== 'string' || term.length < 4) return '';
      return term.substr(0, 2) + '.' + term.substr(2, 2);
    }

    return list.map(function (m) {
      var ji = MONTH_JI[(m.month - 1) % 12];
      var per = monthPersonal(ji, col);
      var order = m.month === 1 ? 10 : m.month - 2;
      var range = m.month === 1 ? null : (r27 && r27[order]);
      var rangeText = '';
      if (m.month === 1) {
        /* 1월은 입춘 전 구간 — 달력 1월 1일부터 입춘까지 */
        rangeText = r27 ? ('01.01 – ' + fmt(r27[0].start)) : '';
      } else if (range) {
        rangeText = fmt(range.start) + ' – ' + fmt(range.end);
      }
      return {
        no: m.month, label: m.label, grade: m.grade, comment: m.comment,
        ji: ji, jiName: jiName(ji), range: rangeText, personal: per
      };
    });
  }

  function bestGoodMonth(months) {
    var goods = months.filter(function (m) { return m.grade === '좋음'; });
    var pool = goods.length ? goods : months.slice();
    return pool.slice().sort(function (x, y) {
      if (y.personal.score !== x.personal.score) return y.personal.score - x.personal.score;
      return x.no - y.no;
    })[0];
  }

  /* ---------- 조합 해석 ---------- */
  function buildLinks(col) {
    var K = C();
    var out = { stem: null, stemNone: K.stemCombinations.none, branches: [] };
    var index = {};

    if (col.stemHap) out.stem = findPair(K.stemCombinations.he, pairKey(col.dayGanA, col.dayGanB));
    else if (col.stemChung) out.stem = findPair(K.stemCombinations.chung, pairKey(col.dayGanA, col.dayGanB));

    col.haps.forEach(function (h) {
      var rec = h.rec, entry = null;
      if (h.type === 'yukhap') entry = findPair(K.branchCombinations.yukhap, rec.key);
      else entry = findSamhap(K.branchCombinations.samhap, rec.aJi, rec.bJi);
      if (!entry) return;
      var where = 'A ' + rec.aPos + '지 · B ' + rec.bPos + '지';
      if (index[entry.title]) {
        index[entry.title].where += ' / ' + where;
        index[entry.title].day = index[entry.title].day || rec.day;
        return;
      }
      var item = { title: entry.title, text: entry.text, day: rec.day, where: where };
      index[entry.title] = item;
      out.branches.push(item);
    });

    /* 일지끼리 걸린 합을 먼저 보여준다 */
    out.branches.sort(function (x, y) { return (y.day ? 1 : 0) - (x.day ? 1 : 0); });
    return out;
  }

  function buildClashes(col) {
    var K = C();
    var chungList = col.chungs.map(function (c) {
      var e = findPair(K.branchCombinations.chung, c.key);
      return {
        pair: pairKey2(c.aJi, c.bJi),
        title: e ? e.title : null,
        text: e ? e.text : null,
        where: 'A ' + c.aPos + '지 · B ' + c.bPos + '지',
        day: c.day
      };
    });
    var etc = [];
    function push(kind, c) { etc.push({ kind: kind, pair: pairKey2(c.aJi, c.bJi), where: 'A ' + c.aPos + '지 · B ' + c.bPos + '지' }); }
    col.hyeongs.forEach(function (c) { push('형', c); });
    col.pas.forEach(function (c) { push('파', c); });
    col.haes.forEach(function (c) { push('해', c); });

    return {
      chung: chungList,
      etc: etc,
      general: K.branchCombinations.hyeongPaHae,
      stemText: col.stemChung ? findPair(K.stemCombinations.chung, pairKey(col.dayGanA, col.dayGanB)) : null
    };
  }

  function buildAdvice(col, mode) {
    var K = C(), SC = S(), out = [];
    var elA = SC.GAN[col.dayGanA].el, elB = SC.GAN[col.dayGanB].el;
    var geuk = elA !== elB && (SC.geuk(elA, elB) || SC.geuk(elB, elA));

    K.conflictAdvice.forEach(function (a) {
      if (a.type === '천간충' && col.stemChung) out.push(a);
      else if (a.type === '지지충' && col.chungs.length) out.push(a);
      else if (a.type === '오행상극' && geuk) out.push(a);
      else if (a.type === '형·파·해' && (col.hyeongs.length || col.pas.length || col.haes.length)) out.push(a);
      else if (a.type === '재물' && normMode(mode) === 'business') out.push(a);
    });

    if (!out.length) {
      K.conflictAdvice.forEach(function (a) { if (a.type === '재물') out.push(a); });
    }
    return out;
  }

  /* ---------- 리포트 조립 ---------- */
  function buildReport(a, b, mode) {
    mode = normMode(mode);
    var K = C(), SC = S(), col = collect(a, b);

    var raw = {
      attraction: scoreAttraction(col),
      communication: scoreCommunication(col),
      wealth: scoreWealth(a, b, col, mode),
      stability: scoreStability(col),
      flow2027: scoreFlow(a, b)
    };

    var axes = K.axes.map(function (ax) {
      var s = raw[ax.id], lv = axisLevel(ax.id, s);
      return {
        id: ax.id, name: ax.name, score: s, max: ax.maxScore,
        percent: Math.round(s / ax.maxScore * 100),
        text: lv.text
      };
    });

    var total = 0;
    axes.forEach(function (x) { total += x.score; });
    total = Math.floor(clamp(total, 0, 100));

    var band = bandOf(total);
    var months = buildMonths(col);
    var sAB = SC.sipsung(col.dayGanA, col.dayGanB);
    var sBA = SC.sipsung(col.dayGanB, col.dayGanA);
    var tg = K.tenGods[mode] || {};

    return {
      mode: mode,
      modeLabel: MODE_LABEL[mode],
      score: total,
      band: { title: band.title, summary: band.summary, advice: band.advice },
      axes: axes,
      months: months,
      goodMonth: bestGoodMonth(months),
      tenGod: {
        nameAB: sAB, textAB: tg[sAB] || '',
        nameBA: sBA, textBA: tg[sBA] || ''
      },
      links: buildLinks(col),
      clashes: buildClashes(col),
      advice: buildAdvice(col, mode),
      closing: K.closing[mode],
      yongsin: {
        a: weakestElement(a), b: weakestElement(b),
        strongA: strongestElement(a), strongB: strongestElement(b)
      },
      share: String(K.paywall.shareText)
        .replace('{score}', String(total))
        .replace('{bandTitle}', band.title),
      disclaimer: K.meta.disclaimer
    };
  }

  /* 무료 미리보기 — 명세서 4번: 총점·구간 타이틀·끌림 축 요약·좋은 달 1개만 */
  function freePreview(res) {
    var attraction = null;
    res.axes.forEach(function (x) { if (x.id === 'attraction') attraction = x; });
    return {
      score: res.score,
      bandTitle: res.band.title,
      attractionName: attraction ? attraction.name : '',
      attractionText: attraction ? attraction.text : '',
      goodMonth: {
        no: res.goodMonth.no,
        label: res.goodMonth.label,
        grade: res.goodMonth.grade,
        comment: res.goodMonth.comment,
        range: res.goodMonth.range || ''
      }
    };
  }

  var PAID_AXES = ['communication', 'wealth', 'stability', 'flow2027'];
  function isPaidAxis(id) { return PAID_AXES.indexOf(id) >= 0; }

  function coreOf(opt) {
    return S().compute({
      year: opt.year, month: opt.month, day: opt.day,
      hour: opt.timeUnknown ? null : opt.hour,
      minute: opt.timeUnknown ? null : opt.minute,
      timeUnknown: !!opt.timeUnknown,
      gender: opt.gender || null,
      applyDST: opt.applyDST !== false
    });
  }

  function fromBirth(aOpt, bOpt, mode) {
    var a = coreOf(aOpt), b = coreOf(bOpt);
    var res = buildReport(a, b, mode);
    res.cores = { a: a, b: b };
    return res;
  }

  var API = {
    MAX: MAX, POINTS: POINTS, MODES: MODES, MODE_LABEL: MODE_LABEL, MONTH_JI: MONTH_JI,
    analyze: buildReport,
    fromBirth: fromBirth,
    freePreview: freePreview,
    isPaidAxis: isPaidAxis,
    PAID_AXES: PAID_AXES,
    bandOf: bandOf,
    axisLevel: axisLevel,
    weakestElement: weakestElement,
    strongestElement: strongestElement,
    monthPersonal: monthPersonal,
    branchFacts: branchFacts,
    isSamhap: isSamhap,
    isStemHap: isStemHap,
    isStemChung: isStemChung
  };

  root.Gunghap = API;
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));
