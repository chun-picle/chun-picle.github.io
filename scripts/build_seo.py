#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
월령 · 60갑자 일주별 SEO 페이지 생성기
========================================

`ilju/` 아래 60개 일주 페이지 + `ilju/index.html` + `sitemap.xml` + `robots.txt`를
만들어 냅니다. 계산은 사이트가 실제로 쓰는 엔진(assets/js/saju-core.js,
content.js, report.js)을 quickjs로 그대로 불러와서 하므로, 화면의 만세력·십성·
지지관계 규칙과 항상 같은 결과가 나옵니다.

사용법
------
    python3 -m pip install quickjs      # 최초 1회 (tests/run_tests.py와 같은 의존성)
    python3 scripts/build_seo.py        # 생성 + 자체 검증
    python3 scripts/build_seo.py --check    # 생성 없이 검증만

도메인 확정 시
--------------
아래 BASE_URL 한 줄만 실제 도메인으로 바꾸고 다시 실행하면 60개 페이지의
canonical·og:url·JSON-LD·sitemap·robots가 한 번에 치환됩니다.
"""

import datetime
import html
import html.parser
import json
import os
import re
import sys
from pathlib import Path

try:
    import quickjs
except ImportError:  # pragma: no cover
    sys.exit("quickjs 모듈이 필요합니다: python3 -m pip install quickjs")

# ─────────────────────────────────────────────────────────────
# 1. 기본 설정
# ─────────────────────────────────────────────────────────────

#: 사이트 기본 도메인 (Vercel 프로덕션 도메인 — 변경 시 이 줄만 교체)
BASE_URL = "https://wolryeong-saju.vercel.app"
BRAND = "월령"
BRAND_HAN = "月令"
SERVICE_YEAR = 2027
YEAR_LABEL = "2027 정미년"
YEAR_SHORT = "丁未 · 2027"
PUBLISH_DATE = "2026-11-24"          # 최초 발행일 (JSON-LD datePublished)
BUILD_DATE = datetime.date.today().isoformat()   # 생성일 (sitemap lastmod, dateModified)
CSS_VERSION = "20261125m"
CONTACT_EMAIL = "wolryeong.saju@gmail.com"   # 문의 메일 (사이트 푸터·약관과 동일)

ROOT = Path(__file__).resolve().parent.parent
ILJU_DIR = ROOT / "ilju"

# 60갑자 순서의 로마자 슬러그 (갑자 → 계해)
SLUGS = [
    "gapja", "eulchuk", "byeongin", "jeongmyo", "mujin", "gisa", "gyeongo",
    "sinmi", "imsin", "gyeyu",
    "gapsul", "eulhae", "byeongja", "jeongchuk", "muin", "gimyo", "gyeongjin",
    "sinsa", "imo", "gyemi",
    "gapsin", "euryu", "byeongsul", "jeonghae", "muja", "gichuk", "gyeongin",
    "sinmyo", "imjin", "gyesa",
    "gabo", "eulmi", "byeongsin", "jeongyu", "musul", "gihae", "gyeongja",
    "sinchuk", "imin", "gyemyo",
    "gapjin", "eulsa", "byeongo", "jeongmi", "musin", "giyu", "gyeongsul",
    "sinhae", "imja", "gyechuk",
    "gabin", "eulmyo", "byeongjin", "jeongsa", "muo", "gimi", "gyeongsin",
    "sinyu", "imsul", "gyehae",
]

GAN_SLUG = ["gap", "eul", "byeong", "jeong", "mu", "gi", "gyeong", "sin", "im", "gye"]
JI_SLUG = ["ja", "chuk", "in", "myo", "jin", "sa", "o", "mi", "sin", "yu", "sul", "hae"]

# ─────────────────────────────────────────────────────────────
# 2. 명리 해설 문구 (60갑자 조합별로 달라지는 부분)
# ─────────────────────────────────────────────────────────────

# 해설 용어 — 십성 뜻
SIPSUNG_HAN = {
    "비견": "比肩", "겁재": "劫財", "식신": "食神", "상관": "傷官",
    "편재": "偏財", "정재": "正財", "편관": "偏官", "정관": "正官",
    "편인": "偏印", "정인": "正印",
}

REL_MEANING = {
    "충": ("沖", "정면으로 부딪히는 관계", "자리가 흔들리고 이동·변동이 생깁니다."),
    "합": ("合", "묶여서 하나로 붙는 관계", "사람과 일이 붙어 계약·성사로 이어집니다."),
    "형": ("刑", "서로 조이고 긁는 관계", "말과 서류에서 마찰이 생기기 쉽습니다."),
    "파": ("破", "틈이 벌어져 깨지는 관계", "작은 균열이 번지니 약속은 여유 있게 잡습니다."),
    "해": ("害", "뒤에서 상하게 하는 관계", "소문·배신에 주의하고 중요한 일은 문서로 남깁니다."),
}

# 일주 구조(천간 ↔ 지지 오행) — 5가지
STRUCT = {
    "saeng": {
        "label": "지지가 일간을 생하는 구조",
        "sub": "인성 통근 · 뿌리가 물을 얻은 자리",
        "body": (
            "지지가 일간을 밀어주는 상생 구조입니다. 뿌리가 물을 얻은 자리라 배우고 버티는 힘이 좋고, "
            "어려울 때 도와주는 사람이 붙습니다. 반대로 기대는 데 익숙해지면 결정이 늦어지니, "
            "도움을 받되 마지막 판단은 직접 내리는 습관이 필요합니다."
        ),
    },
    "same": {
        "label": "일간과 지지가 같은 기운인 구조",
        "sub": "비화 · 힘이 겹치는 자리",
        "body": (
            "천간과 지지가 같은 오행으로 겹친 구조입니다. 자기 색이 선명하고 밀어붙이는 힘이 강해, "
            "한번 정하면 끝까지 가는 추진력이 나옵니다. 대신 유연함이 줄어 남의 말을 받아들이는 데 "
            "시간이 걸리니, 반대 의견을 일부러 한 번씩 들어보는 것이 이 구조의 보약입니다."
        ),
    },
    "seol": {
        "label": "일간이 지지를 생하는 구조",
        "sub": "식상 설기 · 재능을 밖으로 꺼내 쓰는 자리",
        "body": (
            "일간이 지지를 생하며 기운을 밖으로 내보내는 설기 구조입니다. 가진 것을 꺼내 쓰는 힘이 좋아 "
            "표현·기획·영업에서 재능이 드러납니다. 다만 내보내기만 하면 정작 자기 몫이 비어 버리니, "
            "벌어들인 것을 채우는 루틴(수입의 일정 비율 고정·휴식·공부)을 먼저 정해두는 편이 좋습니다."
        ),
    },
    "jae": {
        "label": "일간이 지지를 극하는 구조",
        "sub": "재성 · 손에 잡히는 것을 다루는 자리",
        "body": (
            "일간이 지지를 눌러 다스리는 재성 구조입니다. 돈·사람·일처럼 손에 잡히는 것을 직접 다루는 "
            "힘이 있어 실무와 계산에 강하고, 맡은 일의 숫자를 끝까지 확인합니다. 다만 통제하려는 습관이 "
            "관계를 조이면 성과도 함께 줄어드니, 사람에게는 기준을 숫자로만 말하지 않는 편이 낫습니다."
        ),
    },
    "gwan": {
        "label": "지지가 일간을 극하는 구조",
        "sub": "관성 · 압박이 실력을 만드는 자리",
        "body": (
            "지지가 일간을 누르는 관성 구조입니다. 자리와 규칙이 나를 조이는 대신, 그 압박이 실력을 "
            "빨리 만들어 조직에서 자리를 잡습니다. 다만 무리하면 몸이 먼저 신호를 보내므로, "
            "잠과 식사처럼 기본 리듬은 업무 일정과 같은 무게로 지켜야 오래 갑니다."
        ),
    },
}

# 일주 자체의 12운성 (일간이 자기 지지에서 만나는 자리)
STAGE_BODY = {
    "장생": "처음 힘이 붙는 자리입니다. 배우고 시작하는 단계라 도움과 인연이 따라붙고, 새 일에 들어가는 문턱이 낮습니다.",
    "목욕": "물러서며 흔들리는 자리입니다. 감정과 취향이 앞서 사람 사이의 파도가 잦지만, 그만큼 사람을 끄는 힘도 큽니다.",
    "관대": "옷을 갖춰 입는 자리입니다. 사회적 역할과 평판이 붙어, 이름이 알려지는 일에서 힘이 납니다.",
    "임관": "맡은 일을 실제로 쓰는 자리입니다. 조직 안에서 실무 권한이 생기고, 손에 잡히는 성과가 나옵니다.",
    "제왕": "힘이 가장 센 자리입니다. 밀어붙이는 힘은 최고지만, 꺾일 때의 낙차도 그만큼 큽니다.",
    "쇠": "한 고비를 넘긴 자리입니다. 새로 벌이기보다 관리로 남는 것을 지키는 쪽이 유리합니다.",
    "병": "안으로 기운을 쓰는 자리입니다. 몸과 마음의 신호가 먼저 오니, 그 신호를 일정처럼 다뤄야 합니다.",
    "사": "끝을 정리하는 자리입니다. 새로운 판보다 마무리와 정산에 힘이 실립니다.",
    "묘": "창고에 넣어둔 자리입니다. 재능을 감추고 때를 기다리는 힘이 있어, 늦게 크는 쪽에 가깝습니다.",
    "절": "끊고 다시 잇는 자리입니다. 환경이 바뀌어도 회복이 빨라, 판이 뒤집힐 때 오히려 강합니다.",
    "태": "아직 드러나지 않은 채 시작되는 자리입니다. 겉으로는 조용해도 가능성이 안에 쌓여 있습니다.",
    "양": "기르는 자리입니다. 남을 키우는 데 힘이 나고, 그 돌봄이 결국 자기 자산이 됩니다.",
}

# 2027년, 일간이 미(未)토에서 만나는 운성의 한 줄 (연간 톤)
YEAR_STAGE = {
    "장생": "새로 힘이 붙는 구간",
    "목욕": "감정과 관계가 흔들리는 구간",
    "관대": "평판과 자리가 붙는 구간",
    "임관": "실무 권한이 생기는 구간",
    "제왕": "기세가 최고조인 구간",
    "쇠": "관리로 지키는 구간",
    "병": "안으로 기운을 쓰는 구간",
    "사": "정리와 마무리의 구간",
    "묘": "감추고 기다리는 구간",
    "절": "끊고 다시 잇는 구간",
    "태": "아직 드러나지 않은 구간",
    "양": "남을 키우는 구간",
}

STAGE_HAN = {
    "장생": "長生", "목욕": "沐浴", "관대": "冠帶", "임관": "臨官", "제왕": "帝旺",
    "쇠": "衰", "병": "病", "사": "死", "묘": "墓", "절": "絶", "태": "胎", "양": "養",
}

# 2027년 지지 관계 (연 단위 문장)
YEAR_REL = {
    "충": (
        "미토와 충(沖)하는 자리라 2027년에는 자리가 흔들리고 이동·변동이 잦습니다. "
        "계약·이사·이직은 흔들리는 시기를 기준으로 일정을 잡고, 구두로 정한 것은 그 자리에서 문서로 남기세요."
    ),
    "합": (
        "미토와 합(合)하는 자리라 2027년에는 사람과 판이 붙습니다. 미뤄둔 제안·계약·소개를 꺼내기에 "
        "가장 좋은 해이니, 기다리지 말고 먼저 연락하는 쪽이 몫을 더 가져갑니다."
    ),
    "형": (
        "미토와 형(刑)을 이루는 자리라 2027년에는 말과 서류에서 마찰이 생기기 쉽습니다. "
        "확인 절차를 한 번 더 두면 대부분 피할 수 있고, 감정이 올라온 대화는 하루 묵혔다 꺼내는 편이 안전합니다."
    ),
    "파": (
        "미토와 파(破)하는 자리라 2027년에는 작은 균열이 크게 번지기 쉽습니다. "
        "약속과 일정은 여유 있게 잡고, 금액이 걸린 약속은 꼭 서면으로 남기세요."
    ),
    "해": (
        "미토와 해(害)하는 자리라 2027년에는 뜻밖의 소문이나 배신에 주의해야 합니다. "
        "중요한 이야기는 문서로 남기고, 사람 사이의 소문은 옮기지 않는 것이 이 해의 재산을 지킵니다."
    ),
    "none": (
        "미토와 충·합·형·파·해 어느 관계도 맺지 않는 자리라, 2027년은 바깥에서 오는 큰 흔들림 없이 "
        "자기 페이스로 갈 수 있습니다. 대신 스스로 기한을 정하지 않으면 한 해가 그냥 지나가니, "
        "분기마다 확인할 숫자 하나를 정해두세요."
    ),
}

# 2027년 천간(丁)이 일간에게 주는 재물 문장 — 십성별
WEALTH_GAN = {
    "비견": "2027년은 내 이름으로 벌어야 돈이 되는 해입니다. 남의 판에 얹히면 성과가 나뉘고, 내 이름을 건 일은 그대로 자산이 됩니다.",
    "겁재": "2027년은 돈이 나뉘는 해입니다. 벌이의 총량은 늘지만 지출·동업·보증에서 새기 쉬우니, 들어온 돈의 일부를 먼저 묶어두는 규칙이 필요합니다.",
    "식신": "2027년은 가진 재능이 수입으로 바뀌는 해입니다. 새로 벌이기보다 이미 잘하는 것을 상품·서비스로 다듬는 쪽이 훨씬 안정적으로 남습니다.",
    "상관": "2027년은 재능을 드러내야 돈이 되는 해입니다. 콘텐츠·영업·제안처럼 말과 결과물이 곧 매출이 되는 일에서 크게 벌고, 감정적인 말은 그대로 손실이 됩니다.",
    "편재": "2027년은 예상 못 한 재물의 통로가 열리는 해입니다. 큰돈이 들고 나는 자리라 기회는 넓지만, 관리 규칙 하나가 없으면 벌어도 남지 않습니다.",
    "정재": "2027년은 성실한 노력이 그대로 돈이 되는 해입니다. 계약·정기 수입·단가 협상에서 특히 유리하고, 대박보다 조건을 다듬는 쪽이 크게 남습니다.",
    "편관": "2027년은 재물이 압박을 통해 들어오는 해입니다. 어려운 일을 맡아 처리하며 값을 인정받지만, 무리하면 번 돈이 건강과 관계로 나갑니다.",
    "정관": "2027년은 자리와 평판이 돈이 되는 해입니다. 공식 계약·승진·자격처럼 이름이 걸린 일에서 수익이 따라오고, 규칙을 지킬수록 빨라집니다.",
    "편인": "2027년은 전문성이 돈이 되는 해입니다. 다만 생각이 길어지면 기회가 지나가니, 결론을 먼저 정하고 견적·제안을 먼저 내는 쪽이 유리합니다.",
    "정인": "2027년은 배움과 사람을 통해 돈이 들어오는 해입니다. 자격·교육·멘토가 실제 수입으로 이어지고, 혼자 버티는 방식은 이 해에 가장 비효율적입니다.",
}

WEALTH_REL = {
    "충": "지지가 미토와 충하는 해라 재물의 자리도 함께 흔들립니다. 큰 지출은 나눠서, 계약은 조건을 문서로 남기세요.",
    "합": "지지가 미토와 합하는 해라 거래와 소개가 붙습니다. 미뤄둔 제안이나 단가 협상을 꺼내기 좋습니다.",
    "형": "지지가 미토와 형을 이루는 해라 정산·서류에서 마찰이 생기기 쉽습니다. 숫자는 한 번 더 맞춰보세요.",
    "파": "지지가 미토와 파하는 해라 작은 누수가 크게 번집니다. 고정 지출과 구독을 먼저 정리하는 것이 순서입니다.",
    "해": "지지가 미토와 해하는 해라 사람 문제로 돈이 새기 쉽습니다. 함께 하는 일은 지분과 몫을 처음에 정하세요.",
}

GRADE_LABEL = {
    5: ("재물운 최상", "통로가 넓게 열린 해"),
    4: ("재물운 좋음", "벌이의 흐름이 살아 있는 해"),
    3: ("재물운 보통", "설계한 만큼 남는 해"),
    2: ("재물운 신중", "벌이보다 지킴이 먼저인 해"),
    1: ("재물운 방어", "지출 통제가 성과인 해"),
}

# 안내 문구
DISCLAIMER = (
    "월령의 일주 풀이는 전통 명리학의 계산 규칙을 프로그램으로 옮긴 <strong>참고·오락용 콘텐츠</strong>입니다. "
    "의료·법률·투자 판단의 근거로 쓸 수 없으며, 어떤 결과도 미래를 보장하지 않습니다."
)

CTA_TEXT = "내 생년월일시로 8글자 정밀 사주 &amp; 2027 재물운 전체 보기"


# ─────────────────────────────────────────────────────────────
# 3. 사이트 엔진을 quickjs로 불러와 데이터 계산
# ─────────────────────────────────────────────────────────────

ENGINE_FILES = [
    "assets/js/solar-terms.js",
    "assets/js/saju-core.js",
    "assets/js/content.js",
    "assets/js/report.js",
]

# 각 일주(0~59)에 대해 페이지에 필요한 값을 전부 계산해 JSON으로 돌려준다.
# 십성·지지관계·재물 점수는 사이트가 실제로 쓰는 함수(SajuCore, Report)를 그대로 호출한다.
PAYLOAD_JS = r"""
(function () {
  var S = SajuCore, C = CONTENT, R = Report;
  var STAGES = ['장생','목욕','관대','임관','제왕','쇠','병','사','묘','절','태','양'];
  var SAENGGI = [11, 6, 2, 9, 2, 9, 5, 0, 8, 3];   /* 갑해 을오 병인 정유 무인 기유 경사 신자 임신 계묘 */

  /* 12운성: 양간은 순행, 음간은 역행 */
  function twelve(ganIdx, jiIdx) {
    var d = ((jiIdx - SAENGGI[ganIdx]) % 12 + 12) % 12;
    if (!S.GAN[ganIdx].yang) d = (12 - d) % 12;
    return STAGES[d];
  }

  /* 천간↔지지 오행 구조 */
  function structOf(g, j) {
    if (g === j) return 'same';
    if (S.saeng(j, g)) return 'saeng';
    if (S.saeng(g, j)) return 'seol';
    if (S.geuk(g, j)) return 'jae';
    if (S.geuk(j, g)) return 'gwan';
    return 'same';
  }

  /* 2027년 월별 간지 (report.js buildMonthly와 같은 순서: 1월 축월 → 12월 자월) */
  function months(dayGan, dayJi) {
    var y26 = S.yearlyMonths(2026), y27 = S.yearlyMonths(2027);
    var r26 = S.monthRanges(2026), r27 = S.monthRanges(2027);
    var out = [];
    function fmt(t) {
      function f(s) { return (+s.substr(0, 2)) + '/' + (+s.substr(2, 2)); }
      return f(t.start) + '~' + f(t.end);
    }
    function push(m, rng) {
      var ss = S.sipsung(dayGan, m.gan);
      var rel = S.relation(m.ji, dayJi);
      var sc = R.BASE_SCORE[ss] || 0;
      for (var i = 0; i < rel.length; i++) sc += (R.REL_ADJ[rel[i]] || 0);
      out.push({
        no: out.length + 1, name: m.name, label: m.label, range: rng,
        ganSS: ss, rel: rel,
        score: Math.round(sc * 10) / 10,
        grade: R.gradeOf(sc)
      });
    }
    push(y26[11], fmt(r26[11]));
    for (var i = 0; i < 11; i++) push(y27[i], fmt(r27[i]));
    return out;
  }

  var items = [];
  for (var idx = 0; idx < 60; idx++) {
    var gan = idx % 10, ji = idx % 12;
    var g = S.GAN[gan], j = S.JI[ji];
    var ms = months(gan, ji);

    /* 2027년 정미년: 천간 丁, 지지 未, 未의 정기 己 */
    var ganSS = S.sipsung(gan, 3);
    var jiSS = S.sipsungJi(gan, 7);
    var jjSS = S.sipsung(gan, 5);
    var rel = S.relation(ji, 7);
    var score = (R.BASE_SCORE[ganSS] || 0)
      + (R.BASE_SCORE[jiSS] || 0) * 0.6
      + (R.BASE_SCORE[jjSS] || 0) * 0.4;
    for (var k = 0; k < rel.length; k++) score += (R.REL_ADJ[rel[k]] || 0);
    score = Math.round(score * 10) / 10;

    var attack = [], defend = [];
    for (var m2 = 0; m2 < ms.length; m2++) {
      var mm = ms[m2];
      if ((mm.ganSS === '편재' || mm.ganSS === '정재' || mm.ganSS === '식신') && mm.grade >= 3) attack.push(mm);
      if (mm.ganSS === '편관' || mm.ganSS === '겁재' || mm.grade === 1) defend.push(mm);
    }

    items.push({
      i: idx,
      gan: g.h, ganHan: g.han, ganEl: g.el, ganYang: g.yang,
      ji: j.h, jiHan: j.han, jiEl: j.el, jiYang: j.yang, animal: j.animal,
      name: S.ganjiName(idx), han: S.ganjiHan(idx),
      ilju: C.ILJU[idx],
      dm: C.DAY_MASTER[g.h],
      struct: structOf(g.el, j.el),
      twelve: twelve(gan, ji),
      jeonggi: { h: '', han: '', el: '' },
      y: {
        ganSS: ganSS, jiSS: jiSS, jjSS: jjSS,
        rel: rel, score: score, grade: R.gradeOf(score),
        title: C.Y2027_GAN[ganSS].title,
        body: C.Y2027_GAN[ganSS].b,
        env: C.Y2027_JI[jiSS],
        stage: twelve(gan, 7)
      },
      months: ms,
      attack: attack.map(function (m) { return { name: m.name, label: m.label, ganSS: m.ganSS, range: m.range }; }),
      defend: defend.map(function (m) { return { name: m.name, label: m.label, ganSS: m.ganSS, range: m.range }; })
    });
  }

  /* 지장간 정기(正氣) — 未 정기 己 등 표기용 */
  var JJ = ['계', '기', '갑', '을', '무', '병', '정', '기', '경', '신', '무', '임'];
  var JJ_HAN = ['癸', '己', '甲', '乙', '戊', '丙', '丁', '己', '庚', '辛', '戊', '壬'];
  var JJ_EL = ['수', '토', '목', '목', '토', '화', '화', '토', '금', '금', '토', '수'];
  for (var n = 0; n < 60; n++) {
    var jj2 = n % 12;
    items[n].jeonggi = { h: JJ[jj2], han: JJ_HAN[jj2], el: JJ_EL[jj2] };
  }

  return JSON.stringify({
    items: items,
    tables: {
      SIPSUNG: C.SIPSUNG,
      ELEMENT: C.ELEMENT_INFO,
      MONTH_NAME: S.MONTH_ORDER_NAME
    }
  });
})()
"""


def load_items():
    ctx = quickjs.Context()
    for rel in ENGINE_FILES:
        ctx.eval((ROOT / rel).read_text(encoding="utf-8"))
    raw = ctx.eval(PAYLOAD_JS)
    data = json.loads(raw)
    items = data["items"]
    assert len(items) == 60, len(items)
    tables = data["tables"]
    return items, tables


# ─────────────────────────────────────────────────────────────
# 4. 문자열 도우미
# ─────────────────────────────────────────────────────────────

def esc(s):
    return html.escape(str(s), quote=True)


def has_batchim(word):
    """마지막 글자에 받침이 있는지."""
    if not word:
        return False
    ch = ord(word[-1])
    return 0xAC00 <= ch <= 0xD7A3 and (ch - 0xAC00) % 28 != 0


def particle(word, with_batchim_p, without_batchim_p):
    """조사만 돌려준다."""
    return with_batchim_p if has_batchim(word) else without_batchim_p


def josa(word, with_batchim_p, without_batchim_p):
    """단어 + 조사."""
    return word + particle(word, with_batchim_p, without_batchim_p)


class Ctx:
    """페이지 렌더링에 공통으로 쓰는 값 묶음."""

    def __init__(self, items, tables):
        self.items = items
        self.tables = tables
        self.by_name = {it["name"]: it for it in items}
        self.by_gan = {}
        self.by_ji = {}
        for it in items:
            self.by_gan.setdefault(it["i"] % 10, []).append(it)
            self.by_ji.setdefault(it["i"] % 12, []).append(it)

    def url(self, path):
        return BASE_URL + path

    def page_url(self, it):
        return BASE_URL + "/ilju/" + SLUGS[it["i"]] + ".html"

    def el(self, name):
        return self.tables["ELEMENT"][name]

    def ss(self, name):
        return self.tables["SIPSUNG"][name]

    def first_sentence(self, text):
        i = text.find(". ")
        return text[: i + 1] if i > 0 else text


# ─────────────────────────────────────────────────────────────
# 5. HTML 조각
# ─────────────────────────────────────────────────────────────

FAVICON = (
    "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E"
    "%3Crect width='64' height='64' rx='14' fill='%2314120F'/%3E"
    "%3Ctext x='32' y='43' font-size='30' font-family='serif' fill='%23F7F4EE' "
    "text-anchor='middle'%3E%E6%9C%88%3C/text%3E%3C/svg%3E"
)

#: Vercel Web Analytics — 모든 페이지 공통 삽입 스니펫.
#: 정적 스크립트가 없는 환경(GitHub Pages 등)에서도 404만 나고 페이지 동작에는
#: 영향이 없도록 stub(window.va) + defer 로드로만 둔다. 커스텀 이벤트는
#: window.wolryeongTrack(name, data) 한 줄로 부르고, 무료 플랜에서 막혀도 조용히 무시된다.
ANALYTICS = """<!-- Vercel Web Analytics — 방문·유입경로·전환 측정 (스크립트가 없어도 페이지 동작에 지장 없음) -->
<script>window.va = window.va || function () { (window.vaq = window.vaq || []).push(arguments); };
window.wolryeongTrack = function (name, data) {
  try { window.va('event', data ? { name: name, data: data } : { name: name }); } catch (e) {}
};</script>
<script defer src="/_vercel/insights/script.js"></script>"""


HEAD_COMMON = """<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="theme-color" content="#F7F4EE">
<link rel="icon" href="{favicon}">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Noto+Serif+KR:wght@300;400;500;600&display=swap">
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.min.css">
<link rel="stylesheet" href="{root}assets/css/style.css?v={css}">"""


def cta_block(ctx, top=False):
    """메인(/)으로 보내는 CTA. 상단은 절제하고 하단은 크게."""
    cls = "cta-block"
    return f"""<div class="{cls}">
  <a class="btn btn-primary btn-block" href="../#birthForm">{CTA_TEXT} <span class="btn-arrow">→</span></a>
  <p class="cta-note">생년월일과 시각만 넣으면 절기 시각까지 계산한 8글자 원국과 2027년 재물운·월별 흐름이 나옵니다. 지금은 오픈 기념으로 원국 정밀 해부·12개월 운세까지 전부 무료입니다.</p>
