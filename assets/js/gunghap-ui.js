/* ============================================================
 * 월령 · 2인 궁합 화면 (gunghap-ui.js)
 *  - 리포트 탭 전환(2027 내 리포트 / 2인 궁합)
 *  - A·B 생년월일시 입력 → Gunghap 계산 → 무료 미리보기 + 유료 리포트
 *  - 잠금 해제는 기존 라이선스 키 흐름(app.js 모달)을 그대로 쓴다.
 *  - 결과·공유 문구에는 생년월일을 쓰지 않는다.
 * ============================================================ */
(function () {
  'use strict';

  var $ = function (id) { return document.getElementById(id); };
  var LS_KEY = 'wolryeong.v1';

  var state = {
    view: 'solo',
    mode: 'lover',
    result: null,
    unlocked: false
  };

  function pad(n) { return (n < 10 ? '0' : '') + n; }

  var toastTimer = null;
  function toast(msg) {
    var t = $('toast');
    if (!t) return;
    t.textContent = msg;
    t.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.hidden = true; }, 2600);
  }

  function savedUnlocked() {
    try { return !!JSON.parse(localStorage.getItem(LS_KEY) || '{}').unlocked; } catch (e) { return false; }
  }

  /* ---------- 탭 ---------- */
  function setView(view) {
    state.view = view === 'gunghap' ? 'gunghap' : 'solo';
    var solo = state.view === 'solo';

    if ($('soloView')) $('soloView').hidden = !solo;
    if ($('ghView')) $('ghView').hidden = solo;

    Array.prototype.forEach.call(document.querySelectorAll('.modetab'), function (b) {
      var on = b.getAttribute('data-view') === state.view;
      b.classList.toggle('is-on', on);
      b.setAttribute('aria-selected', on ? 'true' : 'false');
    });

    /* 각 탭의 결과는 그 탭에서만 보인다 */
    var soloReport = window.__app && window.__app.state && window.__app.state.report;
    if ($('result')) $('result').hidden = !(solo && soloReport);
    if ($('ghResult')) $('ghResult').hidden = !(!solo && state.result);
  }

  Array.prototype.forEach.call(document.querySelectorAll('[data-view]'), function (el) {
    el.addEventListener('click', function (e) {
      setView(el.getAttribute('data-view'));
      var target = state.view === 'gunghap' ? $('ghForm') : $('birthForm');
      if (target) {
        e.preventDefault();
        var y = target.getBoundingClientRect().top + window.pageYOffset - 76;
        window.scrollTo({ top: Math.max(0, y), behavior: 'smooth' });
      }
    });
  });

  /* ---------- 관계 모드 ---------- */
  var MODE_HELP = {
    lover: '연인 모드 — 끌림과 마찰, 2027년 두 사람의 흐름을 봅니다.',
    business: '동업자 모드 — 재물 시너지에 가중치를 두고, 함께 돈을 버는 구조를 봅니다.'
  };

  Array.prototype.forEach.call(document.querySelectorAll('.mode-seg'), function (b) {
    b.addEventListener('click', function () {
      Array.prototype.forEach.call(document.querySelectorAll('.mode-seg'), function (x) {
        x.classList.remove('is-on');
        x.setAttribute('aria-checked', 'false');
      });
      b.classList.add('is-on');
      b.setAttribute('aria-checked', 'true');
      state.mode = b.getAttribute('data-mode') === 'business' ? 'business' : 'lover';
      if ($('ghModeHelp')) $('ghModeHelp').textContent = MODE_HELP[state.mode];
      if (state.result) recompute();
    });
  });

  /* ---------- 시각 모름 토글 ---------- */
  ['A', 'B'].forEach(function (k) {
    var cb = $('ghUnknown' + k), ti = $('ghTime' + k);
    if (!cb || !ti) return;
    cb.addEventListener('change', function () {
      ti.disabled = cb.checked;
      ti.style.opacity = cb.checked ? '.4' : '1';
    });
    ti.addEventListener('input', function () {
      if (ti.value && cb.checked) {
        cb.checked = false;
        ti.disabled = false;
        ti.style.opacity = '1';
      }
    });
  });

  /* ---------- 입력 읽기 ---------- */
  function readPerson(k) {
    var dv = $('ghDate' + k) ? $('ghDate' + k).value : '';
    if (!dv) return { error: k + '의 생년월일을 넣어 주세요.' };
    var p = dv.split('-').map(Number);
    if (p[0] < 1920 || p[0] > 2040) return { error: '1920~2040년 사이만 계산할 수 있습니다.' };

    var unknown = ($('ghUnknown' + k) && $('ghUnknown' + k).checked) || !($('ghTime' + k) && $('ghTime' + k).value);
    var tv = (($('ghTime' + k) && $('ghTime' + k).value) || '12:00').split(':').map(Number);

    return {
      year: p[0], month: p[1], day: p[2],
      hour: unknown ? null : tv[0],
      minute: unknown ? null : tv[1],
      timeUnknown: unknown
    };
  }

  function compute() {
    var a = readPerson('A'), b = readPerson('B');
    if (a.error) { toast(a.error); if ($('ghDateA')) $('ghDateA').focus(); return null; }
    if (b.error) { toast(b.error); if ($('ghDateB')) $('ghDateB').focus(); return null; }
    try {
      return window.Gunghap.fromBirth(a, b, state.mode);
    } catch (e) {
      toast(e.message || '궁합을 계산하지 못했습니다.');
      return null;
    }
  }

  function recompute() {
    var res = compute();
    if (!res) return;
    render(res);
    applyLock();
    if ($('ghResult')) $('ghResult').hidden = false;
  }

  /* ---------- 렌더 ---------- */
  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  function gradeClass(g) { return g === '좋음' ? 'good' : (g === '조심' ? 'care' : 'mid'); }

  function render(res) {
    state.result = res;
    var pv = window.Gunghap.freePreview(res);

    /* 무료 미리보기 */
    $('ghEyebrow').textContent = '2인 궁합 · ' + res.modeLabel;
    $('ghTitle').textContent = '두 사람의 2027년';
    $('ghScore').textContent = pv.score;
    $('ghBand').textContent = pv.bandTitle;
    $('ghAttractionName').textContent = pv.attractionName;
    $('ghAttraction').textContent = pv.attractionText;

    /* 좋은 달 1개 */
    var card = $('ghGoodMonthCard');
    card.innerHTML = '';
    var head = el('div', 'gh-good');
    head.appendChild(el('span', 'gh-good-no', pv.goodMonth.no + '월'));
    head.appendChild(el('span', 'pill ' + gradeClass(pv.goodMonth.grade), pv.goodMonth.grade));
    head.appendChild(el('span', 'gh-good-label', pv.goodMonth.label + (pv.goodMonth.range ? ' · ' + pv.goodMonth.range : '')));
    card.appendChild(head);
    card.appendChild(el('p', 'gh-month-comment', pv.goodMonth.comment));
    card.appendChild(el('p', 'note', '12개월 전체 캘린더는 전체 리포트에서 열립니다.'));

    /* 유료: 구간 해석 */
    $('ghBandTitle').textContent = res.score + '점 · ' + res.band.title;
    $('ghBandSummary').textContent = res.band.summary;
    $('ghBandAdvice').textContent = res.band.advice;

    var ys = res.yongsin;
    $('ghYongsin').textContent =
      'A의 부족한 오행은 ' + ys.a + ', B의 부족한 오행은 ' + ys.b + '입니다. ' +
      'A의 강한 오행은 ' + ys.strongA + ', B의 강한 오행은 ' + ys.strongB + '입니다. ' +
      '서로의 강한 오행이 상대의 부족한 자리를 채우면 재물 시너지에 가점이 붙습니다.';

    /* 축 */
    var box = $('ghAxes');
    box.innerHTML = '';
    res.axes.forEach(function (ax) {
      var cardEl = el('div', 'gh-axis');
      var top = el('div', 'gh-axis-top');
      top.appendChild(el('span', 'gh-axis-name', ax.name));
      var sc = el('span', 'gh-axis-score');
      sc.appendChild(el('b', null, String(ax.score)));
      sc.appendChild(document.createTextNode(' / ' + ax.max));
      top.appendChild(sc);
      cardEl.appendChild(top);
      var bar = el('div', 'gh-bar');
      var fill = el('i');
      fill.style.width = ax.percent + '%';
      bar.appendChild(fill);
      cardEl.appendChild(bar);
      cardEl.appendChild(el('p', null, ax.text));
      box.appendChild(cardEl);
    });

    /* 이어주는 코드 */
    var links = $('ghLinks');
    links.innerHTML = '';
    if (res.links.stem) {
      links.appendChild(linkItem(res.links.stem.title, res.links.stem.text));
    } else {
      links.appendChild(linkItem(res.links.stemNone.title, res.links.stemNone.text));
    }
    if (res.links.branches.length) {
      res.links.branches.forEach(function (b) {
        links.appendChild(linkItem(b.title, b.text, b.where));
      });
    }

    /* 부딪히는 지점 */
    var cl = $('ghClashes');
    cl.innerHTML = '';
    if (res.clashes.stemText) {
      cl.appendChild(linkItem(res.clashes.stemText.title, res.clashes.stemText.text, '일간·일간'));
    }
    res.clashes.chung.forEach(function (c) {
      cl.appendChild(linkItem(c.title || (c.pair + ' 충'), c.text || '', c.where + ' · ' + c.pair));
    });
    if (res.clashes.etc.length) {
      var chips = el('div', 'gh-chips');
      var seen = {};
      res.clashes.etc.forEach(function (c) {
        var key = c.kind + c.pair;
        if (seen[key]) return;
        seen[key] = true;
        chips.appendChild(el('span', 'gh-chip', c.kind + ' · ' + c.pair));
      });
      if (cl.children.length) cl.appendChild(el('div', 'divider'));
      cl.appendChild(linkItem(res.clashes.general.title, res.clashes.general.text));
      cl.appendChild(chips);
      var where = el('p', 'gh-where', res.clashes.etc.map(function (c) { return c.kind + ' ' + c.where; }).join(' · '));
      cl.appendChild(where);
    }
    if (!cl.children.length) {
      cl.appendChild(el('p', 'body-text', '일간과 지지에 직접 부딪히는 충·형·파·해가 없습니다.'));
    }

    /* 십성 */
    var tg = $('ghTenGod');
    tg.innerHTML = '';
    tg.appendChild(el('p', 'mini-label', 'B가 A에게 — ' + res.tenGod.nameAB));
    tg.appendChild(el('p', 'body-text', res.tenGod.textAB));
    tg.appendChild(el('div', 'divider'));
    tg.appendChild(el('p', 'mini-label', 'A가 B에게 — ' + res.tenGod.nameBA));
    tg.appendChild(el('p', 'body-text dim', res.tenGod.textBA));

    /* 12개월 */
    var cal = $('ghMonths');
    cal.innerHTML = '';
    res.months.forEach(function (m) {
      var row = el('div', 'gh-month');
      var left = el('div', 'gh-month-left');
      left.appendChild(el('span', 'gh-month-no', m.no + '월'));
      left.appendChild(el('span', 'pill ' + gradeClass(m.grade), m.grade));
      var body = el('div', 'gh-month-body');
      body.appendChild(el('p', 'gh-month-label', m.label + (m.range ? ' · ' + m.range : '')));
      body.appendChild(el('p', 'gh-month-comment', m.comment));
      var badge = [];
      if (m.personal.a) badge.push('A 일지와 ' + m.personal.a);
      if (m.personal.b) badge.push('B 일지와 ' + m.personal.b);
      if (badge.length) body.appendChild(el('p', 'gh-month-badge', '이 달 지지 · ' + badge.join(' / ')));
      row.appendChild(left);
      row.appendChild(body);
      cal.appendChild(row);
    });

    /* 갈등 대처법 */
    var ad = $('ghAdvice');
    ad.innerHTML = '';
    res.advice.forEach(function (a, i) {
      if (i) ad.appendChild(el('div', 'divider'));
      ad.appendChild(linkItem(a.title, a.advice, a.type));
    });

    /* 마무리 */
    $('ghClosingLabel').textContent = res.mode === 'business' ? '2027년, 두 사람의 돈' : '2027년, 두 사람에게';
    $('ghClosing').textContent = res.closing;
    $('ghDisclaimer').textContent = '* ' + res.disclaimer;

    /* 잠금 박스 문구 */
    var K = window.GUNGHAP_CONTENT;
    if (K) {
      $('ghLockDesc').textContent = K.paywall.ctaSub;
      if ($('ghUnlockBtnLabel')) $('ghUnlockBtnLabel').textContent = '전체 리포트 보기';
    }
  }

  function linkItem(title, text, where) {
    var box = el('div', 'gh-item');
    if (title) box.appendChild(el('h4', null, title));
    if (text) box.appendChild(el('p', null, text));
    if (where) box.appendChild(el('p', 'gh-where', where));
    return box;
  }

  /* ---------- 잠금 ---------- */
  function applyLock() {
    var prem = $('ghPremium');
    if (!prem) return;
    prem.classList.toggle('is-locked', !state.unlocked);
  }

  function setUnlocked(on) {
    state.unlocked = !!on;
    applyLock();
  }

  document.addEventListener('wolryeong:unlocked', function () { setUnlocked(true); });

  if ($('ghUnlockBtn')) {
    $('ghUnlockBtn').addEventListener('click', function () {
      if (window.__app && window.__app.openUnlockModal) window.__app.openUnlockModal('gunghap');
    });
  }

  /* 잠금 해제 뒤에는 궁합 결과로 스크룤 */
  window.__wolryeongAfterUnlock = function () {
    if (state.view !== 'gunghap' || !state.result) return false;
    var y = $('ghPremium').getBoundingClientRect().top + window.pageYOffset - 70;
    window.scrollTo({ top: Math.max(0, y), behavior: 'smooth' });
    return true;
  };

  /* 결제 모달에 궁합 상품 설명을 넣는다(닫을 때는 app.js가 원래 문구로 돌린다) */
  window.__ghModalScene = function () {
    var K = window.GUNGHAP_CONTENT;
    if (!K) return null;
    return {
      title: K.meta.product,
      items: [K.paywall.ctaSub, K.paywall.afterPurchase]
    };
  };

  /* ---------- 폼 ---------- */
  if ($('ghForm')) {
    $('ghForm').addEventListener('submit', function (e) {
      e.preventDefault();
      var res = compute();
      if (!res) return;
      render(res);
      setUnlocked(state.unlocked || savedUnlocked());
      if ($('ghResult')) $('ghResult').hidden = false;
      setTimeout(function () {
        var y = $('ghResult').getBoundingClientRect().top + window.pageYOffset - 64;
        window.scrollTo({ top: Math.max(0, y), behavior: 'smooth' });
      }, 60);
    });
  }

  if ($('ghRecalc')) {
    $('ghRecalc').addEventListener('click', function () {
      var target = $('ghForm');
      if (!target) return;
      var y = target.getBoundingClientRect().top + window.pageYOffset - 80;
      window.scrollTo({ top: Math.max(0, y), behavior: 'smooth' });
      if ($('ghDateA')) $('ghDateA').focus({ preventScroll: true });
    });
  }

  /* ---------- 공유 (점수·구간만) ---------- */
  if ($('ghShareBtn')) {
    $('ghShareBtn').addEventListener('click', function () {
      if (!state.result) return;
      var payload = {
        title: '월령 궁합 — 두 사람의 2027년',
        text: state.result.share,
        url: location.origin + location.pathname
      };
      if (navigator.share) {
        navigator.share(payload).catch(function () {});
      } else if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(payload.text + ' ' + payload.url)
          .then(function () { toast('결과를 복사했어요.'); })
          .catch(function () { toast(payload.text); });
      } else {
        toast(payload.text);
      }
    });
  }

  /* ---------- 가격 문구 ---------- */
  (function prices() {
    var c = window.CONFIG || {};
    if ($('ghLockPriceWas')) $('ghLockPriceWas').textContent = c.originalPriceLabel || '';
    if ($('ghLockPriceOff')) $('ghLockPriceOff').textContent = c.discountLabel || '';
    if ($('ghUnlockBtnPrice')) $('ghUnlockBtnPrice').textContent = c.priceLabel || '';
  })();

  /* ---------- 초기화 ---------- */
  state.unlocked = savedUnlocked();
  setUnlocked(state.unlocked);
  setView('solo');

  window.GunghapUI = {
    state: state,
    setView: setView,
    render: render,
    isActive: function () { return state.view === 'gunghap'; }
  };
})();
