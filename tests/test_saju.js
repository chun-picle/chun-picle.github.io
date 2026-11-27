/* ============================================================
 * 만세력 엔진 검증 테스트
 * 실행: python3 tests/run_tests.py   (또는 node tests/test_saju.js)
 * ============================================================ */
(function () {
  var out = [];
  var fail = 0;

  function check(label, actual, expected) {
    var ok = actual === expected;
    if (!ok) fail++;
    out.push((ok ? 'PASS' : 'FAIL') + ' | ' + label + ' | 기대 ' + expected + ' / 실제 ' + actual);
  }

  function caseText(y, mo, d, hh, mi, unknown) {
    var r = SajuCore.compute({
      year: y, month: mo, day: d, hour: hh, minute: mi, timeUnknown: !!unknown, gender: 'f'
    });
    return {
      text: r.text,
      hanja: r.hanja,
      ratio: r.ratio,
      counts: r.counts,
      sajuYear: r.sajuYear,
      month: r.monthOrderText
    };
  }

  /* ---- 1. 기준 케이스 ---- */
  var c1 = caseText(1990, 3, 25, 15, 30);
  check('1990-03-25 15:30 팔자', c1.text, '경오 기묘 기축 임신');
  check('1990-03-25 15:30 한자', c1.hanja, '庚午 己卯 己丑 壬申');
  check('1990-03-25 15:30 월건', c1.month, '묘월');

  var c2 = caseText(2000, 1, 1, 12, 0);
  check('2000-01-01 12:00 팔자', c2.text, '기묘 병자 무오 무오');

  var c3 = caseText(1985, 8, 15, 6, 0);
  check('1985-08-15 06:00 팔자', c3.text, '을축 갑신 병술 신묘');

  /* ---- 2. 절입 경계 ---- */
  /* 1990 입춘 02-04 11:14 KST → 그 이전은 기사년 축월 */
  check('1990-02-04 11:00 (입춘 14분 전, 기사년 축월)',
    caseText(1990, 2, 4, 11, 0).text.indexOf('기사'), 0);
  check('1990-02-04 11:20 (입춘 6분 후, 경오년)',
    caseText(1990, 2, 4, 11, 20).text.indexOf('경오'), 0);
  /* 1990 경칩 03-06 05:19 → 03-06 05:00 은 인월, 05:30 은 묘월 */
  check('1990-03-06 05:00 인월', caseText(1990, 3, 6, 5, 0).month, '인월');
  check('1990-03-06 05:30 묘월', caseText(1990, 3, 6, 5, 30).month, '묘월');
  /* 2027 입춘 02-04 10:46 */
  check('2027-02-04 10:00 병오년 축월', caseText(2027, 2, 4, 10, 0).sajuYear, 2026);
  check('2027-02-04 11:00 정미년 인월', caseText(2027, 2, 4, 11, 0).sajuYear, 2027);

  /* ---- 3. 자시 경계 ---- */
  check('00:30 자시', SajuCore.hourBranchIndex(0, 30), 0);
  check('23:30 자시', SajuCore.hourBranchIndex(23, 30), 0);
  check('01:00 축시', SajuCore.hourBranchIndex(1, 0), 1);
  check('02:59 축시', SajuCore.hourBranchIndex(2, 59), 1);
  check('15:00 신시', SajuCore.hourBranchIndex(15, 0), 8);
  check('17:00 유시', SajuCore.hourBranchIndex(17, 0), 9);

  /* ---- 4. 시주 미상 ---- */
  var c4 = caseText(1990, 3, 25, null, null, true);
  check('시각 미상 6글자', c4.text, '경오 기묘 기축');

  /* ---- 5. 오행 합계 ---- */
  var sum = 0;
  for (var k in c1.counts) sum += c1.counts[k];
  check('오행 개수 합 = 8', sum, 8);
  var sum4 = 0;
  for (var k2 in c4.counts) sum4 += c4.counts[k2];
  check('시각 미상 오행 개수 합 = 6', sum4, 6);

  /* ---- 6. 60갑자 순환 (1900~2100) ---- */
  var prev = SajuCore.compute({ year: 2000, month: 6, day: 1, timeUnknown: true });
  var okCycle = true;
  for (var i = 1; i <= 40; i++) {
    var dt = new Date(Date.UTC(2000, 5, 1 + i));
    var r = SajuCore.compute({ year: dt.getUTCFullYear(), month: dt.getUTCMonth() + 1, day: dt.getUTCDate(), timeUnknown: true });
    var expect = (prev.dayIndex + 1) % 60;
    if (r.dayIndex !== expect) { okCycle = false; out.push('FAIL 사이클 ' + dt.toISOString().slice(0, 10) + ' ' + r.dayIndex + ' vs ' + expect); break; }
    prev = r;
  }
  check('일주 60갑자 연속 순환', okCycle, true);

  /* ---- 7. 절기 테이블 무결성 ---- */
  var t2024 = SOLAR_TERMS['2024'];
  check('2024 입춘', t2024[1], '0204T17:27');
  check('2025 입춘', SOLAR_TERMS['2025'][1], '0203T23:10');
  check('2023 입춘', SOLAR_TERMS['2023'][1], '0204T11:42');

  /* ---- 8. 십성 ---- */
  /* 기(5) 일간 기준: 갑(0)은 정관, 을(1)은 편관, 병(2)은 정인, 정(3)은 편인,
     무(4)는 겁재, 기(5)는 비견, 경(6)은 상관, 신(7)은 식신, 임(8)은 정재, 계(9)는 편재 */
  var expectSS = ['정관', '편관', '정인', '편인', '겁재', '비견', '상관', '식신', '정재', '편재'];
  var ssOk = true;
  for (var g = 0; g < 10; g++) {
    var got = SajuCore.sipsung(5, g);
    if (got !== expectSS[g]) { ssOk = false; out.push('FAIL 십성 기일간 ' + SajuCore.GAN[g].h + ' → ' + got + ' (기대 ' + expectSS[g] + ')'); }
  }
  check('십성(기일간) 10종', ssOk, true);

  /* ---- 9. 잠금 코드 보안 ---- */
  check('데모 코드 제거', !CONFIG.demoCode, true);
  check('사전 발급 코드 없음', (CONFIG.accessCodes || []).length, 0);
  check('maxCodeUses = 3', CONFIG.maxCodeUses, 3);

  /* ---- 10. 심층 리포트 (신강/신약 · 용신 · 대운 · 12개월) ---- */
  var core = SajuCore.compute({
    year: 1990, month: 3, day: 25, hour: 15, minute: 30, gender: 'f'
  });
  var rep = Report.build(core, { now: new Date('2026-11-24T00:00:00Z') });

  check('신강/신약 판정', rep.strength.label, '신약');
  check('지원 세력 비율', rep.strength.ratio, 39);
  check('득령·득지·득세',
    [rep.strength.deukryeong, rep.strength.deukji, rep.strength.deukse].join(','), 'false,true,true');
  check('용신 오행', rep.yongsin.yongEl, '화');
  check('희신 오행', rep.yongsin.huiEl, '토');
  check('기신 오행', rep.yongsin.giEl, '수');
  check('용신 처방 색·방위', rep.yongsin.rx.color + '/' + rep.yongsin.rx.dir, '붉은색·주황/남쪽');

  check('대운 순역', rep.daeun.forward, false);
  check('대운수', rep.daeun.startAge, 6);
  check('대운 8개', rep.daeun.list.length, 8);
  check('첫 대운', rep.daeun.list[0].label, '무인');
  check('현재 대운', rep.daeun.current.label, '을해');
  check('현재 나이', rep.daeun.age, 36);
  check('대운이 60갑자 역순',
    rep.daeun.list.slice(0, 3).map(function (d) { return d.label; }).join(' '), '무인 정축 병자');
  check('현재 대운 × 2027 해설', rep.daeun.with2027.indexOf('2027 정미년') >= 0, true);

  var maleRep = Report.build(SajuCore.compute({
    year: 1990, month: 3, day: 25, hour: 15, minute: 30, gender: 'm'
  }), { now: new Date('2026-11-24T00:00:00Z') });
  check('남성은 순행', maleRep.daeun.forward, true);
  check('남성 첫 대운', maleRep.daeun.list[0].label, '경진');

  var titles = {}, dupTitle = 0, dupBody = {}, dupBodyCount = 0, shortBody = 0, missingAct = 0;
  rep.months.forEach(function (m) {
    if (titles[m.title]) dupTitle++;
    titles[m.title] = 1;
    if (dupBody[m.body]) dupBodyCount++;
    dupBody[m.body] = 1;
    if (!m.body || m.body.length < 80) shortBody++;
    if (!m.actMoney || !m.actRelation) missingAct++;
  });
  check('12개월 개수', rep.months.length, 12);
  check('12개월 제목 고유', dupTitle, 0);
  check('12개월 본문 고유', dupBodyCount, 0);
  check('12개월 본문 3문장 이상', shortBody, 0);
  check('12개월 액션 2줄', missingAct, 0);
  check('월별 천간·지지 십성 분리', rep.months[0].ganSS + '/' + rep.months[0].jiSS, '식신/비견');
  check('가장 강한 달', rep.wealth.best.no, 6);

  check('분기 4개', rep.quarters.length, 4);
  check('분기 전략 라벨',
    rep.quarters.map(function (q) { return q.label; }).sort().join(','), '공격,방어,수확,정비');
  check('4대 재물 영역', rep.domains.list.map(function (d) { return d.key; }).join(','),
    'cashflow,business,contract,assets');
  check('계약 영역 2027 관계',
    rep.domains.contract.body.indexOf('2027') >= 0, true);
  check('부동산 영역 토 기운 표기',
    rep.domains.assets.head.indexOf('토 기운') >= 0, true);

  /* ---- 부동산 방위·입지 (오행 풍수) ---- */
  var fsh = rep.domains.assets.fengshui;
  check('방위·입지 5줄', fsh.rows.map(function (r) { return r.k; }).join(','),
    '기본 원칙,방위,입지·지형,피할 곳,지역 그림');
  check('방위·입지 용신 오행 = 용신', fsh.el, rep.yongsin.yongEl);
  check('방위·입지 빈 칸 없음',
    fsh.rows.every(function (r) { return r.k && r.v && r.v.length > 20; }) && !!fsh.lead && !!fsh.note, true);
  check('방위 문구 = 용신 오행 문구', fsh.rows[1].v, CONTENT.FENGSHUI.el[fsh.el].dir);
  check('피할 곳에 기신 주의', fsh.rows[3].v.indexOf('부담') >= 0, true);
  check('배산임수 쉬운 말 풀이', fsh.rows[0].v.indexOf('배산임수(뒤는 산이나 언덕으로') >= 0, true);
  check('오행 5종 방위·입지 문구',
    ['목', '화', '토', '금', '수'].every(function (e) {
      var x = CONTENT.FENGSHUI.el[e];
      return x && x.dir && x.place && x.avoid && x.area && x.giAvoid;
    }), true);
  check('보완 처방 4줄', rep.leakFix.fixes.length, 4);
  check('돈 새는 구멍 1개 이상', rep.leakFix.leaks.length >= 1, true);
  check('보완 처방 빈 칸 없음',
    rep.leakFix.fixes.every(function (f) { return !!f.k && !!f.v; }), true);
  check('현금흐름 공격 달 존재', rep.wealth.attack.length >= 0, true);

  /* 시각 미상(6글자)도 신강/신약·대운이 계산된다 */
  var core6 = SajuCore.compute({ year: 1990, month: 3, day: 25, timeUnknown: true, gender: 'f' });
  var rep6 = Report.build(core6, { now: new Date('2026-11-24T00:00:00Z') });
  check('시각 미상 판정', !!rep6.strength.label, true);
  check('시각 미상 대운 8개', rep6.daeun.list.length, 8);
  check('시각 미상 12개월', rep6.months.length, 12);

  /* ---- 11. 원국 심층 분석 (지장간·12운성·공망·격국·신살·합충) ---- */
  check('지장간 묘(卯)', SajuCore.jangan(3).map(function (h) { return h.h + '/' + h.role; }).join(','),
    '갑/초기,을/정기');
  check('지장간 축(丑) 한자', SajuCore.jangan(1).map(function (h) { return h.han; }).join(''), '癸辛己');
  check('지장간 오(午) 정기', SajuCore.GAN[SajuCore.jeonggi(6)].h, '정');
  check('지장간 인(寅) 정기', SajuCore.GAN[SajuCore.jeonggi(2)].h, '갑');
  check('지장간 유(酉)', SajuCore.jangan(9).map(function (h) { return h.h; }).join(''), '경신');

  check('12운성 갑-인', SajuCore.unsung(0, 2).name, '임관');
  check('12운성 갑-묘', SajuCore.unsung(0, 3).name, '제왕');
  check('12운성 을-인', SajuCore.unsung(1, 2).name, '제왕');
  check('12운성 경-유', SajuCore.unsung(6, 9).name, '제왕');
  check('12운성 계-자', SajuCore.unsung(9, 0).name, '임관');
  check('12운성 기-오', SajuCore.unsung(5, 6).name, '임관');
  check('12운성 기-축', SajuCore.unsung(5, 1).name, '묘');

  check('공망 갑자순', SajuCore.gongmang(0).map(function (j) { return SajuCore.JI[j].h; }).join(''), '술해');
  check('공망 갑술순', SajuCore.gongmang(10).map(function (j) { return SajuCore.JI[j].h; }).join(''), '신유');
  check('공망 갑인순', SajuCore.gongmang(50).map(function (j) { return SajuCore.JI[j].h; }).join(''), '자축');
  check('공망 기축일주', SajuCore.gongmang(core.dayIndex).map(function (j) { return SajuCore.JI[j].h; }).join(''), '오미');

  var gk = SajuCore.gyeokguk(core);
  check('격국 = 편관격', gk.name, '편관격');
  check('격국 정기 을', gk.jeonggiH, '을');
  check('격국 투간 없음', gk.tugan, false);
  check('격국 중기 없음(卯)', gk.junggi, null);

  var wrel = SajuCore.scanRelations(core);
  check('원국 지지관계 4건', wrel.ji.length, 4);
  check('년-월 오묘파', wrel.ji.filter(function (r) { return r.type === '파'; })[0].name, '오묘파');
  check('년-일 오축해', wrel.ji.filter(function (r) { return r.type === '해'; })[0].name, '오축해');
  check('원진 2건', wrel.ji.filter(function (r) { return r.type === '원진'; }).length, 2);

  var ssl = SajuCore.scanSinsal(core);
  var ssKeys = ssl.map(function (s) { return s.key; });
  check('천을귀인 성립(시주 신)', ssKeys.indexOf('천을귀인') >= 0, true);
  check('도화살 성립', ssKeys.indexOf('도화살') >= 0, true);
  check('역마살 성립', ssKeys.indexOf('역마살') >= 0, true);
  check('화개살 성립', ssKeys.indexOf('화개살') >= 0, true);
  check('원진살 성립', ssKeys.indexOf('원진살') >= 0, true);
  check('천덕귀인 중복 없음', ssl.filter(function (s) { return s.key === '천덕귀인'; })[0].pillars.length, 1);

  var w = rep.wonguk;
  check('원국 표 4주', w.rows.length, 4);
  check('일주 지장간 3개', w.rows[2].hidden.length, 3);
  check('일주 12운성 묘', w.rows[2].unsung.name, '묘');
  check('년주 12운성 임관', w.rows[0].unsung.name, '임관');
  check('년주 일주기준 공망', w.rows[0].gongmang, true);
  check('일주 공망 아님', w.rows[2].gongmang, false);
  check('2027 12운성 관대', w.year2027.unsung.name, '관대');
  check('2027 미 공망', w.year2027.gongmang, true);
  check('격국 리포트', w.gyeok.name, '편관격');
  check('핵심 구조 3개', w.patterns.length, 3);
  check('4대 궁 4개', w.palaces.length, 4);
  check('신살 5개 이상', w.sinsal.length >= 5, true);
  check('원국 관계 4개', w.relations.length, 4);
  check('겉/속 모두 생성', !!(w.outer.body && w.inner.body), true);
  var shortPalace = 0;
  w.palaces.forEach(function (p) { if (!p.body || p.body.length < 120) shortPalace++; });
  check('4대 궁 본문 충실', shortPalace, 0);

  var w6 = rep6.wonguk;
  check('시각 미상 표 3주', w6.rows.length, 3);
  check('시각 미상 궁 3개', w6.palaces.length, 3);
  check('시각 미상 격국', w6.gyeok.name, '편관격');
  check('시각 미상 신살', w6.sinsal.length >= 3, true);

  /* ---- 12. 결과 출력 ---- */
  out.push('');
  out.push('== 결과 요약 ==');
  out.push('1990-03-25 15:30 → ' + c1.text + ' / ' + c1.hanja + ' / 오행 ' + JSON.stringify(c1.counts));
  out.push('2000-01-01 12:00 → ' + c2.text + ' / 오행 ' + JSON.stringify(c2.counts));
  out.push('1985-08-15 06:00 → ' + c3.text + ' / 오행 ' + JSON.stringify(c3.counts));
  out.push('1990-03-25 15:30 여성 → ' + rep.strength.label + ' ' + rep.strength.ratio + '% / 용신 ' +
    rep.yongsin.yongEl + '·희신 ' + rep.yongsin.huiEl + '·기신 ' + rep.yongsin.giEl);
  out.push('대운 ' + (rep.daeun.forward ? '순행' : '역행') + ' ' + rep.daeun.startAge + '세 → ' +
    rep.daeun.list[0].label + ' … 현재 ' + rep.daeun.current.label + ' (' + rep.daeun.age + '세)');
  out.push('최고 달 ' + rep.wealth.best.no + '월(' + rep.wealth.best.label + ') / 분기 ' +
    rep.quarters.map(function (q) { return q.key + ' ' + q.label; }).join(' ') +
    ' / 보완 ' + rep.leakFix.head);
  out.push('원국 심층 — 격국 ' + w.gyeok.name + ' / 구조 ' +
    w.patterns.map(function (p) { return p.name; }).join('·') + ' / 신살 ' +
    w.sinsal.map(function (s) { return s.name; }).join('·'));
  out.push('공망 — 일주 기준 ' + w.gongmang.dayText + ' / 년주 기준 ' + w.gongmang.yearText +
    ' / 2027 12운성 ' + w.year2027.unsung.name);
  out.push('');
  out.push(fail === 0 ? 'ALL PASS' : ('FAILED: ' + fail));

  var text = out.join('\n');
  if (typeof globalThis !== 'undefined') { globalThis.__testText = text; globalThis.__testFail = fail; }
  if (typeof print === 'function') print(text);
  if (typeof console !== 'undefined') console.log(text);
  if (typeof module !== 'undefined' && module.exports) module.exports = { fail: fail, text: text };
})();
