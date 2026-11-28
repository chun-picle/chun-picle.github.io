/* ============================================================
 * 월령 · 2027 재물운 365일 캘린더 (calendar365.js)
 *
 *  - 브라우저 안에서 2027-01-01 ~ 2027-12-31(365일)의 일진(천간·지지)을 계산
 *  - 사용자 일간·신강/신약·용신과의 관계로 일별 재물운 점수와 짧은 해석을 산출
 *  - 표준 RFC 5545 .ics(구글 캘린더·아이폰 캘린더) 본문을 만든다
 *
 * 서버·외부 API를 쓰지 않는다. DOM을 만지지 않는 순수 계산 모듈이다.
 * ============================================================ */
(function (root) {
  'use strict';

  var S = root.SajuCore;

  var YEAR = 2027;
  var DOW_NAME = ['일', '월', '화', '수', '목', '금', '토'];
  var MONTH_NAME = ['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월'];

  /* 등급 — 화면·인쇄·.ics가 같은 말을 쓴다 */
  var GRADE_LABEL = { good: '좋은 흐름', mid: '보통', care: '신중' };
  var GOOD_MIN = 1.4;    /* 이 점수 이상이면 '좋은 흐름' (한 해 약 30%) */
  var CARE_MAX = -0.7;   /* 이 점수 이하이면 '신중' (한 해 약 30%) */

  /* 일별 짧은 해석 — 등급 × 그날 천간의 십성(나에게 들어오는 기운) */
  var PHRASE = {
    good: {
      재성: ['계약·입금·단가 협상이 잘 풀리는 날입니다. 미뤄둔 청구서를 보내기 좋습니다.',
        '돈이 부드럽게 도는 날입니다. 결제·정산·매출 확인을 오늘 끝내 두세요.'],
      식상: ['영업·제안·소개가 먹히는 날입니다. 연락과 발표를 몰아넣으세요.',
        '내 이야기를 꺼내기 좋은 날입니다. 견적서·소개서를 보내 보세요.'],
      관성: ['미팅·보고·서류 제출이 매끄러운 날입니다. 이름이 걸린 자리에 나가기 좋습니다.',
        '공식 절차가 술술 풀리는 날입니다. 신청·접수·면담을 잡으세요.'],
      인성: ['공부·서류·권리 정리에 힘이 붙는 날입니다. 계약서 검토와 등기 확인에 좋습니다.',
        '문서를 읽고 정리하기 좋은 날입니다. 약관과 조건을 오늘 확인하세요.'],
      비겁: ['내가 밀던 일을 직접 끝내기 좋은 날입니다. 혼자 결정해도 흔들리지 않습니다.',
        '내 페이스로 밀어붙이기 좋은 날입니다. 미뤄둔 결정 하나를 오늘 처리하세요.']
    },
    mid: {
      재성: ['무난한 날입니다. 결제·입금은 확인만 하고 큰 결정은 미루세요.',
        '평범한 날입니다. 지출은 적게, 확인은 꼼꼼하게.'],
      식상: ['무난한 날입니다. 아이디어는 모으되 발표는 다음 좋은 날로 미루세요.',
        '평범한 날입니다. 준비와 정리에 쓰면 좋습니다.'],
      관성: ['무난한 날입니다. 서류는 초안까지, 서명은 다음으로.',
        '평범한 날입니다. 약속은 잡되 계약서 서명은 미루세요.'],
      인성: ['무난한 날입니다. 문서·권리는 읽어만 두세요.',
        '평범한 날입니다. 공부와 정리로 에너지를 쓰세요.'],
      비겁: ['무난한 날입니다. 사람 만남은 가볍게, 돈 이야기는 짧게.',
        '평범한 날입니다. 내 일 하나만 끝내도 충분합니다.']
    },
    care: {
      재성: ['돈이 새기 쉬운 날입니다. 충동 결제와 큰 지출을 미루세요.',
        '지출이 새는 날입니다. 장바구니에 담아만 두고 오늘은 결제하지 마세요.'],
      식상: ['말이 앞서기 쉬운 날입니다. 문자·메일은 한 번 더 읽고 보내세요.',
        '표현이 세지는 날입니다. 윗사람에게 보내는 말은 초안으로 남겨 두세요.'],
      관성: ['압박과 마감이 몰리는 날입니다. 결제일·제출일을 미리 당겨 두세요.',
        '서류·절차에서 걸리는 날입니다. 서명과 접수는 하루 미루세요.'],
      인성: ['생각이 많아져 결정이 늦어지는 날입니다. 검토만 하고 결론은 내일로.',
        '문서에서 막히기 쉬운 날입니다. 약관은 내일 다시 읽으세요.'],
      비겁: ['사람과 몫이 얽히기 쉬운 날입니다. 동업·공동지출 이야기는 오늘 꺼내지 마세요.',
        '경쟁과 지출이 겹치는 날입니다. 비교하고 사는 일은 미루세요.']
    }
  };

  var REL_CLASH = {
    충: '일지와 부딪히는 날이라 이사·명의·큰 결제는 하루 미루세요.',
    형: '서류와 정산에서 마찰이 생기기 쉬우니 확인 절차를 한 번 더 두세요.',
    파: '약속이 틀어지기 쉬운 날입니다. 시간과 장소를 다시 확인하세요.',
    해: '말실수와 오해가 생기기 쉬운 날입니다. 통화는 짧게 끝내세요.'
  };

  var KIND_OF_SS = {
    편재: '재성', 정재: '재성', 식신: '식상', 상관: '식상',
    편관: '관성', 정관: '관성', 편인: '인성', 정인: '인성',
    비견: '비겁', 겁재: '비겁'
  };

  /* ---------- 날짜 도우미 ---------- */

  function pad(n) { return (n < 10 ? '0' : '') + n; }

  function dayIndexOf(y, m, d) {
    return ((S.jdn(y, m, d) + 49) % 60 + 60) % 60;
  }

  function dowOf(y, m, d) {
    /* 0=일 … 6=토 (Date 없이 계산) */
    return (S.jdn(y, m, d) + 1) % 7;
  }

  function dateKey(y, m, d) { return y + '-' + pad(m) + '-' + pad(d); }
  function compact(y, m, d) { return '' + y + pad(m) + pad(d); }

  /* ---------- 점수 ---------- */

  function strengthAdj(el, st) {
    var kind = S.kindOf(st.dmEl, el);
    if (st.label === '신약') return (kind === 'bi' || kind === 'in') ? 1.0 : -0.85;
    if (st.label === '신강') return (kind === 'bi' || kind === 'in') ? -0.7 : 0.45;
    return 0.05;
  }

  function favOf(el, ys) {
    if (!ys) return 'mid';
    if (el === ys.yongEl) return 'yong';
    if (el === ys.huiEl) return 'hui';
    if (el === ys.giEl) return 'gi';
    return 'mid';
  }

  /* 하루치 계산 — core·strength·yongsin만 있으면 어느 날짜든 같은 규칙 */
  function dayInfo(core, st, ys, y, m, d) {
    var idx = dayIndexOf(y, m, d);
    var gan = idx % 10, ji = idx % 12;
    var ss = S.sipsung(core.dayGan, gan);
    var ssJi = S.sipsungJi(core.dayGan, ji);
    var rel = S.relation(core.dayJi, ji);
    var elGan = S.GAN[gan].el, elJi = S.JI[ji].el;

    var BASE = root.Report.BASE_SCORE, REL_ADJ = root.Report.REL_ADJ;
    var score = (BASE[ss] || 0) * 0.55 + (BASE[ssJi] || 0) * 0.35;
    rel.forEach(function (r) { score += (REL_ADJ[r] || 0) * 0.9; });
    score += strengthAdj(elGan, st) * 0.9 + strengthAdj(elJi, st) * 0.7;

    var favGan = favOf(elGan, ys), favJi = favOf(elJi, ys);
    if (favGan === 'yong' || favJi === 'yong') score += 0.9;
    else if (favGan === 'hui' || favJi === 'hui') score += 0.45;
    else if (favGan === 'gi' || favJi === 'gi') score -= 0.9;

    if (core.counts[elGan] === 0) score += 0.25;
    else if (core.counts[elGan] >= 3) score -= 0.25;

    score = Math.round(score * 10) / 10;

    var grade = score >= GOOD_MIN ? 'good' : score <= CARE_MAX ? 'care' : 'mid';
    var kind = KIND_OF_SS[ss] || '비겁';
    var bank = PHRASE[grade][kind] || PHRASE[grade]['비겁'];
    var note = bank[(d + gan) % bank.length];

    /* 부딪히는 날은 이유를 한 줄 덧붙인다 — 같은 '신중'이라도 이유가 다르다 */
    if (grade !== 'good' && rel.length) {
      for (var i = 0; i < rel.length; i++) {
        if (REL_CLASH[rel[i]]) { note += ' ' + REL_CLASH[rel[i]]; break; }
      }
    } else if (grade === 'good' && rel.indexOf('합') >= 0) {
      note += ' 거래가 붙기 좋은 자리입니다.';
    } else if (grade === 'good' && favGan === 'yong' && favJi === 'yong') {
      note += ' 가장 힘이 되는 기운이 하루를 덮은 날입니다.';
    }

    return {
      date: dateKey(y, m, d),
      y: y, m: m, d: d,
      dow: dowOf(y, m, d),
      dowName: DOW_NAME[dowOf(y, m, d)],
      idx: idx,
      ganH: S.GAN[gan].h, ganHan: S.GAN[gan].han,
      jiH: S.JI[ji].h, jiHan: S.JI[ji].han,
      label: S.GAN[gan].h + S.JI[ji].h,
      hanja: S.GAN[gan].han + S.JI[ji].han,
      ss: ss, ssJi: ssJi,
      kind: kind,
      rel: rel,
      favGan: favGan, favJi: favJi,
      score: score,
      grade: grade,
      gradeLabel: GRADE_LABEL[grade],
      note: note,
      short: S.GAN[gan].h + S.JI[ji].h + '일 · ' + GRADE_LABEL[grade]
    };
  }

  function daysInMonth(y, m) {
    if (m === 2) return (y % 4 === 0 && (y % 100 !== 0 || y % 400 === 0)) ? 29 : 28;
    return [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][m - 1];
  }

  /* ---------- 한 해 전체 ---------- */
  function build(core, rep, opt) {
    opt = opt || {};
    var year = opt.year || YEAR;
    var st = rep.strength || S.strength(core);
    var ys = rep.yongsin;
    var days = [];
    var months = [];

    for (var m = 1; m <= 12; m++) {
      var list = [];
      var n = daysInMonth(year, m);
      for (var d = 1; d <= n; d++) {
        var info = dayInfo(core, st, ys, year, m, d);
        days.push(info);
        list.push(info);
      }
      var goods = list.filter(function (x) { return x.grade === 'good'; });
      var cares = list.filter(function (x) { return x.grade === 'care'; });
      months.push({
        no: m,
        name: MONTH_NAME[m - 1],
        days: list,
        good: goods.length,
        care: cares.length,
        mid: list.length - goods.length - cares.length,
        best: goods.slice().sort(function (a, b) { return b.score - a.score; })[0] || null,
        worst: cares.slice().sort(function (a, b) { return a.score - b.score; })[0] || null,
        bestDays: goods.slice().sort(function (a, b) { return b.score - a.score; }).slice(0, 3),
        careDays: cares.slice().sort(function (a, b) { return a.score - b.score; }).slice(0, 2)
      });
    }

    var allGood = days.filter(function (x) { return x.grade === 'good'; });
    var allCare = days.filter(function (x) { return x.grade === 'care'; });

    return {
      year: year,
      days: days,
      months: months,
      summary: {
        total: days.length,
        good: allGood.length,
        mid: days.length - allGood.length - allCare.length,
        care: allCare.length,
        goodPct: Math.round(allGood.length / days.length * 100),
        carePct: Math.round(allCare.length / days.length * 100),
        topGood: allGood.slice().sort(function (a, b) { return b.score - a.score; }).slice(0, 6),
        topCare: allCare.slice().sort(function (a, b) { return a.score - b.score; }).slice(0, 6)
      }
    };
  }

  /* ---------- .ics (RFC 5545) ---------- */

  function utf8Bytes(ch) {
    var c = ch.charCodeAt(0);
    if (c < 0x80) return 1;
    if (c < 0x800) return 2;
    if (c >= 0xD800 && c <= 0xDBFF) return 4;
    return 3;
  }

  /* 논리 줄을 75옥텟 이하로 접는다(계속 줄은 앞에 공백 하나). 멀티바이트 문자는 쪼개지 않는다. */
  function fold(line) {
    if (!line) return '';
    var pieces = [];
    var cur = '';
    var curBytes = 0;
    for (var i = 0; i < line.length; i++) {
      var code = line.charCodeAt(i);
      var chunk = line.charAt(i);
      var bytes;
      if (code >= 0xD800 && code <= 0xDBFF) { chunk += line.charAt(++i); bytes = 4; }
      else bytes = utf8Bytes(chunk);
      var limit = 75 - (pieces.length ? 1 : 0);
      if (curBytes + bytes > limit) {
        pieces.push(cur);
        cur = chunk;
        curBytes = bytes;
      } else {
        cur += chunk;
        curBytes += bytes;
      }
    }
    pieces.push(cur);
    return pieces.join('\r\n ');
  }

  /* TEXT 값 이스케이프: 역슬래시 → 세미콜론 → 콤마 → 줄바꿈 */
  function esc(v) {
    return String(v == null ? '' : v)
      .replace(/\\/g, '\\\\')
      .replace(/;/g, '\\;')
      .replace(/,/g, '\\,')
      .replace(/\r\n|\r|\n/g, '\\n');
  }

  function dtStamp(now) {
    var t = now || new Date();
    return '' + t.getUTCFullYear() + pad(t.getUTCMonth() + 1) + pad(t.getUTCDate()) +
      'T' + pad(t.getUTCHours()) + pad(t.getUTCMinutes()) + pad(t.getUTCSeconds()) + 'Z';
  }

  function nextDay(y, m, d) {
    var dm = daysInMonth(y, m);
    if (d < dm) return compact(y, m, d + 1);
    if (m < 12) return compact(y, m + 1, 1);
    return compact(y + 1, 1, 1);
  }

  /* .ics 본문 — 주요 길일·신중일 + 월별 요약 이벤트 */
  function ics(core, rep, opt) {
    opt = opt || {};
    var cal = opt.cal || build(core, rep, opt);
    var stamp = dtStamp(opt.now);
    var lines = [];
    var L = function (s) { lines.push(s); };

    L('BEGIN:VCALENDAR');
    L('VERSION:2.0');
    L('PRODID:-//Wolryeong//2027 Money Calendar//KO');
    L('CALSCALE:GREGORIAN');
    L('METHOD:PUBLISH');
    L('X-WR-CALNAME:' + esc('월령 · 2027 재물운 캘린더'));
    L('X-WR-TIMEZONE:Asia/Seoul');
    L('X-WR-CALDESC:' + esc('사주 일간·용신으로 계산한 2027년 365일 재물운. ' +
      '좋은 흐름 ' + cal.summary.good + '일 · 보통 ' + cal.summary.mid + '일 · 신중 ' + cal.summary.care + '일.'));

    var events = 0;
    cal.months.forEach(function (mo) {
      /* 1일 — 그 달 요약(한 달에 한 칸) */
      var first = mo.days[0];
      L('BEGIN:VEVENT');
      L('UID:wolryeong-2027-' + compact(cal.year, mo.no, 1) + '-summary@wolryeong-saju');
      L('DTSTAMP:' + stamp);
      L('DTSTART;VALUE=DATE:' + compact(cal.year, mo.no, 1));
      L('DTEND;VALUE=DATE:' + nextDay(cal.year, mo.no, 1));
      L('SUMMARY:' + esc('월령 · ' + mo.no + '월 재물운 요약 (좋은 날 ' + mo.good + '일)'));
      L('DESCRIPTION:' + esc(
        mo.no + '월은 좋은 흐름 ' + mo.good + '일, 보통 ' + mo.mid + '일, 신중 ' + mo.care + '일입니다. ' +
        (mo.best ? '가장 좋은 날은 ' + mo.best.m + '/' + mo.best.d + '(' + mo.best.label + ') — ' + mo.best.note + ' ' : '') +
        (mo.worst ? '가장 조심할 날은 ' + mo.worst.m + '/' + mo.worst.d + '(' + mo.worst.label + ') — ' + mo.worst.note : '')
      ));
      L('CATEGORIES:' + esc('월령 재물운,월 요약'));
      L('TRANSP:TRANSPARENT');
      L('END:VEVENT');
      events++;

      /* 그 달의 주요 길일 · 신중일 */
      mo.bestDays.forEach(function (day) {
        L('BEGIN:VEVENT');
        L('UID:wolryeong-2027-' + compact(day.y, day.m, day.d) + '-good@wolryeong-saju');
        L('DTSTAMP:' + stamp);
        L('DTSTART;VALUE=DATE:' + compact(day.y, day.m, day.d));
        L('DTEND;VALUE=DATE:' + nextDay(day.y, day.m, day.d));
        L('SUMMARY:' + esc('월령 · 좋은 흐름 ' + day.label + '일 — ' + day.ss));
        L('DESCRIPTION:' + esc(day.m + '월 ' + day.d + '일(' + day.dowName + ') ' + day.hanja + '일 · ' +
          day.ss + '·' + day.ssJi + ' · 재물운 ' + day.score + '점. ' + day.note));
        L('CATEGORIES:' + esc('월령 재물운,좋은 날'));
        L('TRANSP:TRANSPARENT');
        L('END:VEVENT');
        events++;
      });

      mo.careDays.forEach(function (day) {
        L('BEGIN:VEVENT');
        L('UID:wolryeong-2027-' + compact(day.y, day.m, day.d) + '-care@wolryeong-saju');
        L('DTSTAMP:' + stamp);
        L('DTSTART;VALUE=DATE:' + compact(day.y, day.m, day.d));
        L('DTEND;VALUE=DATE:' + nextDay(day.y, day.m, day.d));
        L('SUMMARY:' + esc('월령 · 신중 ' + day.label + '일 — 큰 결제 미루기'));
        L('DESCRIPTION:' + esc(day.m + '월 ' + day.d + '일(' + day.dowName + ') ' + day.hanja + '일 · ' +
          day.ss + '·' + day.ssJi + ' · 재물운 ' + day.score + '점. ' + day.note));
        L('CATEGORIES:' + esc('월령 재물운,신중한 날'));
        L('TRANSP:TRANSPARENT');
        L('END:VEVENT');
        events++;
      });
    });

    L('END:VCALENDAR');
    return { text: lines.map(fold).join('\r\n') + '\r\n', events: events };
  }

  function fileName(year) { return 'wolryeong-' + (year || YEAR) + '-money-calendar.ics'; }

  root.Calendar365 = {
    YEAR: YEAR,
    GRADE_LABEL: GRADE_LABEL,
    GOOD_MIN: GOOD_MIN,
    CARE_MAX: CARE_MAX,
    DOW_NAME: DOW_NAME,
    build: build,
    dayInfo: dayInfo,
    dayIndexOf: dayIndexOf,
    dowOf: dowOf,
    daysInMonth: daysInMonth,
    ics: ics,
    fold: fold,
    fileName: fileName
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = root.Calendar365;
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));
