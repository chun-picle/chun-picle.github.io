/* ============================================================
 * 월령 · 화면 로직 (app.js)
 * ============================================================ */
(function () {
  'use strict';

  var $ = function (id) { return document.getElementById(id); };
  var state = { gender: 'f', core: null, report: null, unlocked: false };

  /* ---------- 저장소 ---------- */
  var LS_KEY = 'wolryeong.v1';
  function store(obj) {
    try { localStorage.setItem(LS_KEY, JSON.stringify(obj)); } catch (e) {}
  }
  function load() {
    try { return JSON.parse(localStorage.getItem(LS_KEY) || '{}'); } catch (e) { return {}; }
  }

  /* ---------- 토스트 ---------- */
  var toastTimer = null;
  function toast(msg) {
    var t = $('toast');
    t.textContent = msg;
    t.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.hidden = true; }, 2600);
  }

  /* ---------- 가격 · 할인 표시 ---------- */
  /* config.js의 priceLabel(판매가)·originalPriceLabel(정가)·discountLabel(할인율)을
     잠금 영역과 결제 모달에 함께 반영한다. */
  function setPriceText(id, value, hideWhenEmpty) {
    var el = $(id);
    if (!el) return;
    el.textContent = value || '';
    if (hideWhenEmpty) el.style.display = value ? '' : 'none';
  }
  function applyPrice() {
    var c = window.CONFIG || {};
    var now = c.priceLabel || '';
    var was = c.originalPriceLabel || '';
    var off = c.discountLabel || '';

    setPriceText('modalPrice', now);
    setPriceText('unlockBtnPrice', now);
    setPriceText('modalAnchor', c.anchorLabel || '');
    setPriceText('modalPriceWas', was, true);
    setPriceText('lockPriceWas', was, true);
    setPriceText('modalPriceOff', off, true);
    setPriceText('lockPriceOff', off, true);

    var gm = $('gumroadBtnPrice');
    if (gm) gm.textContent = now ? '(' + now + ')' : '';
  }

  /* ---------- 성별 토글 ---------- */
  Array.prototype.forEach.call(document.querySelectorAll('.seg'), function (b) {
    b.addEventListener('click', function () {
      Array.prototype.forEach.call(document.querySelectorAll('.seg'), function (x) {
        x.classList.remove('is-on'); x.setAttribute('aria-checked', 'false');
      });
      b.classList.add('is-on');
      b.setAttribute('aria-checked', 'true');
      state.gender = b.getAttribute('data-gender');
    });
  });

  /* ---------- 시각 모름 ---------- */
  var timeUnknown = $('timeUnknown'), timeInput = $('birthTime');
  timeUnknown.addEventListener('change', function () {
    timeInput.disabled = timeUnknown.checked;
    timeInput.style.opacity = timeUnknown.checked ? '.4' : '1';
  });
  timeInput.addEventListener('input', function () {
    if (timeInput.value && timeUnknown.checked) {
      timeUnknown.checked = false;
      timeInput.disabled = false;
      timeInput.style.opacity = '1';
    }
  });

  /* ---------- 렌더 ---------- */
  function elColor(el) { return (window.CONTENT.ELEMENT_INFO[el] || {}).color || '#999'; }

  function fmtBirth(core) {
    var i = core.input;
    var s = i.year + '.' + pad(i.month) + '.' + pad(i.day);
    s += i.timeUnknown ? ' 출생 · 시각 미상' : ' ' + pad(i.hour) + ':' + pad(i.minute);
    s += i.gender === 'm' ? ' · 남성' : ' · 여성';
    return s;
  }
  function pad(n) { return (n < 10 ? '0' : '') + n; }

  function renderPillars(core) {
    var p = core.pillarName;
    var order = [];
    if (p.hour) order.push({ key: 'hour', label: '시주', cls: '' });
    order.push({ key: 'day', label: '일주', cls: 'is-day' });
    order.push({ key: 'month', label: '월주', cls: '' });
    order.push({ key: 'year', label: '년주', cls: '' });

    var html = order.map(function (o) {
      var pl = p[o.key];
      var ssGan = pl.sipsungGan === '일간' ? '나' : pl.sipsungGan;
      return '<div class="pillar ' + o.cls + '">' +
        '<p class="pillar-head">' + o.label + '</p>' +
        '<p class="pillar-ss">' + ssGan + '</p>' +
        '<p class="pillar-char">' + pl.ganHan + '</p>' +
        '<p class="pillar-char">' + pl.jiHan + '</p>' +
        '<p class="pillar-ss">' + pl.sipsungJi + '</p>' +
        '<p class="pillar-el"><i class="el-dot" style="background:' + elColor(pl.elGan) + '"></i>' + pl.elGan +
        '<i class="el-dot" style="background:' + elColor(pl.elJi) + '; margin-left:5px"></i>' + pl.elJi + '</p>' +
        '</div>';
    }).join('');

    var wrap = $('pillars');
    wrap.className = 'pillars' + (p.hour ? '' : ' three');
    wrap.innerHTML = html;

    var note = '한자 위·아래 작은 글씨는 일간 기준 십성(十星)입니다. ';
    if (core.input.dstFixed) note += core.notes.join(' ') + ' ';
    if (!p.hour) note += '출생 시각을 몰라 시주를 제외한 6글자로 계산했습니다.';
    $('pillarNote').textContent = note;
  }

  function renderElements(rep) {
    var max = Math.max.apply(null, rep.elements.map(function (e) { return e.count; }));
    var html = rep.elements.map(function (e) {
      var pct = e.pct;
      var w = max ? Math.round(e.count / max * 100) : 0;
      return '<div class="el-row">' +
        '<span class="el-name">' + e.el + '</span>' +
        '<span class="el-track"><i class="el-fill" data-w="' + w + '" style="background:' + e.color + ';opacity:' + (e.count ? '.85' : '0') + '"></i></span>' +
        '<span class="el-val">' + pct + '%</span>' +
        '</div>';
    }).join('');
    $('elements').innerHTML = html;
    requestAnimationFrame(function () {
      Array.prototype.forEach.call(document.querySelectorAll('.el-fill'), function (f) {
        f.style.width = f.getAttribute('data-w') + '%';
      });
    });
    $('balanceTitle').textContent = rep.balance.title;
    $('balanceBody').textContent = rep.balance.body;
  }

  function renderFree(rep, core) {
    var p = core.pillarName;
    $('resultEyebrow').textContent = '사주 원국 · 2027 정미년';
    $('resultTitle').textContent = p.day.name + '일주 · ' + rep.dayMaster.name;
    $('resultSub').textContent = fmtBirth(core);

    $('iljuKey').innerHTML = rep.ilju.key.map(function (k) { return '<span>' + k + '</span>'; }).join('');
    $('iljuTitle').textContent = p.day.name + '일주 — ' + rep.ilju.title;
    $('iljuBody').textContent = rep.ilju.body;
    $('dmName').textContent = rep.dayMaster.name;
    $('dmSub').textContent = rep.dayMaster.sub;
    $('dmBody').textContent = rep.dayMaster.b;

    $('yearLine').textContent = rep.y2027.title;
    $('yearLead').textContent = rep.y2027.body.split('. ')[0] + '.';
  }

  function monthLabel(m) {
    return m.no + '월(' + m.label + ')';
  }

  function renderPremium(rep) {
    $('wealthHead').textContent = rep.wealth.head;
    $('wealthBody').textContent = rep.wealth.body;

    $('attackList').textContent = rep.wealth.attack.length
      ? rep.wealth.attack.map(function (m) { return monthLabel(m) + ' ' + m.range; }).join(' · ')
      : '뚜렷한 공격 구간이 없습니다. 이 해는 벌기보다 지키는 쪽이 남습니다.';
    $('defendList').textContent = rep.wealth.defend.length
      ? rep.wealth.defend.map(function (m) { return monthLabel(m) + ' ' + m.range; }).join(' · ')
      : '큰 위험 구간은 없습니다. 다만 큰 지출은 한 번 더 확인하세요.';

    if (rep.wealth.best) {
      var b = rep.wealth.best;
      $('bestMonthNote').textContent = '가장 힘이 실리는 달은 ' + b.no + '월(' + b.label + ', ' + b.range + ')입니다. ' +
        '계약·단가 협상·영업처럼 결과가 남는 일은 이 달에 몰아넣는 편이 좋습니다.';
    }

    $('months').innerHTML = rep.months.map(function (m) {
      /* 월 구분은 절입일 기준 */
      var bars = '';
      for (var i = 1; i <= 5; i++) bars += '<i class="' + (i <= m.grade ? 'on' : '') + '"></i>';
      var desc = m.body + (m.relNote ? ' ' + m.relNote : '');
      return '<div class="month-row">' +
        '<div><p class="month-no">' + m.no + '월</p><p class="month-ganji">' + m.label + '월</p><p class="month-range">' + m.range + '</p></div>' +
        '<div class="month-main"><p>' + m.title + '</p><p>' + desc + '</p></div>' +
        '<div class="grade">' + bars + '</div>' +
        '</div>';
    }).join('');

    var av = rep.avoid.months;
    $('avoidMonths').textContent = av.length
      ? av.map(function (m) {
        var r = m.rel.length ? m.rel.join('·') : (m.ganSS + ' 기운');
        return m.no + '월(' + r + ')';
      }).join(', ') + ' — 이 달에는 새 계약·큰 결제·이사를 겹치지 않게 잡으세요.'
      : '올해는 특별히 크게 부딪히는 달이 없습니다. 흐름을 그대로 가져가세요.';

    $('nobleDirs').innerHTML = rep.noble.list.map(function (n) {
      return '<span class="noble-dir"><b>' + n.han + '</b>' + n.ji + ' · ' + n.dir + '</span>';
    }).join('');
    var nb = '중요한 자리·계약·면담은 이 방향의 자리에서 잡으면 흐름이 덜 막힙니다. ';
    if (rep.avoid.dir) {
      nb += '다만 2027년 미(未)의 방향인 ' + rep.avoid.dir + ' 방향은 올해 내 일지와 부딪히니, 큰 결정을 그 자리에서 즉석으로 내리지는 마세요.';
    } else {
      nb += '올해 세운과 내 일지가 부딪히지 않아 방위로 인한 큰 마찰은 적은 편입니다.';
    }
    $('nobleBody').textContent = nb;

    var ssMax = Math.max.apply(null, Object.keys(rep.sipsung.map).map(function (k) { return rep.sipsung.map[k]; })) || 1;
    var order = ['비견', '겁재', '식신', '상관', '편재', '정재', '편관', '정관', '편인', '정인'];
    $('sipsungBars').innerHTML = order.map(function (k) {
      var c = rep.sipsung.map[k];
      var w = Math.round(c / ssMax * 100);
      return '<div class="ss-row"><span>' + k + '</span>' +
        '<span class="ss-track"><i class="ss-fill" style="width:' + w + '%"></i></span>' +
        '<span>' + c + '</span></div>';
    }).join('');
  }

  /* ---------- 계산 실행 ---------- */
  function run(data) {
    var core, rep;
    try {
      core = window.SajuCore.compute({
        year: data.year, month: data.month, day: data.day,
        hour: data.hour, minute: data.minute,
        timeUnknown: data.timeUnknown,
        gender: state.gender,
        applyDST: window.CONFIG.applyKoreanDST !== false
      });
      rep = window.Report.build(core);
    } catch (e) {
      toast(e.message || '계산에 실패했습니다.');
      return false;
    }
    state.core = core;
    state.report = rep;

    renderPillars(core);
    renderElements(rep);
    renderFree(rep, core);
    renderPremium(rep);

    state.unlocked = !!load().unlocked;
    applyLock();

    $('result').hidden = false;
    store({
      unlocked: state.unlocked,
      input: {
        year: data.year, month: data.month, day: data.day,
        hour: data.hour, minute: data.minute,
        timeUnknown: data.timeUnknown, gender: state.gender
      }
    });
    return true;
  }

  function applyLock() {
    var prem = $('premium');
    if (state.unlocked) prem.classList.remove('is-locked');
    else prem.classList.add('is-locked');
  }

  /* ---------- 폼 ---------- */
  $('birthForm').addEventListener('submit', function (e) {
    e.preventDefault();
    var dv = $('birthDate').value;
    if (!dv) { toast('생년월일을 넣어 주세요.'); $('birthDate').focus(); return; }

    var parts = dv.split('-').map(Number);
    var y = parts[0], mo = parts[1], d = parts[2];
    if (y < 1920 || y > 2040) { toast('1920~2040년 사이만 계산할 수 있습니다.'); return; }

    var unknown = timeUnknown.checked || !$('birthTime').value;
    var tv = ($('birthTime').value || '12:00').split(':').map(Number);

    var ok = run({
      year: y, month: mo, day: d,
      hour: unknown ? null : tv[0],
      minute: unknown ? null : tv[1],
      timeUnknown: unknown
    });
    if (ok) {
      setTimeout(function () {
        var top = $('result').getBoundingClientRect().top + window.pageYOffset - 64;
        window.scrollTo({ top: top, behavior: 'smooth' });
      }, 60);
    }
  });

  $('recalcBtn').addEventListener('click', function () {
    var top = $('form').getBoundingClientRect().top + window.pageYOffset - 80;
    window.scrollTo({ top: top, behavior: 'smooth' });
    $('birthDate').focus({ preventScroll: true });
  });

  /* ---------- 잠금 해제 ---------- */
  function openModal() {
    applyPrice();

    var gm = $('gumroadBtn');
    if (gm) {
      if (window.CONFIG.gumroadUrl) {
        gm.href = window.CONFIG.gumroadUrl;
        gm.classList.remove('is-off');
        gm.removeAttribute('aria-disabled');
      } else {
        gm.removeAttribute('href');
        gm.classList.add('is-off');
        gm.setAttribute('aria-disabled', 'true');
      }
    }

    var toss = $('tossBtn'), kakao = $('kakaoBtn');
    if (toss) {
      if (window.CONFIG.tossUrl) { toss.href = window.CONFIG.tossUrl; toss.hidden = false; toss.classList.remove('is-off'); }
      else { toss.removeAttribute('href'); toss.hidden = true; toss.classList.add('is-off'); }
    }
    if (kakao) {
      if (window.CONFIG.kakaoUrl) { kakao.href = window.CONFIG.kakaoUrl; kakao.hidden = false; kakao.classList.remove('is-off'); }
      else { kakao.removeAttribute('href'); kakao.hidden = true; kakao.classList.add('is-off'); }
    }

    var noPay = !window.CONFIG.gumroadUrl && !window.CONFIG.tossUrl && !window.CONFIG.kakaoUrl;
    $('payNote').textContent = noPay
      ? '결제 링크를 준비 중입니다. 지금은 데모 코드(' + window.CONFIG.demoCode + ')로 전체 리포트를 먼저 확인해 보세요.'
      : window.CONFIG.payNote;

    setMsg('', false);
    $('modal').hidden = false;
    document.body.style.overflow = 'hidden';
  }
  function closeModal() {
    $('modal').hidden = true;
    document.body.style.overflow = '';
  }

  $('unlockBtn').addEventListener('click', openModal);
  Array.prototype.forEach.call(document.querySelectorAll('[data-close]'), function (x) {
    x.addEventListener('click', closeModal);
  });

  if ($('gumroadBtn')) $('gumroadBtn').addEventListener('click', function (e) {
    if (!window.CONFIG.gumroadUrl) { e.preventDefault(); toast('결제 링크를 준비 중입니다. 데모 코드로 먼저 확인해 보세요.'); }
  });
  if ($('tossBtn')) $('tossBtn').addEventListener('click', function (e) {
    if (!window.CONFIG.tossUrl) { e.preventDefault(); toast('토스 송금 링크를 준비 중입니다. 데모 코드로 먼저 확인해 보세요.'); }
  });
  if ($('kakaoBtn')) $('kakaoBtn').addEventListener('click', function (e) {
    if (!window.CONFIG.kakaoUrl) { e.preventDefault(); toast('카카오페이 송금 링크를 준비 중입니다. 데모 코드로 먼저 확인해 보세요.'); }
  });

  /* ---------- 코드 검증 ---------- */
  var verifying = false;
  var verifyTimer = null;

  function setMsg(t, ok) {
    var m = $('codeMsg');
    if (!m) return;
    m.textContent = t || '';
    m.className = 'code-msg' + (ok === true ? ' ok' : ok === 'wait' ? ' is-wait' : '');
  }

  function setBusy(on) {
    var b = $('codeBtn'), i = $('codeInput');
    if (b) { b.disabled = !!on; b.textContent = on ? '확인 중…' : '확인'; }
    if (i) i.disabled = !!on;
  }

  function finishUnlock(msg) {
    state.unlocked = true;
    applyLock();
    store({ unlocked: true, input: state.core ? {
      year: state.core.input.year, month: state.core.input.month, day: state.core.input.day,
      hour: state.core.input.hour, minute: state.core.input.minute,
      timeUnknown: state.core.input.timeUnknown, gender: state.core.input.gender
    } : null });
    setMsg(msg || '확인됐습니다. 전체 리포트를 열었습니다.', true);
    setTimeout(function () {
      closeModal();
      var y = $('premium').getBoundingClientRect().top + window.pageYOffset - 70;
      window.scrollTo({ top: Math.max(0, y), behavior: 'smooth' });
    }, 700);
  }

  function localCodes() {
    var list = (window.CONFIG.accessCodes || []).map(function (x) { return String(x).trim().toUpperCase(); });
    if (window.CONFIG.demoCode) list.push(String(window.CONFIG.demoCode).trim().toUpperCase());
    return list;
  }

  /* Gumroad /v2/licenses/verify 로 라이선스 키 검증
     성공: success === true && !purchase.refunded && !purchase.chargebacked */
  function verifyGumroad(key) {
    var pid = String(window.CONFIG.gumroadProductId || '').trim();
    var url = window.CONFIG.gumroadVerifyUrl || 'https://api.gumroad.com/v2/licenses/verify';

    if (!pid) { setMsg('코드가 맞지 않습니다. 결제 후 받은 코드를 다시 확인해 주세요.', false); return; }
    if (typeof fetch !== 'function') {
      setMsg('이 브라우저에서는 코드 확인이 어렵습니다. 최신 크롬·사파리에서 다시 시도해 주세요.', false);
      return;
    }

    verifying = true;
    setBusy(true);
    setMsg('코드를 확인하는 중입니다…', 'wait');

    var body = 'product_id=' + encodeURIComponent(pid) +
      '&license_key=' + encodeURIComponent(key) +
      '&increment_uses_count=false';
    var settled = false;

    function done(fn) {
      if (settled) return;
      settled = true;
      clearTimeout(verifyTimer);
      verifying = false;
      setBusy(false);
      fn();
    }

    verifyTimer = setTimeout(function () {
      done(function () {
        setMsg('응답이 늦어지고 있습니다. 잠시 뒤 다시 눌러 주세요.', false);
      });
    }, window.CONFIG.gumroadTimeoutMs || 15000);

    fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body
    }).then(function (res) {
      return res.json().catch(function () { return null; });
    }).then(function (j) {
      done(function () {
        if (!j || typeof j !== 'object') {
          setMsg('코드를 확인하지 못했습니다. 잠시 뒤 다시 시도해 주세요.', false);
          return;
        }
        if (j.success === true) {
          var p = j.purchase || {};
          if (p.refunded) { setMsg('환불 처리된 구매입니다. 결제 내역을 확인해 주세요.', false); return; }
          if (p.chargebacked) { setMsg('지급 거부(차지백) 처리된 구매입니다. 결제 내역을 확인해 주세요.', false); return; }
          finishUnlock('확인됐습니다. 전체 리포트를 열었습니다.');
          return;
        }
        var m = String(j.message || '');
        if (/does not exist|invalid/i.test(m)) {
          setMsg('코드가 맞지 않습니다. 결제 후 메일로 받은 코드를 그대로 붙여넣어 주세요.', false);
        } else {
          setMsg('코드를 확인하지 못했습니다' + (m ? ' (' + m + ')' : '') + '. 잠시 뒤 다시 시도해 주세요.', false);
        }
      });
    }).catch(function () {
      done(function () {
        setMsg('Gumroad에 연결하지 못했습니다. 네트워크 확인 후 다시 시도해 주세요. 계속되면 결제하신 메일로 문의해 주세요.', false);
      });
    });
  }

  function tryUnlock(code) {
    var raw = String(code || '').trim();
    if (!raw) { setMsg('코드를 입력해 주세요.', false); return; }
    if (verifying) return;
    if (localCodes().indexOf(raw.toUpperCase()) >= 0) {
      finishUnlock('확인됐습니다. 전체 리포트를 열었습니다.');
      return;
    }
    verifyGumroad(raw);
  }

  $('codeBtn').addEventListener('click', function () { tryUnlock($('codeInput').value); });
  $('codeInput').addEventListener('keydown', function (e) {
    if (e.key === 'Enter') { e.preventDefault(); tryUnlock($('codeInput').value); }
  });

  /* ---------- 공유 ---------- */
  $('shareBtn').addEventListener('click', function () {
    var url = location.origin + location.pathname;
    var payload = {
      title: '월령 · 2027 정미년 사주 리포트',
      text: '2027년 내 사주로 재물운 봤는데, 월별로 돈 움직이는 달이 딱 갈리네. 절기까지 계산하는 만세력이야.',
      url: url
    };
    if (navigator.share) {
      navigator.share(payload).catch(function () {});
    } else if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(url).then(function () { toast('링크를 복사했어요.'); })
        .catch(function () { toast(url); });
    } else {
      var ta = document.createElement('textarea');
      ta.value = url; document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy'); toast('링크를 복사했어요.'); } catch (e) { toast(url); }
      document.body.removeChild(ta);
    }
  });

  /* ---------- 스크롤 상태 ---------- */
  window.addEventListener('scroll', function () {
    document.querySelector('.topbar').classList.toggle('is-stuck', window.pageYOffset > 8);
  }, { passive: true });

  /* ---------- 초기화 ---------- */
  (function init() {
    var saved = load();
    if (saved.unlocked) state.unlocked = true;

    if (window.CONFIG.contactEmail) {
      $('footerInfo').innerHTML = '문의 ' + window.CONFIG.contactEmail + '<br>' + (window.CONFIG.businessInfo || '');
    } else {
      $('footerInfo').textContent = window.CONFIG.businessInfo || '';
    }
    applyPrice();

    if (saved.input) {
      var i = saved.input;
      $('birthDate').value = i.year + '-' + pad(i.month) + '-' + pad(i.day);
      if (i.timeUnknown) {
        timeUnknown.checked = true;
        timeInput.disabled = true;
        timeInput.style.opacity = '.4';
      } else {
        $('birthTime').value = pad(i.hour) + ':' + pad(i.minute);
      }
      if (i.gender) {
        state.gender = i.gender;
        Array.prototype.forEach.call(document.querySelectorAll('.seg'), function (x) {
          var on = x.getAttribute('data-gender') === i.gender;
          x.classList.toggle('is-on', on);
          x.setAttribute('aria-checked', on ? 'true' : 'false');
        });
      }
      run({
        year: i.year, month: i.month, day: i.day,
        hour: i.hour, minute: i.minute, timeUnknown: i.timeUnknown
      });
    }
  })();

  window.__app = { run: run, state: state };
})();