</div>"""


def crumbs(ctx, it, current_label):
    return f"""<nav class="crumbs" aria-label="위치">
  <a href="../">월령</a><span class="sep">/</span><a href="./">60갑자 일주</a><span class="sep">/</span><span>{esc(current_label)}</span>
</nav>"""


def topbar(ctx, root_prefix="../"):
    return f"""<header class="topbar">
  <a class="brand" href="{root_prefix}">
    <span class="brand-mark">月</span>
    <span class="brand-name">월령</span>
  </a>
  <nav class="topbar-nav">
    <a class="topbar-link" href="./">일주 전체</a>
    <a class="topbar-link" href="{root_prefix}#birthForm">내 사주 보기</a>
  </nav>
</header>"""


def footer(ctx):
    return f"""<footer class="footer">
  <div class="footer-brand">
    <span class="brand-mark small">月</span>
    <div>
      <p class="footer-name">월령 <span>月令</span></p>
      <p class="footer-tag">절기로 읽는 사주 리포트</p>
    </div>
  </div>
  <p class="footer-links">
    <a href="../">내 사주 보기</a>
    <a href="./">60갑자 일주별 운세</a>
    <a href="../terms.html">이용약관·환불정책</a>
  </p>
  <p class="footer-info">문의 <a href="mailto:{CONTACT_EMAIL}">{CONTACT_EMAIL}</a></p>
  <p class="footer-copy">© 2026 월령. 본 서비스는 참고·오락 목적의 콘텐츠입니다.</p>
