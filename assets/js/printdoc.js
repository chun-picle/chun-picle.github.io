/* ============================================================
 * 월령 · PDF 소장용 문서 (printdoc.js)
 *
 * 화면의 복잡한 카드·버튼·입력폼을 인쇄용으로 다시 짜지 않고,
 * 리포트 계산 결과(core·rep)에서 소장용 문서를 새로 조립한다.
 * 화면에서는 #printDoc 이 숨겨져 있고, @media print 에서만 보인다.
 *
 * DOM을 만지지 않는 순수 문자열 생성 모듈이다.
 * ============================================================ */
(function (root) {
  'use strict';

  var C = root.CONTENT;

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function pad(n) { return (n < 10 ? '0' : '') + n; }

  function elColor(el) {
    var info = (C && C.ELEMENT_INFO && C.ELEMENT_INFO[el]) || null;
    return info ? info.color : '#8B8478';
  }

  function dateStr(core) {
    var i = core.input;
    var s = i.year + '.' + pad(i.month) + '.' + pad(i.day);
    s += i.timeUnknown ? ' · 시각 미상' : ' ' + pad(i.hour) + ':' + pad(i.minute);
    return s;
  }

  /* ---------- ① 브랜드 헤더 ---------- */
  function head(core, rep) {
    var p = core.pillarName.day;
    return '<header class="pd-head">' +
      '<div class="pd-brand"><span class="pd-mark">月</span><span class="pd-brand-name">월령 <em>月令</em></span></div>' +
      '<p class="pd-title">2027 정미년 · 돈·사업·계약·부동산 소장용 리포트</p>' +
      '<p class="pd-meta">' + esc(dateStr(core)) + ' · ' + (core.input.gender === 'm' ? '남성' : '여성') +
      ' · ' + esc(p.name) + '일주 · ' + esc(rep.dayMaster.name) + '</p>' +
      '<p class="pd-url">wolryeong-saju.vercel.app</p>' +
      '</header>';
  }

  /* ---------- ② 사주 명식표 ---------- */
  function chart(core, rep) {
    var p = core.pillarName;
    var order = [];
    if (p.hour) order.push({ key: 'hour', label: '시주', palace: '말년·자녀' });
    order.push({ key: 'day', label: '일주', palace: '나·배우자' });
    order.push({ key: 'month', label: '월주', palace: '부모·사회' });
    order.push({ key: 'year', label: '년주', palace: '조상·초년' });

    var cells = order.map(function (o) {
      var pl = p[o.key];
      var ssGan = pl.sipsungGan === '일간' ? '나' : pl.sipsungGan;
      return '<div class="pd-pillar' + (o.key === 'day' ? ' is-day' : '') + '">' +
        '<p class="pd-pillar-head">' + o.label + '<span>' + o.palace + '</span></p>' +
        '<p class="pd-ss">' + esc(ssGan) + '</p>' +
        '<p class="pd-char">' + esc(pl.ganHan) + '</p>' +
        '<p class="pd-char">' + esc(pl.jiHan) + '</p>' +
        '<p class="pd-ss">' + esc(pl.sipsungJi) + '</p>' +
        '<p class="pd-el">' + esc(pl.elGan) + ' · ' + esc(pl.elJi) + '</p>' +
        '</div>';
    }).join('');

    var els = rep.elements.map(function (e) {
      return '<span class="pd-el-chip"><i style="background:' + elColor(e.el) + '"></i>' + esc(e.el) +
        '(' + esc(e.han) + ') ' + e.count + '개 · ' + e.pct + '%</span>';
    }).join('');

    var st = rep.strength, ys = rep.yongsin;
    return '<section class="pd-block">' +
      '<h2 class="pd-h2"><b>01</b>사주 명식표 — 여덟 글자</h2>' +
      '<div class="pd-chart">' + cells + '</div>' +
      '<p class="pd-note">위·아래 작은 글씨는 나(일간)를 기준으로 본 그 글자의 기운 이름(십성)입니다.' +
      (p.hour ? '' : ' 출생 시각을 몰라 시주를 뺀 여섯 글자로 계산했습니다.') + '</p>' +
      '<div class="pd-el-row">' + els + '</div>' +
      '<div class="pd-keyline">' +
      '<p><b>내 힘</b> ' + esc(st.label) + ' · 나를 돕는 힘 ' + st.ratio + '%</p>' +
      '<p><b>용신</b> ' + esc(ys.yongEl) + '(' + esc(ys.yongHan) + ') · 가장 힘이 되는 기운</p>' +
      '<p><b>기신</b> ' + esc(ys.giEl) + '(' + esc(ys.giHan) + ') · 줄이면 좋은 기운</p>' +
      '<p><b>2027</b> ' + esc(rep.y2027.gan) + '·' + esc(rep.y2027.ji) + ' — ' + esc(rep.y2027.title) + '</p>' +
      '</div></section>';
  }

  /* ---------- ③ 지금 고민 맞춤 처방 ---------- */
  function concernBlock(cn) {
    if (!cn) return '';
    var basis = cn.basis.map(function (t) { return '<p class="pd-body">' + esc(t) + '</p>'; }).join('');
    var moves = cn.moves.map(function (m) {
      return '<div class="pd-li"><span class="pd-k">' + esc(m.k) + '</span>' +
        '<span class="pd-v">' + esc(m.v) + '</span></div>';
    }).join('');
    var traps = cn.traps.map(function (t) {
      return '<div class="pd-li is-trap"><span class="pd-k">' + esc(t.k) + '</span>' +
        '<span class="pd-v">' + esc(t.v) + '</span></div>';
    }).join('');
    return '<section class="pd-block">' +
      '<h2 class="pd-h2"><b>02</b>지금 고민 맞춤 처방 — ' + esc(cn.label) + '</h2>' +
      '<p class="pd-lead">' + esc(cn.lead) + '</p>' +
      basis +
      '<div class="pd-sub"><h3>지금 할 일</h3>' + moves + '</div>' +
      '<div class="pd-sub"><h3>피해야 할 함정</h3>' + traps + '</div>' +
      '<div class="pd-timing"><p><b>언제 움직일까</b> ' + esc(cn.timing) + '</p>' +
      '<p><b>기운 채우기</b> ' + esc(cn.rxLine) + '</p>' +
      '<p class="pd-year">' + esc(cn.yearLine) + '</p></div>' +
      '</section>';
  }

  /* ---------- ④ 4대 재물 영역 ---------- */
  function domains(rep) {
    var list = (rep.domains && rep.domains.list) || [];
    var cards = list.map(function (d) {
      var bullets = d.bullets.slice(0, 3).map(function (b) {
        return '<div class="pd-li"><span class="pd-k">' + esc(b.k) + '</span>' +
          '<span class="pd-v">' + esc(b.v) + '</span></div>';
      }).join('');
      return '<div class="pd-card">' +
        '<p class="pd-card-head"><span class="pd-mark-sm">' + esc(d.mark) + '</span>' + esc(d.title) + '</p>' +
        '<p class="pd-card-lead">' + esc(d.head) + '</p>' +
        bullets + '</div>';
    }).join('');
    return '<section class="pd-block">' +
      '<h2 class="pd-h2"><b>03</b>2027년 4대 재물 영역</h2>' +
      '<div class="pd-grid2">' + cards + '</div>' +
      '</section>';
  }

  /* ---------- ⑤ 12개월 흐름 ---------- */
  function months(rep) {
    var rows = rep.months.map(function (m) {
      var bars = '';
      for (var i = 1; i <= 5; i++) bars += '<i class="' + (i <= m.grade ? 'on' : '') + '"></i>';
      var fav = m.fav === 'yong' ? '용신' : m.fav === 'hui' ? '희신' : m.fav === 'gi' ? '기신' : '';
      return '<tr>' +
        '<td class="pd-m">' + m.no + '월<span>' + esc(m.label) + '</span></td>' +
        '<td class="pd-range">' + esc(m.range) + '</td>' +
        '<td class="pd-grade">' + bars + (fav ? '<em>' + fav + '</em>' : '') + '</td>' +
        '<td class="pd-mt">' + esc(m.title) + ' — ' + esc(m.actMoney) + '</td>' +
        '</tr>';
    }).join('');
    return '<section class="pd-block pd-flow">' +
      '<h2 class="pd-h2"><b>04</b>2027년 12개월 — 돈·계약 타이밍</h2>' +
      '<table class="pd-table"><thead><tr><th>달</th><th>구간</th><th>흐름</th><th>할 일</th></tr></thead>' +
      '<tbody>' + rows + '</tbody></table>' +
      '<p class="pd-note">월 구분은 달력이 아니라 계절이 바뀌는 날(절입일) 기준입니다.</p>' +
      '</section>';
  }

  /* ---------- ⑥ 365일 핵심 길일·주의일 ---------- */
  function calendar(cal) {
    if (!cal) return '';
    var pick = function (arr) {
      return arr.length ? arr.map(function (d) { return d.d + '일'; }).join('·') : '–';
    };
    var rows = cal.months.map(function (mo) {
      return '<tr>' +
        '<td class="pd-m">' + mo.no + '월</td>' +
        '<td class="pd-good">' + mo.good + '일</td>' +
        '<td class="pd-care">' + mo.care + '일</td>' +
        '<td>' + pick(mo.bestDays) + '</td>' +
        '<td>' + pick(mo.careDays) + '</td>' +
        '</tr>';
    }).join('');

    var topGood = cal.summary.topGood.map(function (d) {
      return '<li><b>' + d.m + '/' + d.d + '</b> ' + esc(d.label) + ' · ' + esc(d.note) + '</li>';
    }).join('');
    var topCare = cal.summary.topCare.map(function (d) {
      return '<li><b>' + d.m + '/' + d.d + '</b> ' + esc(d.label) + ' · ' + esc(d.note) + '</li>';
    }).join('');

    return '<section class="pd-block pd-flow">' +
      '<h2 class="pd-h2"><b>05</b>&nbsp;2027년 365일 재물운 — 핵심 길일·주의일</h2>' +
      '<p class="pd-sum">좋은 흐름 <b>' + cal.summary.good + '일</b> · 보통 ' + cal.summary.mid +
      '일 · 신중 <b>' + cal.summary.care + '일</b> (총 ' + cal.summary.total + '일)</p>' +
      '<table class="pd-table pd-table-cal"><thead><tr><th>달</th><th>좋은 날</th><th>신중한 날</th>' +
      '<th>주요 길일</th><th>주의일</th></tr></thead><tbody>' + rows + '</tbody></table>' +
      '<div class="pd-grid2 pd-toplists">' +
      '<div><p class="pd-sub-h">가장 좋은 날</p><ul class="pd-list">' + topGood + '</ul></div>' +
      '<div><p class="pd-sub-h">가장 조심할 날</p><ul class="pd-list">' + topCare + '</ul></div>' +
      '</div>' +
      '<p class="pd-note">일별 점수는 그날의 일진(천간·지지)과 내 일간·용신의 관계로 계산했습니다. ' +
      '캘린더 파일(.ics)은 사이트의 「2027 재물운 캘린더(.ics) 저장」 버튼으로 받을 수 있습니다.</p>' +
      '</section>';
  }

  function foot() {
    return '<footer class="pd-foot">' +
      '<p>월령의 리포트는 전통 명리학의 계산 규칙을 프로그램으로 옮긴 참고·오락용 콘텐츠입니다. ' +
      '의료·법률·투자 판단의 근거로 쓸 수 없으며, 어떤 결과도 미래를 보장하지 않습니다.</p>' +
      '<p>© 2026 월령 · wolryeong-saju.vercel.app</p>' +
      '</footer>';
  }

  /* ---------- 조립 ---------- */
  function build(o) {
    if (!o || !o.core || !o.rep) return '';
    return '<article class="pd-doc">' +
      head(o.core, o.rep) +
      chart(o.core, o.rep) +
      concernBlock(o.concern) +
      domains(o.rep) +
      months(o.rep) +
      calendar(o.cal) +
      foot() +
      '</article>';
  }

  root.PrintDoc = { build: build };
  if (typeof module !== 'undefined' && module.exports) module.exports = root.PrintDoc;
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));
