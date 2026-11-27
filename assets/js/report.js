/* ============================================================
 * 월령 · 리포트 생성기 (report.js)
 * 사주 원국 + 해석 콘텐츠 → 화면용 리포트 객체
 *
 *  - 신강/신약 판정(득령·득지·득세)과 용신·희신·기신
 *  - 10년 대운 계산과 현재 대운 × 2027 세운
 *  - 2027 4대 영역(재물·직업·연애·건강)
 *  - 12개월 심화(천간 십성 × 지지 십성 × 일지 관계 × 신강/신약)
 *  - 분기별 로드맵
 * ============================================================ */
(function (root) {
  'use strict';

  var C = root.CONTENT;
  var S = root.SajuCore;

  var DIR_NAME = ['북', '북북동', '동북동', '동', '동남동', '남남동',
    '남', '남남서', '서남서', '서', '서북서', '북북서'];

  var CHEONEUL = [[1, 7], [0, 8], [11, 9], [11, 9], [1, 7], [0, 8], [1, 7], [2, 6], [3, 5], [3, 5]];

  /* 도화(桃花) — 삼합국 기준: 인오술→묘, 신자진→유, 사유축→오, 해묘미→자 */
  var DOHWA = [9, 6, 3, 0, 9, 6, 3, 0, 9, 6, 3, 0];

  var BASE_SCORE = {
    비견: 0.2, 겁재: -1.0, 식신: 1.5, 상관: 0.0,
    편재: 2.2, 정재: 2.0, 편관: -1.4, 정관: 1.2,
    편인: -0.4, 정인: 1.0
  };
  var REL_ADJ = { 합: 1.0, 충: -1.4, 형: -0.9, 파: -0.5, 해: -0.6 };

  var ELS = ['목', '화', '토', '금', '수'];

  /* 십성 이름 옆에 붙이는 짧은 풀이 — 처음 나오는 자리에서 한 번씩 */
  var SS_SHORT = {
    비견: '내 주관·경쟁의 기운', 겁재: '몫을 나누는 경쟁의 기운',
    식신: '재능·표현의 기운', 상관: '드러내는 표현의 기운',
    편재: '크게 들고 나는 돈의 기운', 정재: '꾸준히 쌓이는 돈의 기운',
    편관: '센 책임·압박의 기운', 정관: '반듯한 책임·평판의 기운',
    편인: '남다른 배움의 기운', 정인: '배움·도움의 기운'
  };
  function ssShort(name) {
    return name + (SS_SHORT[name] ? '(' + SS_SHORT[name] + ')' : '');
  }

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

  function fmtPct(n) { return Math.round(n) + '%'; }

  /* 받침에 맞춰 조사를 붙인다: josa('수','가','이') → '수가' */
  function josa(word, withB, withoutB) {
    var ch = String(word).charAt(String(word).length - 1);
    var c = ch.charCodeAt(0);
    if (c < 0xAC00 || c > 0xD7A3) return word + withoutB;
    return word + ((c - 0xAC00) % 28 !== 0 ? withB : withoutB);
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

  /* ---------- 신강/신약 + 용신 ---------- */

  function favorOf(el, ys) {
    if (!ys) return 'mid';
    if (el === ys.yongEl) return 'yong';
    if (el === ys.huiEl) return 'hui';
    if (el === ys.giEl) return 'gi';
    return 'mid';
  }

  function buildYongsin(core, st) {
    var el = st.el, g = st.groups;
    var yongEl, huiEl, giEl, reason;

    var kindGloss = {
      bi: '나와 같은 편, 내 주관·추진의 기운',
      in: '배움·생각·도움받는 기운',
      sik: '아이디어·표현·실행의 기운',
      jae: '돈과 결과를 만드는 기운',
      gwan: '직장·책임·사회적 기준의 기운'
    };
    var kindLabel = { bi: '비겁', in: '인성', sik: '식상', jae: '재성', gwan: '관성' };
    function g5(kind, elName) {
      return elName + '(' + kindLabel[kind] + ' · ' + kindGloss[kind] + ')';
    }

    if (st.label === '신강') {
      if (g.gwan > 0) {
        yongEl = el.gwan; huiEl = el.jae;
        reason = '내 힘이 넘치는 편(신강)인데, 책임의 기운 ' + g5('gwan', yongEl) + '이 ' + g.gwan + '개 있어 넘치는 힘을 받아낼 그릇이 이미 있습니다. 그 힘을 일·직책·평판으로 쏟아내는 것이 가장 자연스럽고, 안으로만 쓰면 고집과 소모로 돌아섭니다.';
      } else if (g.jae > 0) {
        yongEl = el.jae; huiEl = el.sik;
        reason = '내 힘이 넘치는 편(신강)인데 책임의 기운이 얇습니다. 이때는 돈과 결과의 기운 ' + g5('jae', yongEl) + '으로 힘을 밖에 쓰는 편이 좋습니다. 내가 직접 다루는 돈이라 통제가 관건입니다.';
      } else {
        yongEl = el.sik; huiEl = el.bi;
        reason = '내 힘이 넘치는데 돈과 책임의 기운이 모두 얇습니다. 이때는 아이디어·표현의 기운 ' + g5('sik', yongEl) + '으로 재능을 밖에 풀어내는 것이 처방입니다. 만들고 표현하는 일이 곧 힘을 빼는 장치입니다.';
      }
      giEl = el.in;
    } else if (st.label === '신약') {
      if (g.in > 0) {
        yongEl = el.in; huiEl = el.bi;
        reason = '내 힘이 얇은 편(신약)인데, 배움의 기운 ' + g5('in', yongEl) + '이 ' + g.in + '개 있습니다. 공부·자격·사람의 도움으로 뿌리를 채우는 것이 먼저이고, 돈을 쫓기 전에 몸값과 기반을 올려야 힘이 남습니다.';
      } else {
        yongEl = el.bi; huiEl = el.in;
        reason = '내 힘도 얇고 배움의 기운도 얇은 편이라, 나와 같은 편 ' + g5('bi', yongEl) + '의 힘으로 서야 합니다. 동료·가족·협력자를 곁에 두고, 혼자 다 짊어지면 재능보다 체력이 먼저 바닥납니다.';
      }
      giEl = g.jae > 0 ? el.jae : el.gwan;
    } else {
      var minEl = ELS[0], maxEl = ELS[0];
      ELS.forEach(function (e) {
        if (core.counts[e] < core.counts[minEl]) minEl = e;
        if (core.counts[e] > core.counts[maxEl]) maxEl = e;
      });
      yongEl = minEl;
      huiEl = S.inElement(minEl);
      giEl = maxEl === minEl ? el.gwan : maxEl;
      reason = '나를 돕는 힘과 소모되는 힘이 비슷해 균형이 잡힌 편(중화)입니다. 이때는 가장 얇은 ' + minEl + ' 기운을 채우는 쪽으로 사람·장소·일을 고르면 흐름이 살아납니다.';
    }

    var rx = C.ELEMENT_RX[yongEl];
    var giRx = C.ELEMENT_RX[giEl];

    return {
      yongEl: yongEl, huiEl: huiEl, giEl: giEl,
      yongHan: S.ELEMENT_HAN[yongEl], huiHan: S.ELEMENT_HAN[huiEl], giHan: S.ELEMENT_HAN[giEl],
      reason: reason,
      rx: rx,
      giRx: giRx,
      yongRole: C.YONG_ROLE.yong,
      huiRole: C.YONG_ROLE.hui,
      giRole: C.YONG_ROLE.gi
    };
  }

  /* ---------- 대운 ---------- */

  function daeunTone(d, ys) {
    var s = 0;
    [d.elGan, d.elJi].forEach(function (e) {
      var f = favorOf(e, ys);
      if (f === 'yong') s += 1;
      else if (f === 'hui') s += 0.5;
      else if (f === 'gi') s -= 1;
    });
    if (s >= 1) return { key: 'good', label: '길', score: s };
    if (s <= -0.8) return { key: 'bad', label: '주의', score: s };
    return { key: 'mid', label: '중립', score: s };
  }

  function buildDaeun(core, st, ys, now) {
    var gender = (core.input && core.input.gender) || 'f';
    var dn = S.daeun(core, { gender: gender });
    var age = S.ageOn(core.input, now);

    dn.list.forEach(function (d) {
      var t = daeunTone(d, ys);
      d.tone = t.key;
      d.toneLabel = t.label;
      d.ganTheme = C.DAEUN_SS[d.ganSS] ? C.DAEUN_SS[d.ganSS].gan : '';
      d.jiTheme = C.DAEUN_SS[d.jiSS] ? C.DAEUN_SS[d.jiSS].ji : '';
    });

    var cur = S.currentDaeun(dn, age);
    var idx = cur ? cur.index : (age < dn.startAge ? 0 : dn.list.length - 1);
    var item = dn.list[idx];
    var upcoming = age < dn.startAge;

    var curRel = S.relation(item.ji, core.dayJi);
    var body = '이 10년은 ' + item.ganH + item.jiH + '의 기운으로, 겉기운(천간)은 ' + ssShort(item.ganSS) +
      ', 바탕기운(지지)은 ' + ssShort(item.jiSS) + '인 구간입니다. ' + item.ganTheme + '. ' + item.jiTheme;
    if (curRel.length) {
      body += ' 이 10년의 바탕 글자 ' + item.jiH + '가 내 자리(일지) ' + core.dayPillar.jiH + josaS(core.dayPillar.jiH, '과', '와') + ' ' + curRel.join('·') +
        '이라, 삶의 형태(사는 곳·일하는 자리·관계)가 실제로 바뀌는 사건이 이 안에서 일어납니다.';
    } else {
      body += ' 이 10년의 바탕 글자가 내 자리와 직접 부딪히지 않아, 바깥 환경보다 내 선택으로 판이 갈리는 구간입니다.';
    }
    body += item.tone === 'good'
      ? ' 나에게 힘이 되는 기운(용신·희신)이 실린 10년이라 밀어붙인 일이 남습니다.'
      : item.tone === 'bad'
        ? ' 줄여야 할 기운(기신)이 실린 10년이라 확장보다 지키는 운영이 필요합니다.'
        : ' 특별히 힘이 되지도 걸리지도 않는, 준비한 만큼 나오는 담백한 구간입니다.';

    /* 2027 정미년 × 현재 대운 */
    var yGan = 3, yJi = 7;
    var ySS = S.sipsung(core.dayGan, yGan);
    var yJiSS = S.sipsungJi(core.dayGan, yJi);
    var relDY = S.relation(item.ji, yJi);
    var relDYD = S.relation(item.ji, core.dayJi);
    var yFavGan = favorOf(S.GAN[yGan].el, ys);
    var yFavJi = favorOf(S.JI[yJi].el, ys);

    var favPhrase;
    if ((yFavGan === 'yong' || yFavGan === 'hui') && (yFavJi === 'yong' || yFavJi === 'hui')) {
      favPhrase = '겉기운과 바탕기운이 모두 나에게 힘이 되는 쪽(용신·희신)이라, 이 10년 안에서 가장 힘이 실리는 해입니다';
    } else if ((yFavGan === 'gi' || yFavGan === 'mid') && (yFavJi === 'gi' || yFavJi === 'mid') && (yFavGan === 'gi' || yFavJi === 'gi')) {
      favPhrase = '겉기운과 바탕기운에 줄여야 할 기운(기신)이 깔려, 해가 갈수록 무거워지니 지출과 약속을 줄이는 쪽이 이깁니다';
    } else {
      favPhrase = '겉기운과 바탕기운의 유불리가 엇갈려, 상반기와 하반기의 체감이 다릅니다';
    }

    var with2027 = '2027 정미년은 ' + item.label + ' 대운 안에서 겉기운 ' + ssShort(ySS) + '·바탕기운 ' + ssShort(yJiSS) +
      '의 해입니다. ' + favPhrase + '. ';
    if (relDY.length) {
      with2027 += '이 10년의 바탕 글자 ' + item.jiH + '와 2027년의 글자 ' + S.JI[yJi].h + '가 ' + relDY.join('·') +
        '이라, 이 10년의 큰 방향이 2027년에 한 번 크게 흔들리며 구체적인 사건으로 나타납니다. ';
    } else {
      with2027 += '10년의 바탕 글자와 2027년 글자가 직접 부딪히지 않아, 10년의 흐름 위에 2027년의 색이 얹히는 해입니다. ';
    }
    if (relDYD.length) {
      with2027 += '여기에 2027년의 글자 ' + S.JI[yJi].h + '가 내 자리(일지)와 ' + relDYD.join('·') +
        '이니, 관계·거처·소속의 변화가 실제로 생기는 해로 읽습니다.';
    } else {
      with2027 += '2027년의 글자가 내 자리와 직접 부딪히지 않아, 관계의 큰 틀은 유지되는 편입니다.';
    }

    var whoYear = S.GAN[core.yearPillar.gan].yang ? '양년' : '음년';
    var who = whoYear + (gender === 'm' ? ' 남성' : ' 여성');
    var dirText = (dn.forward ? '순행' : '역행');
    var dirReason = who + '이라 ' + (dn.forward ? '다음 절입일' : '이전 절입일') +
      '까지의 날짜를 3일=1년으로 나눠, 10년 운이 시작되는 나이(대운수)를 잡습니다.';

    return {
      forward: dn.forward,
      directionText: dirText,
      directionReason: dirReason,
      whoText: who,
      dayGap: dn.dayGap,
      yearsExact: dn.yearsExact,
      startAge: dn.startAge,
      gender: gender,
      age: age,
      currentIndex: idx,
      current: item,
      upcoming: upcoming,
      list: dn.list,
      head: item.label + ' 대운 — ' + item.ganTheme,
      body: body,
      with2027: with2027
    };
  }

  /* ---------- 12개월 ---------- */

  function strengthAdj(el, st) {
    var kind = S.kindOf(st.dmEl, el);
    if (st.label === '신약') return (kind === 'bi' || kind === 'in') ? 1.0 : -0.85;
    if (st.label === '신강') return (kind === 'bi' || kind === 'in') ? -0.7 : 0.45;
    return 0.05;
  }

  function buildMonthly(core, st, ys) {
    var dJi = core.dayJi;
    var out = [];
    var usedTitles = {};
    var REL_ORDER = ['충', '형', '해', '파', '합'];

    function push(mon, range) {
      var ss = S.sipsung(core.dayGan, mon.gan);
      var ssJi = S.sipsungJi(core.dayGan, mon.ji);
      var rel = S.relation(mon.ji, dJi);
      var elGan = S.GAN[mon.gan].el;
      var elJi = S.JI[mon.ji].el;

      var score = (BASE_SCORE[ss] || 0) * 0.62;
      score += (BASE_SCORE[ssJi] || 0) * 0.38;
      rel.forEach(function (r) { score += (REL_ADJ[r] || 0); });
      score += strengthAdj(elGan, st) + strengthAdj(elJi, st) * 0.85;

      /* 용신·희신·기신이 걸린 달은 세기를 한 번 더 조정 */
      var favGan = favorOf(elGan, ys), favJi = favorOf(elJi, ys);
      var fav = 'mid';
      if (favGan === 'yong' || favJi === 'yong') fav = 'yong';
      else if (favGan === 'hui' || favJi === 'hui') fav = 'hui';
      else if (favGan === 'gi' && favJi === 'gi') fav = 'gi';
      else if (favGan === 'gi' || favJi === 'gi') fav = 'gi';
      score += fav === 'yong' ? 1.1 : fav === 'hui' ? 0.6 : fav === 'gi' ? -1.2 : 0;

      if (core.counts[elGan] === 0) score += 0.3;
      else if (core.counts[elGan] >= 3) score -= 0.3;

      score = Math.round(score * 10) / 10;

      var relSentence = C.MONTH_REL_NONE[out.length % C.MONTH_REL_NONE.length];
      for (var i = 0; i < REL_ORDER.length; i++) {
        if (rel.indexOf(REL_ORDER[i]) >= 0) { relSentence = C.MONTH_REL[REL_ORDER[i]]; break; }
      }
      var favEl = (favGan === fav) ? elGan : elJi;
      if (fav === 'yong') favEl = favGan === 'yong' ? elGan : elJi;
      if (fav === 'hui') favEl = favGan === 'hui' ? elGan : elJi;
      if (fav === 'gi') favEl = favGan === 'gi' ? elGan : elJi;
      var favBank = C.MONTH_FAV[fav === 'mid' ? 'mid' : fav];
      var favSentence = favBank[out.length % favBank.length].replace('{el}', favEl);

      var title = C.MONTH_HEAD[ss] + ' — ' + C.MONTH_TAIL[ssJi];
      if (usedTitles[title]) title = title + ' (' + (out.length + 1) + '월)';
      usedTitles[title] = true;

      var actMoney = C.MONTH_ACT.money[ss];
      if (fav === 'gi') actMoney += ' 이 달은 기신이 걸려 있으니 새 결제·새 투자는 만들지 마세요.';

      var actRelation = C.MONTH_ACT.rel[ssJi];
      if (rel.length) actRelation += ' ' + (C.RELATION_NOTE[rel[0]] || '');

      out.push({
        no: out.length + 1,
        name: mon.name,
        label: mon.label,
        ganSS: ss,
        jiSS: ssJi,
        rel: rel,
        relNote: relSentence,
        fav: fav,
        favEl: favEl,
        grade: gradeOf(score),
        score: score,
        range: range,
        title: title,
        body: [C.MONTH_GAN[ss], C.MONTH_JI[ssJi], relSentence, favSentence].join(' '),
        actMoney: actMoney,
        actRelation: actRelation
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

  /* ---------- 분기 ---------- */

  function buildQuarters(months) {
    var arr = [1, 2, 3, 4].map(function (q) {
      var ms = months.filter(function (m) { return Math.ceil(m.no / 3) === q; });
      var sum = ms.reduce(function (a, m) { return a + m.score; }, 0);
      var avg = Math.round(sum / ms.length * 10) / 10;
      var sorted = ms.slice().sort(function (a, b) { return b.score - a.score; });
      var counts = {};
      ms.forEach(function (m) { counts[m.ganSS] = (counts[m.ganSS] || 0) + 1; });
      var dominant = Object.keys(counts).sort(function (a, b) { return counts[b] - counts[a]; })[0];
      return {
        key: 'Q' + q,
        months: ms,
        avg: avg,
        best: sorted[0],
        worst: sorted[sorted.length - 1],
        dominant: dominant,
        label: ''
      };
    });

    var ranked = arr.slice().sort(function (a, b) { return b.avg - a.avg; });
    ranked[0].label = '공격';
    ranked[ranked.length - 1].label = '방어';
    var mids = ranked.slice(1, ranked.length - 1);
    mids.sort(function (a, b) { return b.avg - a.avg; });
    if (mids.length >= 2) { mids[0].label = '수확'; mids[1].label = '정비'; }
    else if (mids.length === 1) mids[0].label = '정비';

    arr.forEach(function (q) {
      var t = C.QUARTER_TEXT[q.label];
      q.head = t.head;
      var relWord = q.label === '공격' ? '네 분기 중 흐름이 가장 좋은 구간입니다. '
        : q.label === '방어' ? '네 분기 중 가장 눌리는 구간입니다. '
          : '';
      q.body = relWord + t.body + ' 이 분기의 중심 기운은 ' + ssShort(q.dominant) + '이고, 가장 힘이 실리는 달은 ' +
        q.best.no + '월(' + q.best.label + '), 가장 눌리는 달은 ' + q.worst.no + '월(' + q.worst.label + ')입니다.';
      q.action = C.MONTH_ACT.money[q.dominant];
    });
    return arr;
  }

  /* ---------- 4대 영역 ---------- */

  function buildDomains(core, st, ys, months, daeun, ySS, yJiSS) {
    var g = st.groups, el = st.el;
    var yGanEl = S.GAN[3].el, yJiEl = S.JI[7].el; /* 2027 丁未 */
    var yFavGan = favorOf(yGanEl, ys), yFavJi = favorOf(yJiEl, ys);
    var favWord = function (f) { return f === 'yong' ? '용신' : f === 'hui' ? '희신' : f === 'gi' ? '기신' : '중립'; };

    var attack = months.filter(function (m) {
      if (m.grade >= 4) return true;
      return m.grade === 3 && (m.ganSS === '편재' || m.ganSS === '정재' || m.ganSS === '식신');
    });
    var defend = months.filter(function (m) {
      if (m.grade === 1) return true;
      return m.grade <= 2 && (m.rel.indexOf('충') >= 0 || m.rel.indexOf('형') >= 0 || m.ganSS === '편관' || m.ganSS === '겁재');
    });
    var best = months.slice().sort(function (a, b) { return b.score - a.score; })[0];

    /* ---- 재물 ---- */
    var wealthHead, wealthBody;
    if (g.jae === 0) {
      wealthHead = '돈의 기운(재성)이 겉으로 없는 구조 — 돈의 통로를 직접 설계해야 합니다';
      wealthBody = '여덟 글자에 돈과 결과를 만드는 기운(재성, ' + el.jae + ')이 겉으로 드러나 있지 않습니다. 돈이 없다는 뜻이 아니라, 돈이 저절로 굴러오는 구조가 아니라는 뜻입니다. ' +
        C.DOMAIN_TEXT.wealth.method.sik + ' 남이 만든 판에 얹혀 가는 방식은 오래 못 갑니다.';
    } else if (g.jae >= 3) {
      wealthHead = '돈의 기운(재성) ' + g.jae + '개 — 돈이 크게 들고 나는 구조';
      wealthBody = '돈과 결과를 만드는 기운이 많아 돈의 흐름 자체는 활발합니다. 다만 새는 구멍도 그만큼 많아 벌어도 남지 않는 패턴이 생기기 쉽습니다. ' +
        '2027년은 통제 장치(고정 저축·지출 상한·동업 서면화)를 먼저 만들고 움직여야 재물이 남습니다.';
    } else {
      wealthHead = '돈의 기운(재성) ' + g.jae + '개 — 성실하게 쌓는 표준형 재물 구조';
      wealthBody = '돈과 결과를 만드는 기운이 균형 있게 자리하고 있습니다. 큰 한 방보다 반복되는 수입을 설계할 때 가장 크게 남는 구조입니다. ' +
        (attack.length
          ? '2027년에는 ' + attack.map(function (m) { return m.no + '월(' + m.label + ')'; }).join('·') +
            '에 돈이 움직이므로, 그 달에 계약·단가·판매를 몰아넣는 방식이 효율적입니다.'
          : '2027년에는 돈의 기운이 크게 힘을 받는 달이 없으니, 단가와 조건을 다듬어 두었다가 이듬해에 쓰는 편이 낫습니다.');
    }

    var methodKey = g.sik > 0 && g.sik >= g.jae ? 'sik'
      : g.jae > 0 ? 'jae'
        : g.gwan >= 2 ? 'gwan' : 'bi';
    var leakKey = g.bi >= 2 ? 'bi' : g.jae >= 3 ? 'jae' : g.in >= 2 ? 'in' : 'none';

    var wealthStrategy;
    if (ySS === '편인' || ySS === '정인') {
      wealthStrategy = '2027년은 배움·도움의 기운(인성·' + ySS + ')이 들어오는 해입니다. 돈을 굴리기보다 실력·자격·장비에 쓰는 돈이 몸값으로 남습니다. 이 기운은 현금이 도는 속도가 느리니, 고정비를 낮추고 돈의 기운이 힘을 받는 달에만 결제·투자를 몰아넣는 운영이 맞습니다.';
    } else if (ySS === '비견' || ySS === '겁재') {
      wealthStrategy = '2027년은 나와 같은 편의 기운(비겁·' + ySS + ')이 들어오는 해입니다. 내 몫을 직접 챙기는 쪽이 유리하지만, 사람과 돈이 함께 나뉘기 쉽습니다. 동업·보증·공동구매는 서면으로 남기고, 현금 잔고를 먼저 확인한 뒤 움직이세요.';
    } else if (ySS === '식신' || ySS === '상관') {
      wealthStrategy = '2027년은 재능을 꺼내 쓰는 기운(식상·' + ySS + ')이 들어오는 해입니다. 가진 재능을 상품으로 바꿔 파는 쪽이 가장 크게 남습니다. 만들기만 하고 팔지 않으면 성과가 흩어지니, 판매·계약까지 한 세트로 묶으세요.';
    } else if (ySS === '편재' || ySS === '정재') {
      wealthStrategy = '2027년은 돈의 기운(재성·' + ySS + ')이 직접 들어오는 해입니다. 기회가 넓게 오지만 관리하지 않으면 그대로 빠져나갑니다. 들어온 돈의 일정 비율을 자동이체로 묶는 규칙 하나만 정해두면 남는 장사가 됩니다.';
    } else {
      wealthStrategy = '2027년은 책임의 기운(관성·' + ySS + ')이 들어오는 해입니다. 직책·계약·평판이 곧 돈이 되는 구조라, 이름이 걸린 일에 힘을 쓰면 그대로 수익이 됩니다. 규칙과 절차를 지킬수록 빨리 갑니다.';
    }
    wealthStrategy += ' 2027년의 기운은 ' + favWord(yFavGan) + '·' + favWord(yFavJi) +
      '에 걸려 있어, ' + (yFavGan === 'gi' || yFavJi === 'gi'
        ? '들어오는 돈보다 나가는 돈을 먼저 막는 쪽이 이깁니다.'
        : '들어오는 흐름을 받아내기 좋은 편입니다. 용신은 나에게 힘이 되는 기운, 희신은 그 힘을 보태는 기운, 기신은 줄일수록 좋은 기운입니다.');

    var wealth = {
      key: 'wealth', title: '재물 · 투자운', mark: '財',
      head: wealthHead,
      body: wealthBody,
      bullets: [
        { k: '벌이 구조', v: C.DOMAIN_TEXT.wealth.method[methodKey] },
        { k: '새는 구멍', v: C.DOMAIN_TEXT.wealth.leak[leakKey] },
        { k: '2027 전략', v: wealthStrategy }
      ],
      attack: attack,
      defend: defend,
      best: best
    };

    /* ---- 직업 ---- */
    var pathKey = g.gwan >= 2 ? 'gwan'
      : g.in >= 2 ? 'in'
        : g.sik >= 2 ? 'sik'
          : g.jae >= 2 ? 'jae' : 'bi';
    var jobMonths = months.filter(function (m) {
      return (m.ganSS === '정관' || m.ganSS === '편관') && m.grade >= 3;
    });
    var freeMonths = months.filter(function (m) {
      return (m.ganSS === '식신' || m.ganSS === '상관') && m.grade >= 4;
    });

    var careerHead = '책임(관성) ' + g.gwan + ' · 배움(인성) ' + g.in + ' · 표현(식상) ' + g.sik + '의 구성 — ' +
      (pathKey === 'gwan' ? '조직에서 자리를 잡는 쪽'
        : pathKey === 'in' ? '전문성으로 몸값을 올리는 쪽'
          : pathKey === 'sik' ? '내 결과물로 이름을 만드는 쪽'
            : pathKey === 'jae' ? '거래를 직접 쥐는 쪽' : '혼자 책임지는 전문가 쪽');

    var careerBody = C.DOMAIN_TEXT.career.path[pathKey] + ' ';
    if (jobMonths.length) {
      careerBody += '승진·이직·계약을 밀기 좋은 달은 ' + jobMonths.map(function (m) {
        return m.no + '월(' + m.label + ')';
      }).join(', ') + '입니다. 책임의 기운(관성)이 힘을 받는 달이라 면접·발표·서류 통과가 쉽게 풀립니다.';
    } else {
      careerBody += '책임의 기운(관성)이 힘을 받는 달이 뚜렷하지 않아, 이직·승진을 서두르기보다 실적과 서류를 쌓아두는 편이 낫습니다. 굳이 움직여야 한다면 ' +
        months.slice().sort(function (a, b) { return b.score - a.score; }).slice(0, 2).map(function (m) { return m.no + '월'; }).join('·') + '처럼 흐름이 나은 달을 고르세요.';
    }
    if (g.sik > 0 && g.jae > 0 && st.label !== '태약') {
      careerBody += ' 표현의 기운(식상)과 돈의 기운(재성)이 함께 있어 독립의 그릇은 있습니다' +
        (freeMonths.length ? '. 특히 ' + freeMonths.map(function (m) { return m.no + '월'; }).join('·') +
          '에 내 결과물을 밖으로 꺼내면 반응이 옵니다.' : '. 다만 당장 뛰어나가기보다 반년 단위로 준비하세요.');
    }

    var career2027;
    if (ySS === '편관' || ySS === '정관') {
      career2027 = '2027년은 책임의 기운(관성·' + ySS + ')이 직접 들어오는 해라 직책·계약·평판이 실제로 바뀝니다. 규칙을 지키고 서류를 갖추는 사람이 자리를 가져갑니다.';
    } else if (ySS === '정인' || ySS === '편인') {
      career2027 = '2027년은 배움의 기운(인성·' + ySS + ')이 들어오는 해라, 새 자리를 벌이기보다 한 우물을 깊게 파는 포지셔닝이 맞습니다. 자격·교육·전문성이 다음 10년의 몸값이 됩니다.';
    } else if (ySS === '식신' || ySS === '상관') {
      career2027 = '2027년은 표현의 기운(식상·' + ySS + ')이 들어오는 해라, 내 이름으로 만든 결과물이 곧 이력서가 됩니다. 회사 안에서도 개인 프로젝트를 하나 남기세요.';
    } else if (ySS === '편재' || ySS === '정재') {
      career2027 = '2027년은 돈의 기운(재성·' + ySS + ')이 들어오는 해라, 영업·거래·단가 협상처럼 숫자로 남는 일에서 성과가 납니다.';
    } else {
      career2027 = '2027년은 나와 같은 편의 기운(비겁·' + ySS + ')이 들어오는 해라, 내 이름을 걸고 판을 짜는 쪽이 유리합니다. 대신 동료와의 역할 경계를 처음부터 문서로 정하세요.';
    }

    var career = {
      key: 'career', title: '직업 · 사업 · 이직', mark: '官',
      head: careerHead,
      body: careerBody,
      bullets: [
        { k: '맞는 길', v: C.DOMAIN_TEXT.career.path[pathKey] },
        { k: '타이밍', v: jobMonths.length ? jobMonths.map(function (m) { return m.no + '월(' + m.range + ')'; }).join(' · ') : '책임의 기운이 센 달이 뚜렷하지 않아 서류·실적을 쌓으며 ' + months.slice().sort(function (a, b) { return b.score - a.score; }).slice(0, 2).map(function (m) { return m.no + '월'; }).join('·') + '을 노리세요.' },
        { k: '2027 포지셔닝', v: career2027 }
      ]
    };

    /* ---- 연애·대인 ---- */
    var spouseSS = core.dayPillar.sipsungJi;
    var yRel = S.relation(core.dayJi, 7);
    var yRelNote = [];
    yRel.forEach(function (r) {
      if (r === '충') yRelNote.push('2027년 글자 미(未)가 내 배우자 자리와 부딪힙니다(충) — 동거·이사·이별·재회처럼 관계의 형태가 실제로 바뀌는 사건이 생기기 쉽습니다.');
      else if (r === '합') yRelNote.push('2027년 글자 미(未)가 내 배우자 자리와 붙습니다(합) — 미뤄둔 인연이 이어지거나 관계가 공식화되는 쪽으로 움직입니다.');
      else if (r === '형') yRelNote.push('2027년 글자 미(未)가 내 배우자 자리와 어긋납니다(형) — 말과 서류에서 마찰이 생기니 확인 절차를 두 배로 두세요.');
      else if (r === '파') yRelNote.push('2027년 글자 미(未)가 내 배우자 자리에 금을 냅니다(파) — 작은 균열이 크게 번지기 쉬운 해입니다.');
      else if (r === '해') yRelNote.push('2027년 글자 미(未)가 내 배우자 자리를 흠냅니다(해) — 뜻밖의 소문·오해가 돌 수 있습니다.');
    });
    var cheon = CHEONEUL[core.dayGan].indexOf(7) >= 0;
    if (cheon) yRelNote.push('2027년 미(未)는 나(' + S.GAN[core.dayGan].h + ')에게 천을귀인(막힐 때 길을 열어 주는 가장 센 좋은 별)이 서는 자리입니다. 흔들리는 자리에 귀인이 함께 오니, 갈등은 사람을 통해 풀립니다.');

    var dohwaYearJi = DOHWA[core.yearPillar.ji], dohwaDayJi = DOHWA[core.dayJi];
    var dohwaRelY = S.relation(7, dohwaYearJi);
    var dohwaRelD = S.relation(7, dohwaDayJi);
    var dohwaNote;
    if (dohwaRelD.length || dohwaRelY.length) {
      var r0 = dohwaRelD.length ? dohwaRelD : dohwaRelY;
      var dwJi = dohwaRelD.length ? dohwaDayJi : dohwaYearJi;
      dohwaNote = '사람을 끄는 힘(도화)은 ' + S.JI[dwJi].h + '(' + S.JI[dwJi].han + '·' + DIR_NAME[dwJi] + ') 자리에 있는데, 2027년 미(未)가 그와 ' + r0.join('·') +
        '이라 도화가 밖으로 터지기보다 한 사람·한 자리에 묶이는 모양입니다.';
    } else {
      dohwaNote = '사람을 끄는 힘(도화)은 ' + S.JI[dohwaDayJi].h + ' 자리에 있는데 2027년 미(未)와 직접 얽히지 않아, 이 해의 인연은 화려한 만남보다 이미 아는 사람 사이에서 이어집니다.';
    }

    var loveBody = C.DOMAIN_TEXT.love.spouse[spouseSS] + ' ' + dohwaNote + ' ' +
      (yJiSS === '비견' ? '2027년 바탕기운이 비견(내 주관·경쟁의 기운)이라 친구·동료 사이에서 내 자리를 세우는 해입니다. 관계의 경계를 말로 분명히 하는 것이 곧 예의입니다.' : '') +
      ' ' + (g.bi >= 2 ? '사주에 나와 같은 편의 기운(비겁)이 많아 가까운 사이일수록 몫과 주도권 이야기가 민감해집니다. 돈과 역할을 처음에 정해두면 다툼이 줄어듭니다.' : '');

    var love = {
      key: 'love', title: '연애 · 대인 · 배우자운', mark: '緣',
      head: '내 배우자 자리(일지) ' + core.dayPillar.jiH + ' — ' + spouseSS + '(그 자리에 앉은 기운) · ' + (yRel.length ? '2027년에 ' + josa(yRel.join('·'), '이', '가') + ' 걸린 자리' : '2027년에 직접 흔들리지 않는 자리'),
      body: loveBody,
      bullets: [
        { k: '배우자 자리', v: C.DOMAIN_TEXT.love.spouse[spouseSS] },
        { k: '2027 인연', v: yRelNote.length ? yRelNote.join(' ') : '2027년 글자가 배우자 자리와 직접 얽히지 않아, 관계의 큰 틀은 유지됩니다. 새 인연은 일과 사람을 통해 천천히 들어옵니다.' },
        { k: '주의', v: '감정이 오른 상태의 메시지·통화는 하루 묵혔다가 보내세요. 이 사주는 말의 온도에서 관계가 갈립니다.' }
      ]
    };

    /* ---- 건강 ---- */
    var weakEls = ELS.filter(function (e) { return core.counts[e] <= 1; });
    if (!weakEls.length) weakEls = [ELS.slice().sort(function (a, b) { return core.counts[a] - core.counts[b]; })[0]];
    var strongEl = ELS.slice().sort(function (a, b) { return core.counts[b] - core.counts[a]; })[0];
    var weakOrgan = weakEls.map(function (e) { return e + '(' + C.DOMAIN_TEXT.health.organ[e] + ')'; }).join(', ');

    var healthHead = '부족한 ' + weakEls.join('·') + ' · 넘치는 ' + strongEl + ' — ' +
      josa(C.DOMAIN_TEXT.health.organ[weakEls[0]], '을', '를') + ' 먼저 보세요';

    var seasonRows = [
      { q: '봄 (1~3월)', el: '목' },
      { q: '여름 (4~6월)', el: '화' },
      { q: '가을 (7~9월)', el: '금' },
      { q: '겨울 (10~12월)', el: '수' }
    ].map(function (s) {
      var weak = weakEls.indexOf(s.el) >= 0;
      var over = s.el === strongEl;
      var txt;
      if (weak) {
        txt = s.el + ' 기운이 얇아 ' + s.q + '에 ' + josa(C.DOMAIN_TEXT.health.organ[s.el], '이', '가') +
          ' 먼저 신호를 보냅니다. 무리한 일정을 피하고, 루틴은 ' + C.ELEMENT_RX[s.el].routine + ' 정도로 잡으세요.';
      } else if (over) {
        txt = s.el + ' 기운이 두꺼워 ' + s.q + '에 ' + C.DOMAIN_TEXT.health.organ[s.el] +
          ' 쪽 부담이 커집니다. ' + C.ELEMENT_RX[s.el].avoid + ' 같은 패턴을 줄이세요.';
      } else {
        txt = s.q + '은 ' + s.el + ' 기운이 무난합니다. 수면 시간을 고정하면 컨디션이 크게 흔들리지 않습니다.';
      }
      return { q: s.q, v: txt };
    });

    if (strongEl === '토') {
      seasonRows[0].v += ' 2027년 미(未)토까지 겹쳐 소화기·체중·부종이 늘기 쉬우니, 야식과 밀가루·당류를 줄이세요.';
    }

    var health = {
      key: 'health', title: '건강 · 컨디션', mark: '體',
      head: healthHead,
      body: '여덟 글자에서 ' + josa(weakEls.join('·'), '이', '가') + ' 얇고 ' + josa(strongEl, '이', '가') + ' ' + core.counts[strongEl] +
        '개로 넘칩니다. 부족한 쪽은 채우고 넘치는 쪽은 덜어내야 몸이 편합니다. ' +
        '2027년은 ' + yJiSS + '(바탕기운)이 들어오는 해라 ' + (strongEl === '토' ? '소화기와 체중' : '컨디션의 기복') +
        '을 먼저 살피세요. 병원 검진은 상반기에 미리 받아두면 하반기가 가볍습니다.',
      bullets: [
        { k: '취약 장기', v: weakOrgan },
        { k: '루틴', v: C.ELEMENT_RX[weakEls[0]].routine },
        { k: '피할 것', v: C.ELEMENT_RX[weakEls[0]].avoid }
      ],
      seasons: seasonRows
    };

    return { list: [wealth, career, love, health], wealth: wealth, career: career, love: love, health: health };
  }

  /* ---------- 원국 심층 해부 ---------- */

  var POS_DEF = [
    { key: 'year', label: '년주', palace: '초년 · 뿌리', range: '0~15세' },
    { key: 'month', label: '월주', palace: '청년 · 사회', range: '16~30세' },
    { key: 'day', label: '일주', palace: '나 · 배우자', range: '31~45세' },
    { key: 'hour', label: '시주', palace: '말년 · 자녀', range: '46세~' }
  ];

  var REL_AREA = {
    'year-month': '집안과 사회가 맞물리는 지점',
    'year-day': '초년의 습관이 지금의 나에게 남은 자리',
    'year-hour': '집안과 말년이 먼 거리에서 연결되는 지점',
    'month-day': '직장과 내 자리·배우자가 맞물리는 지점',
    'month-hour': '사회와 말년이 이어지는 지점',
    'day-hour': '배우자와 자녀·말년이 맞물리는 지점'
  };

  var LABEL_KEY = { '년주': 'year', '월주': 'month', '일주': 'day', '시주': 'hour' };

  /* 받침에 맞춰 조사만 붙인다: josaS('을','이','가') → '이' */
  function josaS(word, withB, withoutB) {
    var ch = String(word).charAt(String(word).length - 1);
    var c = ch.charCodeAt(0);
    if (c < 0xAC00 || c > 0xD7A3) return withoutB;
    return ((c - 0xAC00) % 28 !== 0) ? withB : withoutB;
  }

  function pairArea(a, b) {
    var ka = LABEL_KEY[a], kb = LABEL_KEY[b];
    if (!ka || !kb) return '';
    var order = ['year', 'month', 'day', 'hour'];
    if (order.indexOf(ka) > order.indexOf(kb)) { var t = ka; ka = kb; kb = t; }
    return REL_AREA[ka + '-' + kb] || '';
  }

  function buildWonguk(core, st, ssMap) {
    var p = core.pillarName, dg = core.dayGan;
    var gmDay = S.gongmang(core.dayIndex);
    var gmYear = S.gongmang(S.pillarIndex(core.yearPillar));
    var rel = S.scanRelations(core);

    function branchText(arr) {
      return arr.map(function (j) { return S.JI[j].h + '(' + S.JI[j].han + ')'; }).join('·');
    }

    var rows = [];
    POS_DEF.forEach(function (d) {
      var pl = p[d.key];
      if (!pl) return;
      var hidden = S.janganSipsung(dg, pl.ji);
      var uns = S.unsung(dg, pl.ji);
      rows.push({
        key: d.key, label: d.label, palace: d.palace, range: d.range,
        ganH: pl.ganH, ganHan: pl.ganHan, ganSS: pl.sipsungGan, ganEl: pl.elGan,
        jiH: pl.jiH, jiHan: pl.jiHan, jiSS: pl.sipsungJi, jiEl: pl.elJi,
        hidden: hidden, unsung: uns,
        gongmang: gmDay.indexOf(pl.ji) >= 0,
        gongmangYear: gmYear.indexOf(pl.ji) >= 0
      });
    });

    var gmPillars = rows.filter(function (r) { return r.gongmang; }).map(function (r) { return r.label; });
    var gmYearPillars = rows.filter(function (r) { return r.gongmangYear; }).map(function (r) { return r.label; });

    /* 2027 정미년 — 12운성 · 공망 */
    var uns2027 = S.unsung(dg, 7);
    var uns2027Text = C.UNSUNG_TEXT[uns2027.name];
    var y2027Gongmang = gmDay.indexOf(7) >= 0;

    /* 격국 */
    var gk = S.gyeokguk(core);
    var gt = C.GYEOK_TEXT[gk.name] || { head: gk.name, body: '' };
    var SS_GLOSS = {
      비견: '내 주관과 경쟁의 기운', 겁재: '몫을 나누는 경쟁의 기운',
      식신: '재능을 편하게 꺼내 쓰는 기운', 상관: '표현하고 드러내는 기운',
      편재: '크게 들고 나는 돈의 기운', 정재: '꾸준히 쌓이는 돈의 기운',
      편관: '세게 조여오는 책임과 압박의 기운', 정관: '반듯한 책임과 평판의 기운',
      편인: '남다르게 파고드는 배움의 기운', 정인: '배우고 도움받는 기운'
    };
    var gyeokBody = '태어난 달의 지지 ' + gk.monthJiH + '(' + gk.monthJiHan + ') 속 중심 기운인 ' +
      gk.jeonggiH + '(' + gk.jeonggiHan + ')' + josaS(gk.jeonggiH, '이', '가') + ' 나(일간)에게 ' +
      gk.ss + '(' + (SS_GLOSS[gk.ss] || '') + ')' + josaS(gk.ss, '으로', '로') + ' 작용해 ' + gk.name + '이 섭니다. ';
    gyeokBody += gk.tugan
      ? '이 중심 기운 ' + gk.jeonggiH + '이 ' + gk.tuganPillars.join('·') + ' 기둥의 겉글자(천간)에도 그대로 올라와 있어, 성격의 뼈대가 겉으로도 또렷하게 보입니다. '
      : '이 중심 기운이 겉글자(천간)로 올라오지는 않아, 성격의 뼈대가 밖으로 드러나기보다 안쪽에서 조용히 작동합니다. ';
    if (gk.junggi) {
      var jt = C.SS_TRAIT[gk.junggi.ss] || '';
      gyeokBody += '같은 지지 속 두 번째 기운 ' + gk.junggi.h + '(' + gk.junggi.ss + ')도 함께 깔려 ' +
        jt + josaS(jt, '이', '가') + ' 격의 결을 더합니다. ';
    }
    gyeokBody += gt.body;

    /* 십성 구조 패턴 */
    var sik = ssMap['식신'] + ssMap['상관'];
    var jae = ssMap['편재'] + ssMap['정재'];
    var gwan = ssMap['편관'] + ssMap['정관'];
    var in_ = ssMap['편인'] + ssMap['정인'];
    var bi = ssMap['비견'] + ssMap['겁재'];
    var flags = {
      식상생재: sik >= 1 && jae >= 1,
      관인상생: gwan >= 1 && in_ >= 1,
      살인상생: ssMap['편관'] >= 1 && in_ >= 1,
      재다신약: jae >= 3 && st.label === '신약',
      비겁다자: bi >= 3,
      무재: jae === 0,
      무관: gwan === 0,
      관살혼잡: ssMap['정관'] >= 1 && ssMap['편관'] >= 1,
      식상다자: sik >= 3,
      인성과다: in_ >= 3
    };
    var patterns = [];
    Object.keys(C.PATTERN_TEXT).forEach(function (k) {
      if (!flags[k]) return;
      var t = C.PATTERN_TEXT[k];
      patterns.push({ key: k, name: t.name, head: t.head, body: t.body });
    });
    if (!patterns.length) {
      patterns.push({
        key: 'balanced', name: '중화 균형', head: '어느 한 힘도 과하지 않은 구조',
        body: '오행과 십성이 크게 치우치지 않았습니다. 강점이 튀지 않는 대신 약점도 적어, 환경과 선택에 따라 결과가 달라집니다. 어느 해에 무엇을 할지 고르는 눈이 이 사주의 재산입니다.'
      });
    }

    /* 합·충·형·파·해 */
    var relItems = [];
    function pushRel(r, groupKey) {
      var t = C.REL_TEXT[r.type] || { head: r.type, body: '' };
      var area = pairArea(r.a, r.b);
      relItems.push({
        type: r.type, name: r.name, a: r.a, b: r.b, adjacent: r.adjacent !== false,
        head: t.head,
        body: t.body + (area ? ' ' + area + '입니다.' : '')
      });
    }
    rel.gan.forEach(function (r) { pushRel(r); });
    rel.ji.forEach(function (r) { pushRel(r); });
    rel.groups.forEach(function (g) {
      var t = C.REL_TEXT[g.type] || { head: g.type, body: '' };
      relItems.push({
        type: g.type, name: g.name, a: g.pillars.join('·'), b: '', adjacent: true,
        head: g.name + ' — ' + t.head, body: t.body + ' ' + g.pillars.join('·') + '의 ' + g.branches.join('') + '이 ' + g.el + ' 기운으로 묶입니다.'
      });
    });

    /* 이 주에 걸린 관계 */
    var touch = {};
    relItems.forEach(function (r) {
      if (r.b) {
        [r.a, r.b].forEach(function (lab) {
          touch[lab] = touch[lab] || [];
          touch[lab].push(r.name);
        });
      } else {
        r.a.split('·').forEach(function (lab) {
          touch[lab] = touch[lab] || [];
          touch[lab].push(r.name);
        });
      }
    });

    /* 신살 — 같은 신살이 여러 기준에서 잡히면 한 장으로 합친다 */
    var rawSinsal = S.scanSinsal(core);
    var merged = [];
    rawSinsal.forEach(function (s) {
      var hit = null;
      for (var i = 0; i < merged.length; i++) {
        if (merged[i].key === s.key) { hit = merged[i]; break; }
      }
      if (hit) {
        if (hit.bases.indexOf(s.base) < 0) hit.bases.push(s.base);
        s.pillars.forEach(function (p) { if (hit.pillars.indexOf(p) < 0) hit.pillars.push(p); });
      } else {
        merged.push({
          key: s.key, name: s.name, han: s.han, kind: s.kind,
          bases: [s.base], pillars: s.pillars.slice()
        });
      }
    });

    var kindOrder = { good: 0, neutral: 1, caution: 2 };
    var sinsal = merged.slice().sort(function (a, b) {
      return (kindOrder[a.kind] || 1) - (kindOrder[b.kind] || 1);
    }).map(function (s) {
      var t = C.SINSAL_TEXT[s.key] || { head: s.name, body: '' };
      return {
        key: s.key, name: s.name, han: s.han, base: s.bases.join(' · '), pillars: s.pillars,
        kind: s.kind, head: t.head, body: t.body
      };
    });

    /* 겉과 속 */
    var gans = rows.filter(function (r) { return r.key !== 'day'; });
    var ganCount = {};
    gans.forEach(function (r) { ganCount[r.ganSS] = (ganCount[r.ganSS] || 0) + 1; });
    var ganTop = Object.keys(ganCount).sort(function (a, b) { return ganCount[b] - ganCount[a]; })[0] || '비견';
    var ganList = gans.map(function (r) { return r.ganH + '(' + r.ganSS + ')'; }).join(' · ');

    var hw = {};
    rows.forEach(function (r) {
      r.hidden.forEach(function (h) {
        var w = h.role === '정기' ? 3 : h.role === '중기' ? 2 : 1;
        hw[h.ss] = (hw[h.ss] || 0) + w;
      });
    });
    var hidTop = Object.keys(hw).sort(function (a, b) { return hw[b] - hw[a]; })[0] || ganTop;
    var mainHiddenAll = [];
    rows.forEach(function (r) {
      var last = r.hidden[r.hidden.length - 1];
      if (last) mainHiddenAll.push(last.h);
    });

    var outer = {
      head: '겉으로 보이는 나 — 천간 ' + ganList,
      body: '천간은 여덟 글자 중 위쪽 네 글자로, 사람을 만날 때 바깥에서 먼저 읽히는 자리입니다. ' + ganList + '이 드러나 ' +
        (C.SS_TRAIT[ganTop] || '') + josaS(C.SS_TRAIT[ganTop] || '', '이', '가') + ' 첫인상이 됩니다. ' +
        (ganCount[ganTop] >= 2
          ? '같은 기운이 ' + ganCount[ganTop] + '개 겹쳐 그 성질이 처음 보는 사람에게도 강하게 각인됩니다.'
          : '한 글자씩 다른 결로 서 있어, 상대에 따라 다른 얼굴이 나옵니다.') +
        ' 다만 천간은 포장이기도 해서, 여기서 보이는 모습과 실제 판단이 다를 수 있습니다.'
    };
    var inner = {
      head: '속에 깔린 나 — 지장간 ' + mainHiddenAll.join('·'),
      body: '지지(아래 네 글자)는 겉글자보다 안쪽을 더 많이 담습니다. 그 안에 숨어 있는 글자(지장간) 가운데 가장 무거운 것은 ' + hidTop +
        josaS(hidTop, '으로', '로') + ', ' + (C.SS_TRAIT[hidTop] || '') +
        josaS(C.SS_TRAIT[hidTop] || '', '이', '가') + ' 실제 판단과 행동의 바닥에 깔려 있습니다. ' +
        (hidTop === ganTop
          ? '겉과 속이 같은 결이라, 보이는 모습과 실제가 크게 어긋나지 않습니다. 일관성이 이 사주의 무기입니다.'
          : '겉은 ' + ganTop + ', 속은 ' + hidTop + josaS(hidTop, '으로', '로') + ' 결이 다릅니다. 처음에는 ' +
            (C.SS_TRAIT[ganTop] || '') + ' 쪽으로 보이지만, 가까워질수록 ' + (C.SS_TRAIT[hidTop] || '') +
            ' 쪽이 드러납니다. 이 간극을 아는 사람이 이 사주를 가장 정확히 읽습니다.') +
        (st.label === '신약' ? ' 일간의 힘이 약한 편이라, 속의 기운이 겉으로 올라오기까지 시간이 걸립니다.' : '')
    };

    /* 4대 궁 */
    var palaces = rows.map(function (r) {
      var t = C.PALACE_TEXT[r.key];
      var lead = t ? t.lead : '';
      var mainHidden = r.hidden[r.hidden.length - 1];
      var trait = C.SS_TRAIT[r.ganSS] || '';
      var ganLine = r.key === 'day'
        ? '겉글자(천간) ' + r.ganH + '(' + r.ganHan + ')' + josaS(r.ganH, '은', '는') + ' 나 자신(일간)입니다. 이 자리가 곧 ‘나’이고, 아래 글자 ' + r.jiH + '(' + r.jiHan + ')' + josaS(r.jiH, '이', '가') + ' 내가 앉는 자리입니다.'
        : '겉글자(천간) ' + r.ganH + '(' + r.ganHan + ')' + josaS(r.ganH, '이', '가') + ' ' + r.ganSS + '(나를 기준으로 본 기운의 이름)' + josaS(r.ganSS, '으로', '로') + ' 서서 ' + trait + josaS(trait, '으로', '로') + ' 이 자리를 씁니다.';
      var unsLine = '아래 글자 ' + r.jiH + '(' + r.jiHan + ')' + josaS(r.jiH, '은', '는') + ' 기운의 단계로 ' + r.unsung.name + '(' + r.unsung.han + ') — ' +
        ((C.UNSUNG_TEXT[r.unsung.name] || {}).short || '') + '.';
      var hidTrait = mainHidden ? (C.SS_TRAIT[mainHidden.ss] || '') : '';
      var hidLine = '그 안에 숨은 글자(지장간)로는 ' + r.hidden.map(function (h) {
        return h.role + ' ' + h.h + '(' + h.ss + ')';
      }).join(' · ') + josaS(mainHidden ? mainHidden.h : '기', '이', '가') + ' 깔려 ' +
        (hidTrait ? hidTrait + josaS(hidTrait, '이', '가') + ' 이 자리의 실제 동력입니다.' : '있습니다.');
      var gmLine = r.gongmang
        ? '공망(비어서 잘 채워지지 않는 자리)에 듭니다. 여기서 얻으려 하기보다 다른 자리에서 채우는 편이 낫습니다.'
        : (r.gongmangYear ? '년주 기준 공망(비어서 잘 채워지지 않는 자리)에 걸려 있습니다. 집안·초년의 몫이 비어 있어 스스로 만들어야 하는 자리입니다.' : '');
      var relLine = '';
      if (touch[r.label] && touch[r.label].length) {
        var lastRel = touch[r.label][touch[r.label].length - 1];
        relLine = '다른 주와는 ' + touch[r.label].join(', ') + josaS(lastRel, '으로', '로') +
          ' 얽혀 있어, 이 자리의 일이 그 관계를 통해 실제 사건으로 나타납니다.';
      }
      return {
        key: r.key, title: t ? t.title : r.label, label: r.label,
        palace: r.palace, range: r.range,
        head: (r.key === 'day' ? '일간(나)' : r.ganSS + ' 겉') + ' · ' + (mainHidden ? mainHidden.ss + ' 속' : ''),
        body: [lead, ganLine, unsLine, hidLine, gmLine, relLine].filter(Boolean).join(' ')
      };
    });

    return {
      rows: rows,
      palaces: palaces,
      outer: outer,
      inner: inner,
      gyeok: {
        name: gk.name, ss: gk.ss,
        monthJiH: gk.monthJiH, monthJiHan: gk.monthJiHan,
        jeonggiH: gk.jeonggiH, jeonggiHan: gk.jeonggiHan,
        tugan: gk.tugan, tuganPillars: gk.tuganPillars,
        head: gt.head, body: gyeokBody
      },
      patterns: patterns,
      relations: relItems,
      relationCount: relItems.length,
      sinsal: sinsal,
      gongmang: {
        dayBranches: gmDay.map(function (j) { return { h: S.JI[j].h, han: S.JI[j].han }; }),
        yearBranches: gmYear.map(function (j) { return { h: S.JI[j].h, han: S.JI[j].han }; }),
        dayText: branchText(gmDay), yearText: branchText(gmYear),
        pillars: gmPillars, yearPillars: gmYearPillars
      },
      year2027: {
        unsung: uns2027, unsungShort: uns2027Text ? uns2027Text.short : '',
        unsungBody: uns2027Text ? uns2027Text.body : '',
        gongmang: y2027Gongmang,
        note: y2027Gongmang
          ? '2027 정미년 미(未)가 내 공망(비어서 잘 채워지지 않는 자리)에 듭니다. 그해에 잡은 기회가 채워지지 않고 지나가기 쉬우니, 벌이기보다 남기는 일에 집중하는 편이 낫습니다.'
          : '2027 정미년 미(未)는 내 공망에 들지 않아, 그해의 움직임이 실제 결과로 남기 좋은 자리입니다.'
      }
    };
  }

  /* ---------- build ---------- */

  function build(core, opt) {
    opt = opt || {};
    var now = opt.now ? new Date(opt.now) : new Date();
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
      balanceBody = top.el + '(' + top.count + '개)' + josaS(top.el, '과', '와') + ' ' + second.el + '(' + second.count + '개)' + josaS(second.el, '이', '가') + ' 중심을 잡고 있습니다. ' +
        '이 두 기운이 무의식의 판단 기준이 되니, 잘 쓰면 사람을 읽고 판을 짜는 감각이 되고, 잘못 쓰면 같은 실수를 반복하는 이유가 됩니다.';
    }

    /* 십성 */
    var ss = sipsungMap(core);
    var jae = ss.map['편재'] + ss.map['정재'];
    var sik = ss.map['식신'] + ss.map['상관'];
    var bi = ss.map['비견'] + ss.map['겁재'];
    var in_ = ss.map['편인'] + ss.map['정인'];
    var gwan = ss.map['편관'] + ss.map['정관'];

    /* 신강/신약 · 용신 */
    var st = S.strength(core);
    var ys = buildYongsin(core, st);
    var stText = C.STRENGTH_TEXT[st.level];
    var strength = {
      label: st.label,
      level: st.level,
      levelText: stText.head,
      body: stText.body,
      ratio: st.ratio,
      support: st.support,
      drain: st.drain,
      deukryeong: st.deukryeong,
      deukji: st.deukji,
      deukse: st.deukse,
      detail: st.detail,
      groups: st.groups,
      dmEl: st.dmEl
    };

    /* 2027 세운 */
    var y2027Gan = 3; /* 丁 */
    var y2027Ji = 7;  /* 未 */
    var ySS = S.sipsung(dayGan, y2027Gan);
    var yJiSS = S.sipsungJi(dayGan, y2027Ji);
    var yRel = S.relation(core.dayJi, y2027Ji);
    var yGanTheme = C.Y2027_GAN[ySS];

    /* 대운 */
    var daeun = buildDaeun(core, st, ys, now);

    /* 월별 */
    var months = buildMonthly(core, st, ys);
    var quarters = buildQuarters(months);
    var domains = buildDomains(core, st, ys, months, daeun, ySS, yJiSS);
    var wonguk = buildWonguk(core, st, ss.map);

    var attack = domains.wealth.attack;
    var defend = domains.wealth.defend;
    var avoid = months.filter(function (m) {
      return m.grade === 1 || m.rel.indexOf('충') >= 0 || m.rel.indexOf('형') >= 0;
    });
    var best = domains.wealth.best;

    /* 재물 그릇 (기존 호환) */
    var wealthHead = domains.wealth.head;
    var wealthBody = domains.wealth.body;

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
      strength: strength,
      yongsin: ys,
      wonguk: wonguk,
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
      domains: domains,
      daeun: daeun,
      months: months,
      quarters: quarters,
      avoid: { months: avoid, dir: clashDir },
      noble: { list: noble, dir: clashDir },
      meta: {
        total: core.total,
        jae: jae, sik: sik, bi: bi, in_: in_, gwan: gwan,
        age: daeun.age
      }
    };
  }

  /* BASE_SCORE·REL_ADJ는 SEO 일주 페이지 생성기(scripts/build_seo.py)도 같은 규칙을 쓰도록 함께 공개한다. */
  root.Report = {
    build: build, DIR_NAME: DIR_NAME, gradeOf: gradeOf,
    BASE_SCORE: BASE_SCORE, REL_ADJ: REL_ADJ,
    DOHWA: DOHWA, CHEONEUL: CHEONEUL, favorOf: favorOf
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = root.Report;
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));