</footer>"""


def jsonld(page):
    data = {"@context": "https://schema.org", "@graph": page}
    text = json.dumps(data, ensure_ascii=False, indent=1)
    return text.replace("</", "<\\/")


# ─────────────────────────────────────────────────────────────
# 6. 일주 페이지 렌더링
# ─────────────────────────────────────────────────────────────

def render_ilju(ctx, it):
    i = it["i"]
    slug = SLUGS[i]
    url = ctx.page_url(it)
    name = it["name"]
    han = it["han"]
    title_tag = f"{name}일주({han}日柱) 2027년 정미년 운세·재물운·성격 풀이 | 월령"

    kws = it["ilju"]["k"]
    desc = (
        f"{name}일주({han})의 성격과 기질, 2027 정미년(丁未年)과의 십성·지지 관계로 본 총운과 재물운. "
        f"2027년 재물이 트이는 달과 방어할 달, 같은 일간·같은 지지의 다른 일주까지 한 번에 확인하세요."
    )
    og_title = f"{name}일주({han}) 2027 정미년 운세·재물운 | 월령"

    gan, ji = it["gan"], it["ji"]
    gan_el, ji_el = it["ganEl"], it["jiEl"]
    gw = gan + gan_el   # 갑목 · 병화처럼 천간+오행 표기
    jw = ji + ji_el     # 자수 · 미토처럼 지지+오행 표기
    dm = it["dm"]
    struct = STRUCT[it["struct"]]
    stage = it["twelve"]
    y = it["y"]
    grade = y["grade"]
    g_label, g_sub = GRADE_LABEL[grade]

    # ── 히어로
    keywords_html = "".join(f'<span class="chip">{esc(k)}</span>' for k in kws)
    hero = f"""<section class="ilju-hero">
  <p class="eyebrow">{esc(han)} · {esc(gan_el)} · {esc(ji_el)} · 60갑자 중 {i + 1}번</p>
  <div class="ilju-marks">
    <span class="ilju-char">{esc(gan)}</span>
    <span class="ilju-char">{esc(ji)}</span>
    <span class="ilju-han">{esc(han)}</span>
  </div>
  <h1>{esc(name)}일주,<br><em>2027 정미년</em>에는 어떻게 흐르나</h1>
  <p class="ilju-desc">
    태어난 날의 천간 <strong>{esc(gw)}({esc(it['ganHan'] + ctx.el(gan_el)['han'])})</strong>과 지지 <strong>{esc(jw)}({esc(it['jiHan'] + ctx.el(ji_el)['han'])})</strong>가 만난 자리,
    <strong>'{esc(it['ilju']['t'])}'</strong>. {esc(name)}일주는 {esc(kws[0])}·{esc(kws[1])}·{esc(kws[2])}의 결이 겹쳐 있고,
    2027년에는 천간 정(丁)과 지지 미(未)가 함께 들어옵니다.
  </p>
  <div class="chip-row">{keywords_html}</div>
