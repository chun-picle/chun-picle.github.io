/* ============================================================
 * 월령 · 2인 궁합 엔진 검증 테스트 (tests/test_gunghap.js)
 * 실행: python3 tests/run_tests.py   (또는 node tests/test_gunghap.js)
 *
 * 명세서(wolryeong-gunghap-spec.md) 6장 QA 체크리스트를 그대로 검사한다.
 *  - 같은 입력 → 같은 총점·같은 문구 (무작위 없음)
 *  - 시각 모름(6글자) 입력에서도 총점·축 계산
 *  - A/B 순서를 바꿔도 총점 동일 (대칭)
 *  - 연인/동업 모드 전환 시 문구·가중치만 바뀌고 총점 구조 동일
 *  - 무료 미리보기와 유료 본편의 총점·끌림 요약 일치 + 무료 미리보기 항목 제한
 *  - 2027 월별 캘린더 12개월이 절기 기준 월과 일치
 *  - 생년월일이 결과·공유 문구에 노출되지 않음
 *  - 점수 구간·축 배점·문구 출처(JSON) 검증
 * ============================================================ */
(function () {
  var out = [];
  var fail = 0;

  function check(label, actual, expected) {
    var ok = actual === expected;
    if (!ok) fail++;
    out.push((ok ? 'PASS' : 'FAIL') + ' | ' + label + ' | 기대 ' + expected + ' / 실제 ' + actual);
  }
  function ok(label, cond) { check(label, !!cond, true); }
  function near(label, actual, expected, tol) {
    var ok = Math.abs(actual - expected) <= tol;
    if (!ok) fail++;
    out.push((ok ? 'PASS' : 'FAIL') + ' | ' + label + ' | 기대 ' + expected + '±' + tol + ' / 실제 ' + actual);
  }

  var K = GUNGHAP_CONTENT;
  var G = Gunghap;

  /* 기준 두 사람: 1990-03-25 15:30 남성(경오·기묘·기축·임신) + 1992-08-14 09:10 여성 */
  var A = { year: 1990, month: 3, day: 25, hour: 15, minute: 30, timeUnknown: false, gender: 'm' };
  var B = { year: 1992, month: 8, day: 14, hour: 9, minute: 10, timeUnknown: false, gender: 'f' };

  var r1 = G.fromBirth(A, B, 'lover');

  /* ---- 1. 기본 계산 ---- */
  ok('총점 범위 0~100', r1.score >= 0 && r1.score <= 100);
  check('축 5개', r1.axes.length, 5);
  check('축 합계 = 총점', r1.axes.reduce(function (s, x) { return s + x.score; }, 0), r1.score);
  check('배점 합계 100', r1.axes.reduce(function (s, x) { return s + x.max; }, 0), 100);
  check('총점 정수(내림)', r1.score, Math.floor(r1.score));
  ok('구간 타이틀 존재', r1.band.title.length > 0);
  check('구간 타이틀 = scoreBands 매칭', r1.band.title, G.bandOf(r1.score).title);
  check('모드 라벨', r1.modeLabel, '연인');

  r1.axes.forEach(function (ax) {
    ok('축 ' + ax.id + ' 점수 ≤ 배점', ax.score <= ax.max);
    ok('축 ' + ax.id + ' 문구가 JSON level 문구', K.axes.filter(function (a) { return a.id === ax.id; })[0]
      .levels.map(function (l) { return l.text; }).indexOf(ax.text) >= 0);
    ok('축 ' + ax.id + ' 문구 비어있지 않음', ax.text.length > 10);
  });

  /* ---- 2. 결정성: 같은 입력 → 같은 결과 ---- */
  var r1b = G.fromBirth(A, B, 'lover');
  check('같은 입력 → 같은 총점', r1b.score, r1.score);
  check('같은 입력 → 같은 축', r1b.axes.map(function (x) { return x.score; }).join('/'),
    r1.axes.map(function (x) { return x.score; }).join('/'));
  check('같은 입력 → 같은 12개월', r1b.months.map(function (m) { return m.grade; }).join(','),
    r1.months.map(function (m) { return m.grade; }).join(','));
  check('같은 입력 → 같은 공유 문구', r1b.share, r1.share);

  /* ---- 3. 대칭: A/B 를 바꿔도 같은 점수 ---- */
  var rSwap = G.fromBirth(B, A, 'lover');
  check('A/B 순서 교환 총점 동일', rSwap.score, r1.score);
  check('A/B 순서 교환 축 동일', rSwap.axes.map(function (x) { return x.score; }).join('/'),
    r1.axes.map(function (x) { return x.score; }).join('/'));
  check('A/B 순서 교환 월 등급 동일', rSwap.months.map(function (m) { return m.grade; }).join(','),
    r1.months.map(function (m) { return m.grade; }).join(','));

  /* ---- 4. 시각 미상(6글자) ---- */
  var AU = { year: 1990, month: 3, day: 25, hour: null, minute: null, timeUnknown: true };
  var BU = { year: 1992, month: 8, day: 14, hour: null, minute: null, timeUnknown: true };
  var rU = G.fromBirth(AU, BU, 'lover');
  ok('시각 미상 총점 계산', rU.score >= 0 && rU.score <= 100);
  check('시각 미상 축 5개', rU.axes.length, 5);
  check('시각 미상 12개월', rU.months.length, 12);
  check('시각 미상 원국 3주', rU.cores.a.pillarName.hour, null);
  var rMix = G.fromBirth(AU, B, 'lover');
  ok('한쪽만 시각 미상도 계산', rMix.score >= 0 && rMix.score <= 100);

  /* ---- 5. 관계 모드 ---- */
  var rBiz = G.fromBirth(A, B, 'business');
  check('동업 모드 라벨', rBiz.modeLabel, '동업자');
  check('동업 모드 총점 구조(배점) 동일', rBiz.axes.reduce(function (s, x) { return s + x.max; }, 0), 100);
  ok('동업 모드 총점 ≤ 100', rBiz.score <= 100);
  ok('모드별 십성 문구 다름', r1.tenGod.textAB !== rBiz.tenGod.textAB);
  check('동업 모드 마무리 = JSON', rBiz.closing, K.closing.business);
  check('연인 모드 마무리 = JSON', r1.closing, K.closing.lover);
  ok('동업 모드 재물 가중(재성 있는 짝)', (function () {
    /* 일간 관계가 재성인 짝을 하나 골라 동업 ≥ 연인 */
    var cands = [
      [{ year: 1990, month: 3, day: 25, hour: 15, minute: 30 }, { year: 1985, month: 8, day: 15, hour: 6, minute: 0 }],
      [{ year: 1988, month: 5, day: 5, hour: 10, minute: 0 }, { year: 1993, month: 11, day: 20, hour: 20, minute: 0 }],
      [{ year: 1979, month: 7, day: 28, hour: 2, minute: 0 }, { year: 1996, month: 2, day: 9, hour: 14, minute: 0 }]
    ];
    var passed = false;
    cands.forEach(function (p) {
      var lo = G.fromBirth(p[0], p[1], 'lover');
      var bi = G.fromBirth(p[0], p[1], 'business');
      var wL = lo.axes.filter(function (x) { return x.id === 'wealth'; })[0].score;
      var wB = bi.axes.filter(function (x) { return x.id === 'wealth'; })[0].score;
      if (wB > wL) passed = true;
    });
    return passed;
  })());
  check('잘못된 모드 값은 연인으로', G.fromBirth(A, B, 'xxx').mode, 'lover');

  /* ---- 6. 무료/유료 경계 ---- */
  var pv = G.freePreview(r1);
  check('무료 미리보기 항목 = 총점·구간·끌림·좋은 달', Object.keys(pv).sort().join(','),
    'attractionName,attractionText,bandTitle,goodMonth,score');
  check('무료 총점 = 본편 총점', pv.score, r1.score);
  check('무료 구간 타이틀 = 본편', pv.bandTitle, r1.band.title);
  check('무료 끌림 요약 = 본편 끌림 축 문구', pv.attractionText,
    r1.axes.filter(function (x) { return x.id === 'attraction'; })[0].text);
  check('무료 좋은 달 = 본편 좋은 달', pv.goodMonth.no, r1.goodMonth.no);
  check('무료 좋은 달 등급 좋음', pv.goodMonth.grade, '좋음');
  var pvStr = JSON.stringify(pv);
  ok('무료 미리보기에 다른 축 문구 없음', r1.axes.filter(function (x) { return G.isPaidAxis(x.id); })
    .every(function (x) { return pvStr.indexOf(x.text) < 0; }));
  ok('무료 미리보기에 12개월 전체 없음', pvStr.indexOf(r1.months[4].comment) < 0);
  ok('무료 미리보기에 갈등 대처법 없음', pvStr.indexOf(r1.advice[0].advice) < 0);
  check('유료 축 4개', G.PAID_AXES.length, 4);
  ok('끌림은 무료 축', !G.isPaidAxis('attraction'));

  /* ---- 7. 2027 월별 (절기 기준) ---- */
  check('12개월', r1.months.length, 12);
  check('월 번호 1~12', r1.months.map(function (m) { return m.no; }).join(','),
    '1,2,3,4,5,6,7,8,9,10,11,12');
  check('월 문구 = JSON 문구', r1.months[1].comment, K.monthlySynergy2027[1].comment);
  check('월 등급 = JSON 등급', r1.months.map(function (m) { return m.grade; }).join(','),
    K.monthlySynergy2027.map(function (m) { return m.grade; }).join(','));
  /* 절기 이름이 달력 월과 맞는지: 3월=경칩, 4월=청명 … 12월=대설, 2월=입춘 */
  var termOk = r1.months.every(function (m) {
    var want = { 2: '입춘', 3: '경칩', 4: '청명', 5: '입하', 6: '망종', 7: '소서',
      8: '입추', 9: '백로', 10: '한로', 11: '입동', 12: '대설' }[m.no];
    return !want || m.label.indexOf(want) >= 0;
  });
  check('절기명 = 달력 월', termOk, true);
  /* 2027년 절입일이 실제로 그 달에 있는지 (solar-terms 테이블 대조) */
  var ranges = SajuCore.monthRanges(2027);
  check('2027 입춘 월 = 인월', SajuCore.MONTH_ORDER_NAME[ranges[0].order], '인월');
  check('2027 대설 월 = 자월', SajuCore.MONTH_ORDER_NAME[ranges[10].order], '자월');
  check('2월 지지 = 인', r1.months[1].jiName, '인');
  check('12월 지지 = 자', r1.months[11].jiName, '자');
  ok('월 개인 사실 라벨 허용값', r1.months.every(function (m) {
    return ['', '육합', '삼합', '충', '형', '파', '해'].indexOf(m.personal.a) >= 0;
  }));

  /* ---- 8. 생년월일 비노출 ---- */
  var visible = JSON.stringify({
    score: r1.score, band: r1.band, axes: r1.axes, months: r1.months,
    tenGod: r1.tenGod, links: r1.links, clashes: r1.clashes, advice: r1.advice,
    closing: r1.closing, share: r1.share, disclaimer: r1.disclaimer
  });
  ok('결과에 1990-03-25 없음', visible.indexOf('1990') < 0 && visible.indexOf('03-25') < 0);
  ok('결과에 1992-08-14 없음', visible.indexOf('1992') < 0 && visible.indexOf('08-14') < 0);
  ok('공유 문구에 점수 포함', r1.share.indexOf(String(r1.score)) >= 0);
  ok('공유 문구에 구간 포함', r1.share.indexOf(r1.band.title) >= 0);
  ok('공유 문구에 날짜 없음', !/\d{4}[.\-/]\d{2}/.test(r1.share));

  /* ---- 9. 규칙 단위 검증 ---- */
  check('갑기합', G.isStemHap(0, 5), true);
  check('을경합', G.isStemHap(1, 6), true);
  check('정임합', G.isStemHap(3, 8), true);
  check('갑경충', G.isStemChung(0, 6), true);
  check('정계충', G.isStemChung(3, 9), true);
  check('자축 육합', G.branchFacts(0, 1).yukhap, true);
  check('자오 충', G.branchFacts(0, 6).chung, true);
  check('신자진 삼합', G.isSamhap(8, 0), true);
  check('해묘미 삼합', G.isSamhap(11, 3), true);
  check('인오술 삼합', G.isSamhap(2, 6), true);
  check('사유축 삼합', G.isSamhap(5, 9), true);
  check('자-인 삼합 아님', G.isSamhap(0, 2), false);
  check('축미 충', G.branchFacts(1, 7).chung, true);
  check('인신 충', G.branchFacts(2, 8).chung, true);
  check('진유 육합', G.branchFacts(4, 9).yukhap, true);
  check('오미 육합', G.branchFacts(6, 7).yukhap, true);

  /* 천간합이면 끌림 점수가 충보다 높다 */
  var hapPair = (function () {
    /* 1990-03-25 = 기축일(기). 갑일을 찾아 갑기합 짝 만들기 */
    var found = null;
    for (var d = 1; d <= 28 && !found; d++) {
      var c = SajuCore.compute({ year: 1994, month: 3, day: d, timeUnknown: true });
      if (c.dayGan === 0) found = { year: 1994, month: 3, day: d, timeUnknown: true };
    }
    return found;
  })();
  ok('갑일 표본 찾음', !!hapPair);
  if (hapPair) {
    var rHap = G.fromBirth({ year: 1990, month: 3, day: 25, hour: 15, minute: 30 }, hapPair, 'lover');
    ok('천간합 짝의 끌림 ≥ 기본', rHap.axes[0].score >= 20);
  }

  /* ---- 10. 점수 구간 ---- */
  check('구간 90~100 = 천생연분', G.bandOf(95).title, '천생연분');
  check('구간 90 경계', G.bandOf(90).title, '천생연분');
  check('구간 89 = 좋은 궁합', G.bandOf(89).title, '좋은 궁합');
  check('구간 0 = 극과 극', G.bandOf(0).title, '극과 극 궁합');
  check('구간 100 상한', G.bandOf(100).title, '천생연분');

  /* ---- 11. 콘텐츠 출처(JSON) ---- */
  ok('tenGods 연인 문구 사용', K.tenGods.lover[r1.tenGod.nameAB] === r1.tenGod.textAB);
  ok('tenGods 동업 문구 사용', K.tenGods.business[rBiz.tenGod.nameAB] === rBiz.tenGod.textAB);
  ok('링크 문구가 JSON에 존재', (function () {
    var all = []
      .concat(K.stemCombinations.he, K.stemCombinations.chung)
      .concat(K.branchCombinations.yukhap, K.branchCombinations.chung, K.branchCombinations.samhap);
    var texts = all.map(function (x) { return x.text; });
    texts.push(K.stemCombinations.none.text, K.branchCombinations.hyeongPaHae.text);
    return r1.links.branches.every(function (b) { return texts.indexOf(b.text) >= 0; });
  })());
  ok('대처법 문구가 JSON에 존재', r1.advice.every(function (a) {
    return K.conflictAdvice.map(function (x) { return x.advice; }).indexOf(a.advice) >= 0;
  }));
  check('면책 문구 = JSON', r1.disclaimer, K.meta.disclaimer);

  /* ---- 12. 표본 분포(상식선) ---- */
  var sample = [
    [{ year: 1988, month: 1, day: 12, hour: 7, minute: 0 }, { year: 1991, month: 6, day: 3, hour: 22, minute: 0 }],
    [{ year: 1975, month: 9, day: 19, hour: 3, minute: 0 }, { year: 1982, month: 12, day: 25, hour: 13, minute: 0 }],
    [{ year: 2000, month: 2, day: 2, hour: 18, minute: 0 }, { year: 1999, month: 4, day: 30, hour: 5, minute: 0 }]
  ];
  var inRange = true;
  sample.forEach(function (p) {
    var r = G.fromBirth(p[0], p[1], 'lover');
    if (r.score < 0 || r.score > 100) inRange = false;
    r.axes.forEach(function (ax) { if (ax.score < 0 || ax.score > ax.max) inRange = false; });
  });
  check('표본 3쌍 모두 축·총점 범위 안', inRange, true);

  out.push('');
  out.push('== 궁합 결과 요약 ==');
  out.push('1990-03-25 15:30 × 1992-08-14 09:10 (연인) → ' + r1.score + '점 · ' + r1.band.title +
    ' / 축 ' + r1.axes.map(function (x) { return x.name + ' ' + x.score; }).join(' · '));
  out.push('동업 모드 → ' + rBiz.score + '점 · ' + rBiz.band.title);
  out.push('좋은 달 → ' + r1.goodMonth.no + '월 ' + r1.goodMonth.label);
  out.push('십성 → B가 A에게 ' + r1.tenGod.nameAB + ' / A가 B에게 ' + r1.tenGod.nameBA);
  out.push('공유 문구 → ' + r1.share);
  out.push('');

  var text = out.join('\n');
  if (typeof globalThis !== 'undefined') {
    globalThis.__ghText = text;
    globalThis.__ghFail = fail;
  }
  if (typeof module !== 'undefined' && module.exports) module.exports = { fail: fail, text: text };
})();
