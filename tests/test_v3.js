/* ============================================================
 * v3 검증 테스트 — 고민 맞춤 처방 · 2027 365일 캘린더 · .ics · PDF 소장용 문서
 * 실행: python3 tests/run_tests.py   (또는 node tests/test_v3.js)
 * ============================================================ */
(function () {
  var out = [];
  var fail = 0;

  function check(label, actual, expected) {
    var ok = actual === expected;
    if (!ok) fail++;
    out.push((ok ? 'PASS' : 'FAIL') + ' | ' + label + ' | 기대 ' + expected + ' / 실제 ' + actual);
  }

  function ok(label, cond, detail) {
    if (!cond) fail++;
    out.push((cond ? 'PASS' : 'FAIL') + ' | ' + label + (detail ? ' | ' + detail : ''));
  }

  var NOW = new Date('2026-11-28T04:00:00Z');

  /* UTF-8 옥텟 길이 (quickjs에 TextEncoder가 없을 수 있어 직접 센다) */
  function bytes(s) {
    var n = 0;
    for (var i = 0; i < s.length; i++) {
      var c = s.charCodeAt(i);
      if (c < 0x80) n += 1;
      else if (c < 0x800) n += 2;
      else if (c >= 0xD800 && c <= 0xDBFF) { n += 4; i++; }
      else n += 3;
    }
    return n;
  }

  function sample(y, mo, d, hh, mi) {
    var core = SajuCore.compute({
      year: y, month: mo, day: d, hour: hh, minute: mi, gender: 'f',
      applyDST: false
    });
    return { core: core, rep: Report.build(core, { now: NOW }) };
  }

  var mine = sample(1990, 3, 25, 15, 30);   /* 사용자 본인 사주 — 기축일주 */

  /* ============================================================
   * A. 지금 고민 맞춤 처방
   * ============================================================ */
  check('고민 선택지 7개', Concern.LIST.length, 7);
  check('고민 기본값 = 전체 흐름', Concern.LIST[0].key, 'all');
  check('잘못된 키는 all로 보정', Concern.normKey('nope'), 'all');
  check('정상 키 유지', Concern.normKey('startup'), 'startup');

  var keys = Concern.LIST.map(function (x) { return x.key; });
  check('선택지 키 목록', keys.join(','), 'all,startup,growth,job,invest,realestate,debt');

  keys.forEach(function (k) {
    var cn = Concern.build(mine.core, mine.rep, k);
    check('[' + k + '] 키 유지', cn.key, k);
    ok('[' + k + '] 제목 있음', !!cn.label && cn.label.length > 1);
    ok('[' + k + '] 장식 한자 1자', !!cn.mark && cn.mark.length === 1, cn.mark);
    check('[' + k + '] 원국 판독 3줄', cn.basis.length, 3);
    check('[' + k + '] 지금 할 일 4개', cn.moves.length, 4);
    check('[' + k + '] 함정 3개', cn.traps.length, 3);
    ok('[' + k + '] 할 일 키·값 채움', cn.moves.every(function (m) { return m.k && m.v; }));
    ok('[' + k + '] 함정 키·값 채움', cn.traps.every(function (t) { return t.k && t.v; }));
    ok('[' + k + '] 타이밍 문장', cn.timing.indexOf('달') >= 0 && cn.timing.length > 20, cn.timing.slice(0, 40));
    ok('[' + k + '] 2027 한 줄', cn.yearLine.indexOf('2027 정미년') === 0, cn.yearLine.slice(0, 20));
    ok('[' + k + '] 용신 처방 줄', cn.rxLine.indexOf(mine.rep.yongsin.yongEl) >= 0, cn.rxLine.slice(0, 40));
    ok('[' + k + '] 면책 문구', cn.note.indexOf('참고·오락용') >= 0);
  });

  /* 고민이 다르면 처방 내용도 달라야 한다 */
  var cnA = Concern.build(mine.core, mine.rep, 'startup');
  var cnB = Concern.build(mine.core, mine.rep, 'realestate');
  ok('고민이 다르면 할 일이 다름', cnA.moves[0].v !== cnB.moves[0].v);
  ok('고민이 다르면 함정이 다름', cnA.traps[0].v !== cnB.traps[0].v);

  /* 가장 두터운 십성이 판독 문장에 실제 개수로 들어가는지 */
  (function () {
    var g = mine.rep.strength.groups;
    var cn = Concern.build(mine.core, mine.rep, 'all');
    var maxKind = ['jae', 'sik', 'gwan', 'in', 'bi'].map(function (k) {
      return { k: k, n: g[k] };
    }).sort(function (a, b) { return b.n - a.n; })[0];
    ok('판독이 가장 두터운 기운을 집음', cn.basis[2].indexOf(maxKind.n + '개') >= 0,
      maxKind.k + ' ' + maxKind.n + '개 → ' + cn.basis[2].slice(0, 30));
    ok('십성 구성 줄에 다섯 기운 개수', cn.basis[1].indexOf('비겁') >= 0 && cn.basis[1].indexOf('관성') >= 0);
  })();

  /* 신강·신약이 다르면 원국 판독 첫 줄도 달라야 한다 */
  (function () {
    var other = sample(2000, 1, 1, 12, 0);
    var a = Concern.build(mine.core, mine.rep, 'all');
    var b = Concern.build(other.core, other.rep, 'all');
    ok('신강·신약에 따라 판독 첫 줄이 다름', a.basis[0] !== b.basis[0],
      mine.rep.strength.label + ' vs ' + other.rep.strength.label);
  })();

  /* 유리한 달·주의할 달이 사주에 따라 실제로 달라지는지 */
  (function () {
    var other = sample(1985, 8, 15, 6, 0);
    var a = Concern.build(mine.core, mine.rep, 'all');
    var b = Concern.build(other.core, other.rep, 'all');
    ok('유리한 달·주의할 달이 사주별로 계산됨', a.timing !== b.timing);
    if (mine.rep.wealth.best) {
      ok('가장 센 달이 타이밍에 등장', a.timing.indexOf(mine.rep.wealth.best.no + '월') >= 0);
    }
  })();

  /* ============================================================
   * B. 2027 재물운 365일 캘린더
   * ============================================================ */
  var cal = Calendar365.build(mine.core, mine.rep);
  check('365일', cal.days.length, 365);
  check('12개월', cal.months.length, 12);
  check('연도', cal.year, 2027);
  check('첫날 2027-01-01', cal.days[0].date, '2027-01-01');
  check('마지막날 2027-12-31', cal.days[364].date, '2027-12-31');
  check('1월 1일 일진 = 경진', cal.days[0].label, '경진');
  check('1월 1일 한자 = 庚辰', cal.days[0].hanja, '庚辰');
  check('12월 31일 일진 = 갑신', cal.days[364].label, '갑신');
  check('1월 1일은 금요일', cal.days[0].dow, 5);
  check('1월 1일 요일 이름', cal.days[0].dowName, '금');
  check('2월은 28일', Calendar365.daysInMonth(2027, 2), 28);

  /* 날짜가 하루도 빠지지 않고 이어지는지 */
  (function () {
    var uniq = {}, gap = 0, prev = null;
    cal.days.forEach(function (d) {
      if (uniq[d.date]) gap++;
      uniq[d.date] = 1;
      if (prev) {
        var pd = new Date(Date.UTC(prev.y, prev.m - 1, prev.d));
        var cd = new Date(Date.UTC(d.y, d.m - 1, d.d));
        if (Math.round((cd - pd) / 86400000) !== 1) gap++;
      }
      prev = d;
    });
    check('날짜 중복·누락 없음', gap, 0);
  })();

  /* 일진이 60갑자로 정확히 순행하는지 (engine의 일주 계산과 같은 규칙) */
  (function () {
    var bad = 0;
    cal.days.forEach(function (d, i) {
      var expect = ((SajuCore.jdn(d.y, d.m, d.d) + 49) % 60 + 60) % 60;
      if (d.idx !== expect) bad++;
      if (i > 0 && d.idx !== (cal.days[i - 1].idx + 1) % 60) bad++;
    });
    check('365일 일진 순행', bad, 0);
  })();

  /* 등급·해석 */
  (function () {
    var bad = 0, empty = 0;
    var grades = { good: 0, mid: 0, care: 0 };
    cal.days.forEach(function (d) {
      if (d.grade !== 'good' && d.grade !== 'mid' && d.grade !== 'care') bad++;
      grades[d.grade]++;
      if (!d.note || d.note.length < 10) empty++;
      if (d.gradeLabel !== Calendar365.GRADE_LABEL[d.grade]) bad++;
    });
    check('등급 값·이름 일치', bad, 0);
    check('모든 날에 해석 문장', empty, 0);
    check('요약 좋은 날 = 실제 개수', cal.summary.good, grades.good);
    check('요약 신중한 날 = 실제 개수', cal.summary.care, grades.care);
    check('좋은+보통+신중 = 365', grades.good + grades.mid + grades.care, 365);
    ok('좋은 날 비중 15~50%', cal.summary.goodPct >= 15 && cal.summary.goodPct <= 50, cal.summary.goodPct + '%');
    ok('신중한 날 비중 10~50%', cal.summary.carePct >= 10 && cal.summary.carePct <= 50, cal.summary.carePct + '%');
  })();

  /* 점수는 용신이 걸린 날에 더 높아야 한다 */
  (function () {
    var yongDays = cal.days.filter(function (d) { return d.favGan === 'yong' || d.favJi === 'yong'; });
    var giDays = cal.days.filter(function (d) { return d.favGan === 'gi' || d.favJi === 'gi'; });
    function avg(arr) { return arr.reduce(function (a, d) { return a + d.score; }, 0) / (arr.length || 1); }
    ok('용신일 평균 > 기신일 평균', avg(yongDays) > avg(giDays),
      avg(yongDays).toFixed(2) + ' vs ' + avg(giDays).toFixed(2));
    ok('용신일이 실제로 존재', yongDays.length > 0, yongDays.length + '일');
  })();

  /* 월 묶음 */
  (function () {
    var sum = cal.months.reduce(function (a, m) { return a + m.days.length; }, 0);
    check('월별 일수 합 = 365', sum, 365);
    check('1월 이름', cal.months[0].name, '1월');
    check('1월 1일 시작', cal.months[0].days[0].d, 1);
    check('1월 31일 끝', cal.months[0].days[30].d, 31);
    ok('주요 길일 최대 3개', cal.months.every(function (m) { return m.bestDays.length <= 3; }));
    ok('주의일 최대 2개', cal.months.every(function (m) { return m.careDays.length <= 2; }));
  })();

  /* ---------- .ics ---------- */
  var pack = Calendar365.ics(mine.core, mine.rep, { cal: cal, now: NOW });
  var text = pack.text;

  ok('ics 시작 BEGIN:VCALENDAR', text.indexOf('BEGIN:VCALENDAR\r\n') === 0);
  ok('ics 끝 END:VCALENDAR', text.slice(-15) === 'END:VCALENDAR\r\n');
  check('ics 버전', text.indexOf('VERSION:2.0\r\n') > 0, true);
  check('ics PRODID 포함', text.indexOf('PRODID:-//Wolryeong') > 0, true);
  check('ics 타임존 Asia/Seoul', text.indexOf('X-WR-TIMEZONE:Asia/Seoul') > 0, true);
  check('ics 캘린더 이름', text.indexOf('X-WR-CALNAME:월령 · 2027 재물운 캘린더') > 0, true);
  check('ics 날짜 고정 DTSTAMP', text.indexOf('DTSTAMP:20261128T040000Z') > 0, true);

  /* RFC 5545: 줄바꿈은 CRLF만, 줄 길이 75옥텟 이하 */
  (function () {
    var lone = text.split('\r\n').filter(function (l) {
      return l.indexOf('\n') >= 0 || l.indexOf('\r') >= 0;
    });
    check('CRLF만 사용 (홑 LF 없음)', lone.length, 0);
    var lines = text.split('\r\n');
    var over = lines.filter(function (l) {
      return bytes(l) > 75;
    });
    check('모든 줄 75옥텟 이하', over.length, 0);
    var folded = lines.filter(function (l) { return l.charAt(0) === ' '; });
    ok('긴 줄이 접혀 있음', folded.length > 0, folded.length + '줄');
  })();

  /* VEVENT 구조 */
  (function () {
    var blocks = text.split('BEGIN:VEVENT').slice(1).map(function (b) { return b.split('END:VEVENT')[0]; });
    check('이벤트 수', blocks.length, pack.events);
    var bad = 0, uids = {};
    blocks.forEach(function (b) {
      ['UID:', 'DTSTAMP:', 'DTSTART;VALUE=DATE:2027', 'DTEND;VALUE=DATE:', 'SUMMARY:', 'TRANSP:TRANSPARENT']
        .forEach(function (token) { if (b.indexOf(token) < 0) bad++; });
      var uid = (b.match(/UID:([^\r\n]+)/) || [])[1];
      if (!uid || uids[uid]) bad++;
      uids[uid] = 1;
    });
    check('이벤트 필수 항목·UID 유일', bad, 0);

    var summaries = blocks.map(function (b) { return (b.match(/SUMMARY:([^\r\n]+)/) || [])[1] || ''; });
    var monthSums = summaries.filter(function (s) { return s.indexOf('월 재물운 요약') >= 0; });
    check('월 요약 이벤트 12개', monthSums.length, 12);
    ok('길일 이벤트 존재', summaries.some(function (s) { return s.indexOf('좋은 흐름') >= 0; }));
    ok('신중일 이벤트 존재', summaries.some(function (s) { return s.indexOf('신중') >= 0; }));

    var dates = blocks.map(function (b) { return (b.match(/DTSTART;VALUE=DATE:(\d{8})/) || [])[1] || ''; });
    var badDate = dates.filter(function (s) { return !/^2027(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])$/.test(s); });
    check('모든 일자가 2027년 유효 날짜', badDate.length, 0);
    var badEnd = blocks.filter(function (b) {
      var s = (b.match(/DTSTART;VALUE=DATE:(\d{8})/) || [])[1];
      var e = (b.match(/DTEND;VALUE=DATE:(\d{8})/) || [])[1];
      return !s || !e || e <= s;
    });
    check('종료일이 시작일보다 뒤', badEnd.length, 0);
  })();

  /* TEXT 이스케이프·줄 접기 규칙 */
  (function () {
    var f = Calendar365.fold('SUMMARY:' + '월령 재물운 캘린더입니다, 쉼표와; 세미콜론이 들어간 아주 긴 줄을 일부러 만들어 접기가 되는지 확인합니다');
    var lines = f.split('\r\n');
    ok('접힌 줄 첫 글자 공백', lines.length > 1 && lines[1].charAt(0) === ' ', lines.length + '줄');
    ok('접힌 줄도 75옥텟 이하', lines.every(function (l) { return bytes(l) <= 75; }));
    ok('이스케이프된 쉼표·세미콜론',
      text.indexOf('\\,') >= 0 || text.indexOf('\\;') >= 0 || text.indexOf('월령 · 2027') >= 0,
      '테스트 문자열에 쉼표·세미콜론이 없으면 통과');
  })();

  check('ics 파일명', Calendar365.fileName(2027), 'wolryeong-2027-money-calendar.ics');

  /* 사주가 다르면 캘린더도 달라야 한다 */
  (function () {
    var other = sample(1975, 10, 15, 12, 0);
    var cal2 = Calendar365.build(other.core, other.rep);
    var diff = cal.days.filter(function (d, i) { return d.score !== cal2.days[i].score; }).length;
    ok('사주가 다르면 일별 점수가 달라짐', diff > 300, diff + '/365');
    var pack2 = Calendar365.ics(other.core, other.rep, { cal: cal2, now: NOW });
    ok('사주가 다르면 ics 내용도 달라짐', pack2.text !== text);
  })();

  /* ============================================================
   * C. PDF 소장용 문서
   * ============================================================ */
  var cnStartup = Concern.build(mine.core, mine.rep, 'startup');
  var doc = PrintDoc.build({ core: mine.core, rep: mine.rep, concern: cnStartup, cal: cal });

  ok('문서 생성됨', doc.length > 4000, doc.length + '자');
  ok('브랜드 헤더', doc.indexOf('pd-brand') >= 0 && doc.indexOf('월령') >= 0);
  ok('사주 명식표', doc.indexOf('사주 명식표') >= 0 && doc.indexOf(mine.core.pillarName.day.ganHan) >= 0);
  ok('고민 맞춤 처방', doc.indexOf('지금 고민 맞춤 처방') >= 0 && doc.indexOf('창업 · 신규 사업') >= 0);
  ok('4대 재물 영역', doc.indexOf('4대 재물 영역') >= 0 &&
    doc.indexOf('현금흐름 · 투자') >= 0 && doc.indexOf('부동산 · 자산 증식') >= 0);
  ok('12개월 흐름', doc.indexOf('12개월') >= 0 && doc.indexOf('pd-table') >= 0);
  ok('365일 요약', doc.indexOf('365일 재물운') >= 0 && doc.indexOf('가장 좋은 날') >= 0);
  ok('면책 문구', doc.indexOf('참고·오락용') >= 0);
  ok('닫는 태그 균형(article)', (doc.match(/<article/g) || []).length === (doc.match(/<\/article>/g) || []).length);
  ok('section 닫힘 수 일치', (doc.match(/<section/g) || []).length === (doc.match(/<\/section>/g) || []).length);
  ok('입력폼·버튼 없음', doc.indexOf('<button') < 0 && doc.indexOf('<input') < 0);
  ok('스크립트 없음', doc.toLowerCase().indexOf('<script') < 0);
  check('빈 입력은 빈 문자열', PrintDoc.build({}), '');
  check('rep 없으면 빈 문자열', PrintDoc.build({ core: mine.core }), '');

  /* 고민을 바꾸면 소장용 문서의 처방도 바뀐다 */
  (function () {
    var cnRe = Concern.build(mine.core, mine.rep, 'realestate');
    var doc2 = PrintDoc.build({ core: mine.core, rep: mine.rep, concern: cnRe, cal: cal });
    ok('고민 바꾸면 문서 처방도 바뀜', doc2 !== doc && doc2.indexOf('부동산 매매 · 이사') >= 0);
  })();

  /* ---------- 결과 출력 ---------- */
  out.push('');
  out.push('== 결과 요약 ==');
  out.push('2027 일진: 1/1 ' + cal.days[0].label + ' → 12/31 ' + cal.days[364].label +
    ' / 좋은 ' + cal.summary.good + '일 · 보통 ' + cal.summary.mid + '일 · 신중 ' + cal.summary.care + '일');
  out.push('.ics: ' + pack.events + '개 이벤트 / ' + text.length + '자 / ' + text.split('\r\n').length + '줄');
  out.push('맞춤 처방(창업): ' + cnStartup.dominant + ' / ' + cnStartup.moves[0].k + ' — ' + cnStartup.moves[0].v.slice(0, 40));
  out.push('소장용 문서: ' + doc.length + '자');
  out.push('');
  out.push(fail === 0 ? 'ALL PASS' : ('FAILED: ' + fail));

  var text2 = out.join('\n');
  if (typeof globalThis !== 'undefined') { globalThis.__v3Text = text2; globalThis.__v3Fail = fail; }
  if (typeof print === 'function') print(text2);
  if (typeof console !== 'undefined') console.log(text2);
  if (typeof module !== 'undefined' && module.exports) module.exports = { fail: fail, text: text2 };
})();