</section>"""

    # ── 성격
    personality = f"""<section class="ilju-body">
  <h2 class="ilju-h2">{esc(name)}일주 성격과 기질</h2>
  <div class="card plain">
    <p class="ilju-lead">{esc(it['ilju']['t'])}</p>
    <p class="body-text">{esc(it['ilju']['b'])}</p>
    <div class="divider"></div>
    <p class="dm-line"><span class="dm-name">{esc(dm['name'])}</span><span class="dm-sub">{esc(dm['sub'])} 일간</span></p>
    <p class="body-text dim">{esc(dm['b'])}</p>
  </div>
  <p class="ilju-p">
    같은 일간이라도 지지가 무엇을 받쳐주느냐에 따라 결이 달라집니다. {esc(name)}일주는 {esc(gw)}({esc(it['ganHan'] + ctx.el(gan_el)['han'])})의 기질 위에
    {esc(jw)}({esc(it['jiHan'] + ctx.el(ji_el)['han'])})의 바탕을 깔고 있습니다. 그래서 '{esc(it['ilju']['t'])}'{esc(particle(it['ilju']['t'], '이라는', '라는'))} 비유가 붙습니다.
  </p>
</section>"""

    # ── 구성 · 오행
    jj = it["jeonggi"]
    elements = f"""<section class="ilju-body">
  <h2 class="ilju-h2">천간 · 지지 · 오행 구성</h2>
  <div class="day-pillar">
    <div class="dp-cell">
      <p class="dp-head">천간 · 天干</p>
      <p class="dp-char">{esc(gan)}</p>
      <p class="dp-meta">{esc(it['ganHan'])} · {esc(gan_el)} · {esc('양' if it['ganYang'] else '음')}</p>
      <p class="dp-desc">{esc(dm['sub'])}의 기운</p>
    </div>
    <div class="dp-cell">
      <p class="dp-head">지지 · 地支</p>
      <p class="dp-char">{esc(ji)}</p>
      <p class="dp-meta">{esc(it['jiHan'])} · {esc(ji_el)} · {esc('양' if it['jiYang'] else '음')}</p>
      <p class="dp-desc">{esc(it['animal'])} · 정기 {esc(jj['h'])}({esc(jj['han'])})</p>
    </div>
  </div>
  <div class="spec">
    <div class="spec-row">
      <div class="spec-k">구조</div>
      <div class="spec-v"><b>{esc(struct['label'])}</b><span class="spec-sub">{esc(struct['sub'])}</span></div>
    </div>
    <div class="spec-row">
      <div class="spec-k">12운성</div>
      <div class="spec-v"><b>{esc(stage)}{esc('(' + STAGE_HAN[stage] + ')')}</b><span class="spec-sub">{esc(STAGE_BODY[stage])}</span></div>
    </div>
    <div class="spec-row">
      <div class="spec-k">지장간</div>
      <div class="spec-v"><b>정기 {esc(jj['h'])}({esc(jj['han'])})</b><span class="spec-sub">지지 {esc(ji)} 속에 깔린 중심 기운입니다. 겉의 오행보다 속의 결을 이 기운이 정합니다.</span></div>
    </div>
  </div>
  <p class="ilju-p">{esc(struct['body'])}</p>
