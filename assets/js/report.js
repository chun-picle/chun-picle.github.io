/* ============================================================
 * 월령 · 리포트 생성기 (report.js)
 * 사주 원국 + 해석 콘텐츠 → 화면용 리포트 객체
 * ============================================================ */
(function (root) {
  'use strict';

  var C = root.CONTENT;
  var S = root.SajuCore;

  var DIR_NAME = ['북', '북북동', '동북동', '동', '동남동', '남남동',
    '남', '남남서', '서남서', '서', '서북서', '북북서'];

  var CHEONEUL = [[1, 7], [0, 8], [11, 9], [11, 9], [1, 7], [0, 8], [1, 7], [2, 6], [3, 5], [3, 5]];

  var BASE_SCORE = {
    비견: 0.2, 겁재: -1.0, 식신: 1.5, 상관: 0.0,
    편재: 2.2, 정재: 2.0, 편관: -1.4, 정관: 1.2,
    편인: -0.4, 정인: 1.0
  };
  var REL_ADJ = { 합: 1.0, 충: -1.4, 형: -0.9, 파: -0.5, 해: -0.6 };

  function firstSentence(s) {
    var i = s.indexOf('. ');
    return i > 0 ? s.slice(0, i + 1) : s;
  }

  function gradeOf(score) {
    if (score >= 3.0) return 5;
    if (score >= 1.7) return 4;
    if (score >= 0.5) return 3;
    if (score >= -0.8) return 2;
    return 1;
  }

  function relText(a, b) {
    return S.relation(a, b);
  }

  /* ---------- 원국 십성 집계 ---------- */
  function sipsungMap(core) {
    var p = core.pillarName;
    var map = { 비견: 0, 겁재: 0, 식신: 0, 상관: 0, 편재: 0, 정재: 0, 편관: 0, 정관: 0, 편인: 0, 정인: 0 };
    var positions = [
      { key: 'year', name: '년' }, { key: 'month', name: '월' }, { key: 'day', name: '일' }
    ];
    if (p.hour) positions.push({ key: 'hour', name: '시' });

    var rows = [];
    positions.forEach(function (pos) {
      var pl = p[pos.key];
      if (pl.sipsungGan !== '일간') map[pl.sipsungGan] += 1;
      map[pl.sipsungJi] += 1;
      rows.push({ pos: pos.name, gan: pl.ganH, ji: pl.jiH, ganSS: pl.sipsungGan, jiSS: pl.sipsungJi });
    });
    return { map: map, rows: rows };
  }

  function buildMonthly(core) {
    var dJi = core.dayJi;
    var out = [];

    function push(mon, range) {
      var ss = S.sipsung(core.dayGan, mon.gan);
      var rel = S.relation(mon.ji, dJi);
      var el = S.GAN[mon.gan].el;
      var score = BASE_SCORE[ss] || 0;
      rel.forEach(function (r) { score += (REL_ADJ[r] || 0); });
      if (core.counts[el] === 0) score += 0.6;
      else if (core.counts[el] >= 3) score -= 0.4;

      var rels = [];
      ['충', '형', '해', '파', '합'].forEach(function (r) {
        if (rel.indexOf(r) >= 0 && C.RELATION_NOTE[r] && rels.length < 1) rels.push(C.RELATION_NOTE[r]);
      });

      out.push({
        no: out.length + 1,
        name: mon.name,
        label: mon.label,
        ganSS: ss,
        rel: rel,
        relNote: rels.join(' '),
        grade: gradeOf(score),
        score: Math.round(score * 10) / 10,
        range: range,
        title: C.MONTH_TPL[ss].s,
        body: C.MONTH_TPL[ss].b
      });
    }

    var y2026 = S.yearlyMonths(2026);
    var y2027 = S.yearlyMonths(2027);
    var r2026 = S.monthRanges(2026);
    var r2027 = S.monthRanges(2027);

    function rangeStr(t) {
      var a = t.start, b = t.end;
      function fmt(s) { return (+s.substr(0, 2)) + '/' + (+s.substr(2, 2)); }
      return fmt(a) + '~' + fmt(b);
    }

    /* 1월은 2026 사주년의 축월(辛丑) */
    push(y2026[11], rangeStr(r2026[11]));
    /* 2월 인월 ~ 12월 자월 */
    for (var i = 0; i < 11; i++) push(y2027[i], rangeStr(r2027[i]));
    return out;
  }

  function build(core) {
    var dayGan = core.dayGan;
    var dm = C.DAY_MASTER[S.GAN[dayGan].h];
    var ilju = C.ILJU[core.dayIndex];

    /* 오행 분석 */
    var counts = core.counts, ratio = core.ratio;
    var elList = S.ELEMENTS.map(function (el) {
      return {
        el: el, han: C.ELEMENT_INFO[el].han, key: C.ELEMENT_INFO[el].key,
        color: C.ELEMENT_INFO[el].color,
        count: counts[el], pct: ratio[el]
      };
    });
    var sorted = elList.slice().sort(function (a, b) { return b.count - a.count; });
    var top = sorted[0], second = sorted[1];
    var zeros = elList.filter(function (e) { return e.count === 0; });
    var maxCnt = top.count;

    var balanceTitle, balanceBody;
    if (zeros.length >= 2 || maxCnt >= 4) {
      balanceTitle = '한쪽으로 크게 기운 구조';
      balanceBody = top.el + ' 기운이 ' + top.count + '개로 가장 강하고, ' +
        (zeros.length ? (zeros.map(function (z) { return z.el; }).join('·') + ' 기운이 아예 없습니다. ') : '') +
        '강점은 확실하지만 그 힘에 기대는 습관이 생기면 약한 쪽에서 새기 쉽습니다. 부족한 ' +
        (zeros.length ? zeros[0].el : sorted[sorted.length - 1].el) + ' 기운을 사람·환경·루틴으로 보충하는 것이 이 사주의 핵심 처방입니다.';
    } else if (maxCnt <= 2) {
      balanceTitle = '오행이 고르게 섞인 구조';
      balanceBody = '다섯 기운이 크게 치우치지 않았습니다. 어느 한 곳에 몰리지 않아 판단이 균형적이고, 환경이 바뀌어도 적응이 빠릅니다. 대신 한 가지에 미치듯 파고드는 힘은 상대적으로 약하니, 스스로 기한과 목표를 정해 몰입을 만들어야 합니다.';
    } else {
      balanceTitle = top.el + ' 기운이 이끄는 구조';
      balanceBody = top.el + '(' + top.count + '개)와 ' + second.el + '(' + second.count + '개)가 중심을 잡고 있습니다. ' +
        '이 두 기운이 무의식의 판단 기준이 되니, 잘 쓰면 사람을 읽고 판을 짜는 감각이 되고, 잘못 쓰면 같은 실수를 반복하는 이유가 됩니다.';
    }

    /* 십성 */
    var ss = sipsungMap(core);
    var jae = ss.map['편재'] + ss.map['정재'];
    var sik = ss.map['식신'] + ss.map['상관'];
    var bi = ss.map['비견'] + ss.map['겁재'];
    var in_ = ss.map['편인'] + ss.map['정인'];
    var gwan = ss.map['편관'] + ss.map['정관'];

    /* 2027 세운 */
    var y2027Gan = 3; /* 丁 */
    var y2027Ji = 7;  /* 未 */
    var ySS = S.sipsung(dayGan, y2027Gan);
    var yJiSS = S.sipsungJi(dayGan, y2027Ji);
    var yRel = S.relation(core.dayJi, y2027Ji);
    var yGanTheme = C.Y2027_GAN[ySS];

    /* 월별 */
    var months = buildMonthly(core);

    var attack = months.filter(function (m) {
      return (m.ganSS === '편재' || m.ganSS === '정재' || m.ganSS === '식신') && m.grade >= 3;
    });
    var defend = months.filter(function (m) {
      return m.ganSS === '편관' || m.ganSS === '겁재' || m.grade === 1;
    });
    var avoid = months.filter(function (m) {
      return m.grade === 1 || m.rel.indexOf('충') >= 0 || m.rel.indexOf('형') >= 0;
    });
    var best = months.slice().sort(function (a, b) { return b.score - a.score; })[0];

    /* 재물 그릇 */
    var wealthHead, wealthBody;
    if (jae === 0) {
      wealthHead = '재성이 드러나지 않은 그릇 — 벌이의 통로를 직접 설계하는 사람';
      wealthBody = '원국에 재성(財星)이 겉으로 나와 있지 않습니다. 이는 돈이 없다는 뜻이 아니라, 돈이 저절로 굴러오는 구조가 아니라 내가 통로를 만들어야 하는 구조라는 뜻입니다. ' +
        '기술·콘텐츠·서비스처럼 내가 만든 것을 파는 쪽이 훨씬 유리하고, 남이 만든 판에 얹혀 가는 방식은 오래 못 갑니다.';
    } else if (jae <= 2) {
      wealthHead = '재성이 ' + jae + '개 — 성실하게 쌓는 표준형 재물 구조';
      wealthBody = '재성이 ' + jae + '개로 균형 있게 자리하고 있습니다. 큰 한 방보다는 반복되는 수입을 설계할 때 가장 크게 남는 구조입니다. ' +
        '2027년에는 재성이 들어오는 달이 뚜렷하게 나뉘므로, 그 달에 계약·단가·판매를 몰아넣는 방식이 효율적입니다.';
    } else {
      wealthHead = '재성이 ' + jae + '개 — 돈이 크게 들고 나는 구조';
      wealthBody = '재성이 많아 돈의 흐름 자체는 활발합니다. 다만 새는 구멍도 그만큼 많아, 벌어도 남지 않는 패턴이 생기기 쉽습니다. ' +
        '2027년은 통제 장치(고정 저축·지출 상한·동업 서면화)를 먼저 만들고 움직여야 재물이 남습니다.';
    }

    /* 귀인 방위 */
    var cheon = CHEONEUL[dayGan];
    var noble = cheon.map(function (j) {
      return { ji: S.JI[j].h, han: S.JI[j].han, dir: DIR_NAME[j] };
    });
    var clashDir = yRel.indexOf('충') >= 0 ? DIR_NAME[y2027Ji] : null;

    /* 2027 총운 한 줄 */
    var oneLine = '2027 정미년 — ' + yGanTheme.title;

    return {
      core: core,
      dayMaster: dm,
      ilju: { title: ilju.t, body: ilju.b, key: ilju.k },
      elements: elList,
      balance: { title: balanceTitle, body: balanceBody, top: top, weakest: sorted[sorted.length - 1], zeros: zeros },
      sipsung: { map: ss.map, rows: ss.rows, jae: jae, sik: sik, bi: bi, in_: in_, gwan: gwan },
      y2027: {
        gan: '정(丁)', ji: '미(未)',
        ganSS: ySS, jiSS: yJiSS, rel: yRel,
        title: yGanTheme.title,
        body: yGanTheme.b,
        env: C.Y2027_JI[yJiSS],
        oneLine: oneLine
      },
      wealth: {
        head: wealthHead, body: wealthBody,
        attack: attack, defend: defend, best: best
      },
      months: months,
      avoid: { months: avoid, dir: clashDir },
      noble: { list: noble, dir: clashDir },
      meta: {
        total: core.total,
        jae: jae, sik: sik, bi: bi, in_: in_, gwan: gwan
      }
    };
  }

  root.Report = { build: build, DIR_NAME: DIR_NAME, gradeOf: gradeOf };
  if (typeof module !== 'undefined' && module.exports) module.exports = root.Report;
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));
