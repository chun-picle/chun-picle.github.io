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

  /* ---- 9. 결과 출력 ---- */
  out.push('');
  out.push('== 결과 요약 ==');
  out.push('1990-03-25 15:30 → ' + c1.text + ' / ' + c1.hanja + ' / 오행 ' + JSON.stringify(c1.counts));
  out.push('2000-01-01 12:00 → ' + c2.text + ' / 오행 ' + JSON.stringify(c2.counts));
  out.push('1985-08-15 06:00 → ' + c3.text + ' / 오행 ' + JSON.stringify(c3.counts));
  out.push('');
  out.push(fail === 0 ? 'ALL PASS' : ('FAILED: ' + fail));

  var text = out.join('\n');
  if (typeof globalThis !== 'undefined') { globalThis.__testText = text; globalThis.__testFail = fail; }
  if (typeof print === 'function') print(text);
  if (typeof console !== 'undefined') console.log(text);
  if (typeof module !== 'undefined' && module.exports) module.exports = { fail: fail, text: text };
})();