</section>"""

    # ── 2027 관계
    def ss_cell(ss):
        s = ctx.ss(ss)
        return f"<b>{esc(ss)}({esc(SIPSUNG_HAN[ss])})</b><span class=\"spec-sub\">{esc(s['key'])} — {esc(ctx.first_sentence(s['b']))}</span>"

    rel_rows = ""
    if y["rel"]:
        rels = []
        for r in y["rel"]:
            han_r, short, effect = REL_MEANING[r]
            rels.append(f"<b>{esc(r)}({esc(han_r)})</b><span class=\"spec-sub\">{esc(short)} · {esc(effect)}</span>")
        rel_cell = "<br>".join(rels)
    else:
        rel_cell = '<b>관계 없음</b><span class="spec-sub">미토와 충·합·형·파·해를 맺지 않습니다. 흔들림이 적은 대신 스스로 움직여야 하는 자리입니다.</span>'

    relation_section = f"""<section class="ilju-body">
  <h2 class="ilju-h2">2027 정미년과의 관계</h2>
  <p class="ilju-p">2027년의 간지는 <strong>정미(丁未)</strong>입니다. {esc(name)}일주가 이 해를 만나면 천간에서는 <strong>{esc(y['ganSS'])}</strong>, 지지에서는 <strong>{esc(y['jiSS'])}</strong>의 자리가 잡힙니다.</p>
  <div class="spec">
    <div class="spec-row">
      <div class="spec-k">천간 丁</div>
      <div class="spec-v">{ss_cell(y['ganSS'])}</div>
    </div>
    <div class="spec-row">
      <div class="spec-k">지지 未</div>
      <div class="spec-v">{ss_cell(y['jiSS'])}<span class="spec-sub">미토의 정기 기(己)는 이 일간에게 <b>{esc(y['jjSS'])}({esc(SIPSUNG_HAN[y['jjSS']])})</b>{esc(particle(y['jjSS'], '으로', '로'))} 들어옵니다.</span></div>
    </div>
    <div class="spec-row">
      <div class="spec-k">지지 관계</div>
      <div class="spec-v">{rel_cell}</div>
    </div>
    <div class="spec-row">
      <div class="spec-k">운성</div>
      <div class="spec-v"><b>{esc(y['stage'])}{esc('(' + STAGE_HAN[y['stage']] + ')')}</b><span class="spec-sub">일간이 미토에서 만나는 2027년의 자리 — {esc(YEAR_STAGE[y['stage']])}입니다.</span></div>
    </div>
  </div>
</section>"""

    # ── 총운
    rel_note = YEAR_REL[y["rel"][0]] if y["rel"] else YEAR_REL["none"]
    extra_rel = ""
    if len(y["rel"]) > 1:
        extra_rel = " " + YEAR_REL[y["rel"][1]]
    year_section = f"""<section class="ilju-body">
  <h2 class="ilju-h2">2027년 총운</h2>
  <div class="accent-card">
    <p class="year-label">{esc(YEAR_SHORT)}</p>
    <p class="year-line">{esc(y['title'])}</p>
    <p class="body-text dim">{esc(y['body'])} {esc(y['env'])}</p>
  </div>
  <div class="card plain ilju-year-more">
    <p class="body-text">{esc(rel_note + extra_rel)}</p>
  </div>
</section>"""

    # ── 재물운
    wealth_bits = [WEALTH_GAN[y["ganSS"]]]
    if y["rel"]:
        wealth_bits.append(WEALTH_REL[y["rel"][0]])
    wealth_bits.append(
        f"일간과 정미년의 십성·지지 관계를 월령 엔진과 같은 규칙으로 계산하면 {name}일주는 "
        f"<strong>{g_label}</strong>('{g_sub}') 구간에 놓입니다."
    )
    wealth_paras = "".join(f'<p class="body-text">{b}</p>' for b in wealth_bits)
    bars = "".join(f'<i class="{"on" if g <= grade else ""}"></i>' for g in range(1, 6))

    def month_chips(lst, empty_text):
        if not lst:
            return f'<p class="cta-note">{esc(empty_text)}</p>'
        rows = "".join(
            f'<span class="month-chip"><b>{esc(m["name"])}</b> {esc(m["label"])} · {esc(m["ganSS"])}<span>{esc(m["range"])}</span></span>'
            for m in lst[:3]
        )
        return f'<div class="month-chips">{rows}</div>'

    attack_html = month_chips(
        it["attack"], "뚜렷하게 재물을 밀어붙일 달은 없습니다. 이 해는 벌이보다 지출 구조를 다듬는 쪽이 남습니다."
    )
    defend_html = month_chips(
        it["defend"], "특별히 방어할 달은 없습니다. 다만 큰 결정은 서두르지 않는 편이 좋습니다."
    )

    wealth_section = f"""<section class="ilju-body">
  <h2 class="ilju-h2">2027년 재물운</h2>
  <div class="card plain">
    <div class="grade-line">
      <span class="grade-meter">{bars}</span>
      <span class="grade-label">{esc(g_label)}</span>
      <span class="grade-sub">{esc(g_sub)}</span>
    </div>
    {wealth_paras}
    <div class="divider"></div>
    <p class="mini-label">재물이 트이는 달</p>
    {attack_html}
    <div class="divider"></div>
    <p class="mini-label">방어할 달</p>
    {defend_html}
    <p class="note">월 구분은 달력이 아니라 절입일(節入日) 기준입니다. 달마다의 상세 등급과 투자 타이밍, 피해야 할 달은 <a href="../#birthForm">정밀 리포트</a>에서 12개월 전체로 확인할 수 있습니다.</p>
  </div>
</section>"""

    # ── 관련 일주
    same_gan = [x for x in ctx.by_gan[i % 10] if x["i"] != i]
    same_ji = [x for x in ctx.by_ji[i % 12] if x["i"] != i]

    def link_card(x):
        return (
            f'<a class="link-card" href="{SLUGS[x["i"]]}.html">'
            f'<span class="lc-name">{esc(x["name"])}<span class="lc-han">{esc(x["han"])}</span></span>'
            f'<span class="lc-sub">{esc(x["ilju"]["t"])}</span></a>'
        )

    related = f"""<section class="ilju-body">
  <h2 class="ilju-h2">같은 일간의 다른 일주</h2>
  <p class="ilju-p">일간이 {esc(josa(gw, '이면', '면'))} 지지에 따라 성격과 재물 그릇이 이렇게 달라집니다.</p>
  <div class="link-grid">{''.join(link_card(x) for x in same_gan)}</div>

  <h2 class="ilju-h2 mt-lg">같은 지지의 다른 일주</h2>
  <p class="ilju-p">지지가 {esc(josa(jw, '인', '인'))} 사람이라도 천간이 다르면 같은 환경을 전혀 다르게 씁니다.</p>
  <div class="link-grid">{''.join(link_card(x) for x in same_ji)}</div>
</section>"""

    # ── 이전/다음
    prev_it = ctx.items[(i - 1) % 60]
    next_it = ctx.items[(i + 1) % 60]
    pn = f"""<nav class="pn-nav" aria-label="60갑자 이동">
  <a class="pn-link" href="{SLUGS[prev_it['i']]}.html"><span class="pn-k">← 이전 일주</span><span class="pn-v">{esc(prev_it['name'])} · {esc(prev_it['ilju']['t'])}</span></a>
  <a class="pn-link pn-next" href="{SLUGS[next_it['i']]}.html"><span class="pn-k">다음 일주 →</span><span class="pn-v">{esc(next_it['name'])} · {esc(next_it['ilju']['t'])}</span></a>
</nav>"""

    # ── FAQ
    faq_items = [
        (
            f"{name}일주는 어떤 일주인가요?",
            f"{name}일주({han})는 천간 {gan}({it['ganHan']})과 지지 {ji}({it['jiHan']})로 이루어진 일주로, "
            f"'{it['ilju']['t']}'에 비유됩니다. 핵심 키워드는 {', '.join(kws)}입니다. {it['ilju']['b']}",
        ),
        (
            f"2027 정미년 {name}일주는 어떤 해인가요?",
            f"2027년 천간 정(丁)은 {name}일주에게 {y['ganSS']}, 지지 미(未)는 {y['jiSS']}의 자리가 됩니다. "
            f"{y['title']} — {y['body']} 지지 관계는 "
            + ("·".join(y["rel"]) if y["rel"] else "충·합·형·파·해 어느 것도 아닌 무관계")
            + f"이고, 재물운은 '{g_label}'({g_sub}) 구간입니다.",
        ),
        (
            f"내가 {name}일주인지 어떻게 알 수 있나요?",
            "일주는 태어난 날의 천간·지지입니다. 양력 생년월일과 출생 시각을 넣으면 절기 시각까지 계산한 만세력으로 "
            "내 사주의 네 기둥을 확인할 수 있습니다. 시각을 몰라도 일주는 그대로 나옵니다.",
        ),
        (
            "출생 시각을 몰라도 일주 풀이를 볼 수 있나요?",
            "네. 일주는 태어난 날짜만으로 정해지므로 시각을 몰라도 이 페이지의 풀이가 그대로 적용됩니다. "
            "다만 시주(時柱)에서 나오는 자녀·말년운과 오행 균형의 정밀도는 8글자일 때 더 높아집니다.",
        ),
    ]
    faq_html = "".join(
        f"<details><summary>{esc(q)}</summary><p>{esc(a)}</p></details>" for q, a in faq_items
    )
    faq_section = f"""<section class="ilju-body">
  <h2 class="ilju-h2">자주 묻는 것</h2>
  <div class="faq">{faq_html}</div>
</section>"""

    # ── 구조화 데이터
    page_schema = [
        {
            "@type": "Article",
            "headline": f"{name}일주({han}) 2027년 정미년 운세·재물운",
            "description": desc,
            "inLanguage": "ko",
            "mainEntityOfPage": {"@type": "WebPage", "@id": url},
            "url": url,
            "author": {"@type": "Organization", "name": BRAND, "url": BASE_URL + "/"},
            "publisher": {"@type": "Organization", "name": BRAND, "url": BASE_URL + "/"},
            "datePublished": PUBLISH_DATE,
            "dateModified": BUILD_DATE,
            "about": [
                {"@type": "Thing", "name": f"{name}일주"},
                {"@type": "Thing", "name": "2027 정미년 운세"},
                {"@type": "Thing", "name": "사주 재물운"},
            ],
            "isPartOf": {"@type": "CollectionPage", "@id": BASE_URL + "/ilju/"},
        },
        {
            "@type": "BreadcrumbList",
            "itemListElement": [
                {"@type": "ListItem", "position": 1, "name": "월령", "item": BASE_URL + "/"},
                {"@type": "ListItem", "position": 2, "name": "60갑자 일주별 운세", "item": BASE_URL + "/ilju/"},
                {"@type": "ListItem", "position": 3, "name": f"{name}일주", "item": url},
            ],
        },
        {
            "@type": "FAQPage",
            "mainEntity": [
                {"@type": "Question", "name": q, "acceptedAnswer": {"@type": "Answer", "text": a}}
                for q, a in faq_items
            ],
        },
    ]

    return f"""<!DOCTYPE html>
<html lang="ko">
<head>
{HEAD_COMMON.format(favicon=FAVICON, root="../", css=CSS_VERSION)}
<title>{esc(title_tag)}</title>
<meta name="description" content="{esc(desc)}">
<link rel="canonical" href="{url}">
<meta property="og:type" content="article">
<meta property="og:site_name" content="월령">
<meta property="og:title" content="{esc(og_title)}">
<meta property="og:description" content="{esc(desc)}">
<meta property="og:url" content="{url}">
<meta property="og:locale" content="ko_KR">
<meta name="twitter:card" content="summary">
<meta name="twitter:title" content="{esc(og_title)}">
<meta name="twitter:description" content="{esc(desc)}">
<script type="application/ld+json">{jsonld(page_schema)}</script>
{ANALYTICS}
</head>
<body class="ilju-page">

{topbar(ctx)}
{crumbs(ctx, it, name + '일주')}

<main class="ilju-wrap">
{hero}
{cta_block(ctx, top=True)}
{personality}
{elements}
{relation_section}
{year_section}
{wealth_section}
{cta_block(ctx)}
{related}
{pn}
{faq_section}
<section class="ilju-body">
  <p class="disclaimer">{DISCLAIMER}</p>
</section>
</main>

{footer(ctx)}
</body>
</html>
"""


# ─────────────────────────────────────────────────────────────
# 7. 목록 페이지
# ─────────────────────────────────────────────────────────────

def render_index(ctx):
    url = BASE_URL + "/ilju/"
    title_tag = "60갑자 일주별 2027 정미년 운세 전체 보기 | 월령"
    desc = (
        "갑자일주부터 계해일주까지 60갑자 일주 60편의 2027 정미년 운세를 한자리에 모았습니다. "
        "일주별 성격·기질과 2027 정미년과의 십성·지지 관계, 재물운과 재물이 트이는 달을 확인하세요."
    )

    groups = ""
    for g in range(10):
        lst = ctx.by_gan[g]
        gan = lst[0]["gan"]
        dm = lst[0]["dm"]
        cards = "".join(
            f'<a class="link-card" href="{SLUGS[x["i"]]}.html">'
            f'<span class="lc-name">{esc(x["name"])}<span class="lc-han">{esc(x["han"])}</span></span>'
            f'<span class="lc-sub">{esc(x["ilju"]["t"])}</span></a>'
            for x in lst
        )
        groups += f"""<section class="ilju-group" id="gan-{GAN_SLUG[g]}">
  <h3 class="ilju-group-h"><span class="ig-mark">{esc(lst[0]['ganHan'])}</span>{esc(dm['name'])} <span class="ig-sub">{esc(dm['sub'])} · {esc(ctx.el(lst[0]['ganEl'])['key'])}</span></h3>
  <div class="link-grid">{cards}</div>
</section>
"""

    ji_rows = ""
    for j in range(12):
        lst = ctx.by_ji[j]
        links = " · ".join(f'<a href="{SLUGS[x["i"]]}.html">{esc(x["name"])}</a>' for x in lst)
        ji_rows += f'<div class="ji-row"><span class="ji-k">{esc(lst[0]["ji"])}<span>{esc(lst[0]["jiHan"])}</span></span><span class="ji-v">{links}</span></div>\n'

    item_list = {
        "@type": "ItemList",
        "name": "60갑자 일주별 2027 정미년 운세",
        "numberOfItems": 60,
        "itemListElement": [
            {
                "@type": "ListItem",
                "position": x["i"] + 1,
                "name": f"{x['name']}일주({x['han']})",
                "url": ctx.page_url(x),
            }
            for x in ctx.items
        ],
    }
    page_schema = [
        {
            "@type": "CollectionPage",
            "name": "60갑자 일주별 2027 정미년 운세",
            "description": desc,
            "url": url,
            "inLanguage": "ko",
            "isPartOf": {"@type": "WebSite", "name": "월령", "url": BASE_URL + "/"},
            "mainEntity": item_list,
        },
        {
            "@type": "BreadcrumbList",
            "itemListElement": [
                {"@type": "ListItem", "position": 1, "name": "월령", "item": BASE_URL + "/"},
                {"@type": "ListItem", "position": 2, "name": "60갑자 일주별 운세", "item": url},
            ],
        },
    ]

    return f"""<!DOCTYPE html>
<html lang="ko">
<head>
{HEAD_COMMON.format(favicon=FAVICON, root="../", css=CSS_VERSION)}
<title>{esc(title_tag)}</title>
<meta name="description" content="{esc(desc)}">
<link rel="canonical" href="{url}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="월령">
<meta property="og:title" content="60갑자 일주별 2027 정미년 운세 | 월령">
<meta property="og:description" content="{esc(desc)}">
<meta property="og:url" content="{url}">
<meta property="og:locale" content="ko_KR">
<meta name="twitter:card" content="summary">
<script type="application/ld+json">{jsonld(page_schema)}</script>
{ANALYTICS}
</head>
<body class="ilju-page">

{topbar(ctx)}
<nav class="crumbs" aria-label="위치">
  <a href="../">월령</a><span class="sep">/</span><span>60갑자 일주별 운세</span>
</nav>

<main class="ilju-wrap">
  <section class="ilju-hero">
    <p class="eyebrow">60갑자 · 日柱 · 2027 정미년</p>
    <h1>일주 60편으로 보는<br><em>2027 정미년</em> 운세</h1>
    <p class="ilju-desc">
      사주의 네 기둥 중 <strong>일주(日柱)</strong>는 태어난 날의 천간과 지지입니다. 성격·기질의 바탕이면서,
      재물과 관계를 다루는 방식이 여기서 갈립니다. 갑자일주부터 계해일주까지 60편을 각각의 조합으로 풀었습니다.
    </p>
  </section>

  {cta_block(ctx, top=True)}

  <section class="ilju-body">
    <h2 class="ilju-h2">내 일주 찾기</h2>
    <p class="ilju-p">
      일주는 태어난 날의 간지라, 생년월일만 알면 확인할 수 있습니다. 아래에서 일주를 고르거나,
      <a href="../#birthForm">내 사주 보기</a>로 정확한 8글자를 먼저 확인하세요. 시각을 몰라도 일주는 그대로 나옵니다.
    </p>
    <div class="spec">
      <div class="spec-row">
        <div class="spec-k">일주</div>
        <div class="spec-v"><b>태어난 날의 천간 + 지지</b><span class="spec-sub">60갑자가 하루에 한 칸씩 순환합니다. 같은 날 태어나면 일주가 같습니다.</span></div>
      </div>
      <div class="spec-row">
        <div class="spec-k">2027 정미년</div>
        <div class="spec-v"><b>천간 丁 · 지지 未</b><span class="spec-sub">일주마다 정(丁)과 미(未)가 어떤 십성으로 들어오는지가 달라, 같은 해라도 운의 결이 갈립니다.</span></div>
      </div>
    </div>
  </section>

  <section class="ilju-body">
    <h2 class="ilju-h2">일간별 60갑자 일주</h2>
    <p class="ilju-p">같은 일간(천간)이라도 지지가 무엇을 받쳐주느냐에 따라 성격과 재물 그릇이 달라집니다. 일간 여섯 편을 묶어 두었습니다.</p>
    {groups}
  </section>

  <section class="ilju-body">
    <h2 class="ilju-h2">지지별로 모아 보기</h2>
    <div class="ji-list">{ji_rows}</div>
  </section>

  {cta_block(ctx)}

  <section class="ilju-body">
    <p class="disclaimer">{DISCLAIMER}</p>
  </section>
</main>

{footer(ctx)}
</body>
</html>
"""


# ─────────────────────────────────────────────────────────────
# 8. sitemap · robots
# ─────────────────────────────────────────────────────────────

def render_sitemap(ctx):
    rows = [
        (BASE_URL + "/", "1.0", "weekly"),
        (BASE_URL + "/ilju/", "0.9", "weekly"),
        (BASE_URL + "/terms.html", "0.3", "yearly"),
    ]
    for it in ctx.items:
        rows.append((ctx.page_url(it), "0.8", "monthly"))

    body = "".join(
        f"  <url>\n    <loc>{loc}</loc>\n    <lastmod>{BUILD_DATE}</lastmod>\n"
        f"    <changefreq>{freq}</changefreq>\n    <priority>{prio}</priority>\n  </url>\n"
        for loc, prio, freq in rows
    )
    return (
        '<?xml version="1.0" encoding="UTF-8"?>\n'
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
        f"{body}</urlset>\n"
    )


def render_robots():
    return f"""User-agent: *
Allow: /

Sitemap: {BASE_URL}/sitemap.xml
"""


# ─────────────────────────────────────────────────────────────
# 9. 자체 검증 (HTML 구조 · 링크 · 메타 중복)
# ─────────────────────────────────────────────────────────────

VOID_TAGS = {
    "area", "base", "br", "col", "embed", "hr", "img", "input", "link",
    "meta", "param", "source", "track", "wbr",
}


class TagChecker(html.parser.HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.stack = []
        self.errors = []
        self.links = []
        self.metas = {}
        self.text = []
        self._in_title = False
        self._script = 0

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if tag == "title":
            self._in_title = True
        if tag == "script":
            self._script += 1
        if tag in ("a", "link") and a.get("href"):
            self.links.append(a["href"])
        if tag == "script" and a.get("src"):
            self.links.append(a["src"])
        if tag == "meta" and a.get("content") is not None:
            key = a.get("name") or a.get("property")
            if key:
                self.metas[key] = a["content"]
        if tag not in VOID_TAGS:
            self.stack.append((tag, self.getpos()))

    def handle_startendtag(self, tag, attrs):
        self.handle_starttag(tag, attrs)
        if tag not in VOID_TAGS and self.stack and self.stack[-1][0] == tag:
            self.stack.pop()

    def handle_endtag(self, tag):
        if tag == "title":
            self._in_title = False
        if tag == "script":
            self._script = max(0, self._script - 1)
        if tag in VOID_TAGS:
            return
        if not self.stack:
            self.errors.append(f"</{tag}> 닫는 태그가 남음 (line {self.getpos()[0]})")
            return
        if self.stack[-1][0] != tag:
            # 안쪽에서 닫히지 않은 태그를 지목
            open_tags = [t for t, _ in self.stack]
            if tag in open_tags:
                while self.stack and self.stack[-1][0] != tag:
                    bad, pos = self.stack.pop()
                    self.errors.append(f"<{bad}> 닫히지 않음 (line {pos[0]})")
                self.stack.pop()
            else:
                self.errors.append(f"</{tag}> 짝이 없는 닫는 태그 (line {self.getpos()[0]})")
            return
        self.stack.pop()

    def handle_data(self, data):
        if self._in_title:
            self.metas["__title__"] = self.metas.get("__title__", "") + data
        if not self._script:
            self.text.append(data)


def check_site():
    problems = []
    titles = {}
    descs = {}
    canonicals = {}
    ctx = None  # check는 파일만 읽는다

    pages = sorted(ILJU_DIR.glob("*.html"))
    if len(pages) != 61:
        problems.append(f"ilju/ 페이지 수가 61(index+60)이 아님: {len(pages)}")

    for path in pages:
        rel = path.relative_to(ROOT).as_posix()
        src = path.read_text(encoding="utf-8")
        p = TagChecker()
        p.feed(src)
        for tag, pos in p.stack:
            p.errors.append(f"<{tag}> 닫히지 않음 (line {pos[0]})")
        for e in p.errors:
            problems.append(f"{rel}: {e}")

        title = p.metas.get("__title__", "").strip()
        if not title:
            problems.append(f"{rel}: <title> 없음")
        elif title in titles:
            problems.append(f"{rel}: <title> 중복 — {titles[title]}")
        else:
            titles[title] = rel

        d = p.metas.get("description", "").strip()
        if len(d) < 50:
            problems.append(f"{rel}: meta description 없음/짧음")
        if d in descs:
            problems.append(f"{rel}: description 중복 — {descs[d]}")
        descs[d] = rel

        if 'property="og:title"' not in src or 'property="og:url"' not in src:
            problems.append(f"{rel}: Open Graph 태그 누락")
        if "application/ld+json" not in src:
            problems.append(f"{rel}: JSON-LD 누락")

        can = re.search(r'<link rel="canonical" href="([^"]+)"', src)
        if not can:
            problems.append(f"{rel}: canonical 없음")
        else:
            if can.group(1) in canonicals:
                problems.append(f"{rel}: canonical 중복 — {canonicals[can.group(1)]}")
            canonicals[can.group(1)] = rel
            if not can.group(1).startswith(BASE_URL):
                problems.append(f"{rel}: canonical 도메인이 BASE_URL과 다름")

        if rel != "ilju/index.html":
            count = src.count("내 생년월일시로 8글자 정밀 사주")
            if count < 2:
                problems.append(f"{rel}: CTA 버튼이 상·하단 2개가 아님 ({count})")

        for href in p.links:
            if href.startswith(("http://", "https://", "mailto:", "#", "data:")):
                continue
            target = href.split("#")[0].split("?")[0]
            if not target:
                continue
            # Vercel Web Analytics 시스템 라우트 — 저장소에 파일이 없고 배포된 Vercel이 응답한다
            if target.startswith("/_vercel/"):
                continue
            resolved = (path.parent / target).resolve()
            if target.endswith("/"):
                resolved = resolved / "index.html"
            if not resolved.exists():
                problems.append(f"{rel}: 깨진 링크 {href}")

    # sitemap ↔ 실제 파일
    sm = ROOT / "sitemap.xml"
    if not sm.exists():
        problems.append("sitemap.xml 없음")
    else:
        locs = re.findall(r"<loc>([^<]+)</loc>", sm.read_text(encoding="utf-8"))
        if len(locs) != 63:
            problems.append(f"sitemap URL 수가 63이 아님: {len(locs)}")
        if len(set(locs)) != len(locs):
            problems.append("sitemap URL 중복")
        for loc in locs:
            path = loc[len(BASE_URL):]
            if path in ("", "/"):
                f = ROOT / "index.html"
            elif path.endswith("/"):
                f = ROOT / path.strip("/") / "index.html"
            else:
                f = ROOT / path.lstrip("/")
            if not f.exists():
                problems.append(f"sitemap: 실제 파일 없음 — {loc}")

    rb = ROOT / "robots.txt"
    if not rb.exists():
        problems.append("robots.txt 없음")
    elif "Sitemap:" not in rb.read_text(encoding="utf-8"):
        problems.append("robots.txt: Sitemap 줄 없음")

    # 메인에서 일주 목록으로 가는 링크
    main_html = (ROOT / "index.html").read_text(encoding="utf-8")
    if 'href="ilju/"' not in main_html:
        problems.append("index.html: ilju/ 로 가는 링크 없음")

    return problems


# ─────────────────────────────────────────────────────────────
# 10. 실행
# ─────────────────────────────────────────────────────────────

def build():
    items, tables = load_items()
    ctx = Ctx(items, tables)
    ILJU_DIR.mkdir(exist_ok=True)

    for it in items:
        (ILJU_DIR / f"{SLUGS[it['i']]}.html").write_text(render_ilju(ctx, it), encoding="utf-8")
    (ILJU_DIR / "index.html").write_text(render_index(ctx), encoding="utf-8")
    (ROOT / "sitemap.xml").write_text(render_sitemap(ctx), encoding="utf-8")
    (ROOT / "robots.txt").write_text(render_robots(), encoding="utf-8")

    print(f"생성 완료 — 일주 페이지 60개 + 목록 1개, sitemap.xml({62 + 1} URL), robots.txt")
    print(f"기본 도메인: {BASE_URL}")


def main():
    args = sys.argv[1:]
    if "--check" not in args:
        build()
    problems = check_site()
    if problems:
        print(f"\n검증 실패 {len(problems)}건:")
        for p in problems[:60]:
            print(" -", p)
        sys.exit(1)
    print("검증 통과 — HTML 구조·내부 링크·메타 중복·sitemap 정합성 모두 정상")


if __name__ == "__main__":
    main()
