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
CSS_VERSION = "20261128a"
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
        "sub": "도움받는 기운이 뿌리내린 자리",
        "body": (
            "지지가 일간을 밀어주는 상생 구조입니다. 뿌리가 물을 얻은 자리라 배우고 버티는 힘이 좋고, "
            "어려울 때 도와주는 사람이 붙습니다. 돈 쪽으로는 나를 받쳐 주는 기반(자격·사람·현금)이 있을 때 "
            "크게 남는 자리라, 무리한 확장보다 기반을 먼저 채우는 편이 낫습니다. 반대로 기대는 데 익숙해지면 "
            "결정이 늦어지니, 도움을 받되 마지막 판단은 직접 내리는 습관이 필요합니다."
        ),
    },
    "same": {
        "label": "일간과 지지가 같은 기운인 구조",
        "sub": "같은 기운이 겹쳐 힘이 센 자리",
        "body": (
            "천간과 지지가 같은 오행으로 겹친 구조입니다. 자기 색이 선명하고 밀어붙이는 힘이 강해, "
            "한번 정하면 끝까지 가는 추진력이 나옵니다. 다만 그 힘이 지출로도 이어져 매출이 늘어난 만큼 "
            "비용도 커지기 쉬우니, 들어온 돈의 일정 비율을 먼저 묶어두는 장치가 필요합니다. 대신 유연함이 "
            "줄어 남의 말을 받아들이는 데 시간이 걸리니, 반대 의견을 일부러 한 번씩 들어보는 것이 이 구조의 보약입니다."
        ),
    },
    "seol": {
        "label": "일간이 지지를 생하는 구조",
        "sub": "재능을 밖으로 꺼내 쓰는 자리",
        "body": (
            "일간이 지지를 생하며 기운을 밖으로 내보내는 설기 구조입니다. 가진 것을 꺼내 파는 힘이 좋아 "
            "상품·콘텐츠·영업에서 재능이 드러납니다. 다만 만들기만 하고 판매·청구를 붙이지 않으면 일한 만큼 "
            "못 받으니, 가격표와 대금 청구일을 먼저 정해두는 편이 좋습니다."
        ),
    },
    "jae": {
        "label": "일간이 지지를 극하는 구조",
        "sub": "돈과 손에 잡히는 것을 다루는 자리",
        "body": (
            "일간이 지지를 눌러 다스리는 재성 구조입니다. 돈·사람·일처럼 손에 잡히는 것을 직접 다루는 "
            "힘이 있어 거래·정산·실무에 강하고, 맡은 일의 숫자를 끝까지 확인합니다. 그래서 사업·영업에서 "
            "현금이 잘 도는 자리이지만, 통제하려는 습관이 관계를 조이면 성과도 함께 줄어드니 사람에게는 "
            "기준을 숫자로만 말하지 않는 편이 낫습니다."
        ),
    },
    "gwan": {
        "label": "지지가 일간을 극하는 구조",
        "sub": "압박이 실력을 만드는 자리",
        "body": (
            "지지가 일간을 누르는 관성 구조입니다. 자리와 규칙이 나를 조이는 대신, 그 압박이 실력을 "
            "빨리 만들어 법인·계약·조직 안에서 자리를 잡습니다. 다만 책임이 늘면 고정비와 인건비도 함께 "
            "늘어 현금을 조이니, 계약 기간·해지 조건·고정비 상한을 먼저 정해두는 편이 안전합니다."
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

CTA_TEXT = "내 생년월일시로 돈·사업·부동산 사주 전체 보기"

# 2027년 천간 십성별 계약·정산 방식
CONTRACT_2027 = {
    "비견": "2027년은 내 이름으로 서명하는 해입니다. 동업·공동명의 계약은 지분·역할을 문서로 남긴 뒤 서명하세요.",
    "겁재": "2027년은 몫이 나뉘는 해입니다. 공동지출·보증·공동대출은 피하고, 지분과 정산일을 숫자로 적으세요.",
    "식신": "2027년은 만든 것을 파는 해입니다. 결과물 단위 대금과 검수 기준을 계약서에 넣으세요.",
    "상관": "2027년은 영업이 앞서는 해입니다. 계약서 문구는 내가 직접 읽고, 말로 한 약속은 문자로 남기세요.",
    "편재": "2027년은 큰돈이 도는 해입니다. 선금·중도금·잔금과 지연이자를 명시하고, 투자 한도를 먼저 정하세요.",
    "정재": "2027년은 정산이 힘을 받는 해입니다. 단가·납기·정기 결제 조건을 이 해에 정리하세요.",
    "편관": "2027년은 압박이 센 해입니다. 마감·위약·해지 조항을 먼저 확인하고, 무리한 보증은 피하세요.",
    "정관": "2027년은 법인·계약이 힘을 받는 해입니다. 표준 계약서와 승인 절차를 이 해에 갖추세요.",
    "편인": "2027년은 문서·권리가 힘을 받는 해입니다. 등기·권리·특약을 직접 읽고, 검토 기한을 정하세요.",
    "정인": "2027년은 부동산·후원이 힘을 받는 해입니다. 명의·지분·담보 조건을 문서로 확인하세요.",
}

# 일주 지지 오행별 부동산 접근
ASSET_BY_EL = {
    "목": "부동산은 직접 보유보다 권리·임차로 시작하는 편이 안전합니다. 매수 전 등기·권리관계를 직접 확인하세요.",
    "화": "부동산은 열기가 앞서면 판단이 흐려집니다. 매수 결정은 하루 묵혔다가 숫자로 다시 검산하세요.",
    "토": "토 기운이 일주에 깔려 부동산·자산 감각이 좋은 자리입니다. 다만 보유세·유지비까지 계산해야 남습니다.",
    "금": "부동산은 조건과 계약서에서 승부가 납니다. 대출 한도·상환 일정·해지 조항을 먼저 정하세요.",
    "수": "부동산은 흐름을 보고 움직이는 자리입니다. 시세·공실·임대 수익을 숫자로 확인한 뒤 매수하세요.",
}

# 일주 구조별 돈 쓰는 방식
MONEY_BY_STRUCT = {
    "saeng": "돈은 나를 받쳐 주는 기반(자격·사람·현금)이 있을 때 크게 남습니다. 무리한 확장보다 기반을 채우는 쪽이 오래갑니다.",
    "same": "내 이름을 걸고 밀어붙일 때 성과가 나지만, 그 힘이 지출로도 이어집니다. 매출의 일정 비율을 먼저 묶어두세요.",
    "seol": "가진 것을 꺼내 파는 힘이 좋아 상품화에 유리합니다. 다만 만들기만 하고 청구하지 않으면 일한 만큼 못 받습니다.",
    "jae": "돈과 숫자를 직접 다루는 힘이 있어 거래·정산에서 강합니다. 통제하려는 습관이 관계를 조이지 않게 하세요.",
    "gwan": "책임과 절차가 나를 키우지만 고정비도 함께 늘어납니다. 계약 기간·해지 조항·고정비 상한을 먼저 정하세요.",
}

# 2027년 지지 관계별 약점 보완 포인트
FIX_BY_REL = {
    "충": "2027년 계약·이사·명의 변경이 흔들리는 해입니다. 큰 계약은 조건을 확정해 두고, 이사·명의 변경은 날짜를 여유 있게 잡으세요.",
    "합": "2027년 거래가 붙는 해입니다. 미뤄둔 계약·소개를 꺼내되, 조건을 문서로 남기면 오래갑니다.",
    "형": "2027년 서류·정산에서 마찰이 생기기 쉽습니다. 금액은 두 번 맞추고 확인 절차를 한 번 더 두세요.",
    "파": "2027년 작은 균열이 커지기 쉽습니다. 외상 거래를 줄이고 금액이 걸린 약속은 서면으로 남기세요.",
    "해": "2027년 사람 문제로 돈이 새기 쉽습니다. 지분·몫은 처음에 문서로 정하세요.",
    "none": "2027년 계약은 큰 틀에서 유지됩니다. 조건을 다듬어 두었다가 돈이 트이는 달에 서명하세요.",
}



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
  var JJ = ['계', '기', '갑', '을', '무', '병', '정', '기', '경', '신', '무', '임'];  var JJ_HAN = ['癸', '己', '甲', '乙', '戊', '丙', '丁', '己', '庚', '辛', '戊', '壬'];
  var JJ_EL = ['수', '토', '목', '목', '토', '화', '화', '토', '금', '금', '토', '수'];
  for (var n = 0; n < 60; n++) {
    var jj2 = n % 12;
    items[n].jeonggi = { h: JJ[jj2], han: JJ_HAN[jj2], el: JJ_EL[jj2] };
  }

  /* 2027 정(丁)이 각 일간에 들어오는 십성 — 가이드 페이지 표에 쓰는 값 */
  var ding = [];
  for (var dg = 0; dg < 10; dg++) {
    ding.push({
      gan: S.GAN[dg].h, ganHan: S.GAN[dg].han, el: S.GAN[dg].el,
      ss: S.sipsung(dg, 3), dm: C.DAY_MASTER[S.GAN[dg].h].name,
      title: C.Y2027_GAN[S.sipsung(dg, 3)].title
    });
  }

  /* 2027년 12개월 — 화면의 월별 표와 같은 순서(1월 = 2026 사주년 축월) */
  var mon2027 = [];
  (function () {
    var y26 = S.yearlyMonths(2026), y27 = S.yearlyMonths(2027);
    var r26 = S.monthRanges(2026), r27 = S.monthRanges(2027);
    function fmt(t) { return (+t.start.substr(0, 2)) + '/' + (+t.start.substr(2, 2)) + '~' + (+t.end.substr(0, 2)) + '/' + (+t.end.substr(2, 2)); }
    mon2027.push({ no: 1, label: y26[11].label, name: y26[11].name, range: fmt(r26[11]) });
    for (var i = 0; i < 11; i++) mon2027.push({ no: i + 2, label: y27[i].label, name: y27[i].name, range: fmt(r27[i]) });
  })();

  return JSON.stringify({
    items: items,
    tables: {
      SIPSUNG: C.SIPSUNG,
      ELEMENT: C.ELEMENT_INFO,
      MONTH_NAME: S.MONTH_ORDER_NAME,
      FENGSHUI: C.FENGSHUI,
      DOMAIN: C.DOMAIN_TEXT,
      MONEY_NAMES: C.MONEY_NAMES,
      ELEMENT_RX: C.ELEMENT_RX,
      Y2027_GAN: C.Y2027_GAN,
      Y2027_JI: C.Y2027_JI,
      ILJU: C.ILJU
    },
    ding: ding,
    months2027: mon2027
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
    tables["DING"] = data["ding"]
    tables["MONTHS2027"] = data["months2027"]
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
  <p class="cta-note">생년월일과 시각만 넣으면 절기 시각까지 계산한 8글자 원국으로 2027년 현금흐름·사업·계약·부동산 흐름과 돈이 새는 구멍까지 나옵니다. 지금은 오픈 기념으로 12개월 타이밍까지 전부 무료입니다.</p>
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
    title_tag = f"{name}일주({han}日柱) 2027년 돈·사업·계약·부동산 성향 | 월령"

    kws = it["ilju"]["k"]
    desc = (
        f"{name}일주({han})의 재물 성향과 약점, 2027 정미년(丁未年)의 십성·지지 관계로 본 현금흐름·사업·계약·부동산 흐름. "
        f"돈이 트이는 달과 방어할 달, 약점을 보완하는 현실 규칙까지 한 번에 확인하세요."
    )
    og_title = f"{name}일주({han}) 2027 돈·사업·계약·부동산 | 월령"

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
  <p class="eyebrow">{esc(han)} · {esc(gan_el)} · {esc(ji_el)} · 돈 사주 · 60갑자 중 {i + 1}번</p>
  <div class="ilju-marks">
    <span class="ilju-char">{esc(gan)}</span>
    <span class="ilju-char">{esc(ji)}</span>
    <span class="ilju-han">{esc(han)}</span>
  </div>
  <h1>{esc(name)}일주,<br><em>2027년 돈과 계약</em>은 어떻게 흐르나</h1>
  <p class="ilju-desc">
    태어난 날의 위 글자(천간) <strong>{esc(gw)}({esc(it['ganHan'] + ctx.el(gan_el)['han'])})</strong>와 아래 글자(지지) <strong>{esc(jw)}({esc(it['jiHan'] + ctx.el(ji_el)['han'])})</strong>가 만난 자리,
    <strong>'{esc(it['ilju']['t'])}'</strong>. {esc(name)}일주는 {esc(kws[0])}·{esc(kws[1])}·{esc(kws[2])}의 결이 겹쳐 있고,
    2027년에는 천간 정(丁)과 지지 미(未)가 함께 들어옵니다. 아래는 돈·사업·계약·부동산 네 갈래로만 풀었습니다.
  </p>
  <div class="chip-row">{keywords_html}</div>
</section>"""

    # ── 성격
    personality = f"""<section class="ilju-body">
  <h2 class="ilju-h2">{esc(name)}일주 성격과 돈 쓰는 방식</h2>
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
  <p class="ilju-p"><strong>돈 쓰는 방식</strong> — {esc(MONEY_BY_STRUCT[it['struct']])}</p>
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
      <div class="spec-k">기운의 단계</div>
      <div class="spec-v"><b>{esc(stage)}{esc('(' + STAGE_HAN[stage] + ')')}</b><span class="spec-sub">{esc(STAGE_BODY[stage])}</span></div>
    </div>
    <div class="spec-row">
      <div class="spec-k">숨은 기운</div>
      <div class="spec-v"><b>정기 {esc(jj['h'])}({esc(jj['han'])})</b><span class="spec-sub">{esc(ji)} 속에 숨어 있는 중심 기운입니다. 겉으로 보이는 글자보다, 속에 깔린 이 기운이 실제 성격의 결을 정합니다.</span></div>
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
  <p class="ilju-p">2027년은 <strong>정미(丁未)</strong>년입니다. 사주는 위 글자(천간)와 아래 글자(지지)로 이루어지는데, {esc(name)}일주가 이 해를 만나면 위 글자에서는 <strong>{esc(y['ganSS'])}</strong>, 아래 글자에서는 <strong>{esc(y['jiSS'])}</strong>의 자리가 잡힙니다. 이 자리 이름(십성)이 그해 어떤 일이 들어오는지를 알려 줍니다. 돈·계약 관점에서는 이 십성이 2027년에 들어오는 현금의 통로와 계약의 성격을 정합니다.</p>
  <div class="spec">
    <div class="spec-row">
      <div class="spec-k">2027년 위 글자 정(丁)</div>
      <div class="spec-v">{ss_cell(y['ganSS'])}</div>
    </div>
    <div class="spec-row">
      <div class="spec-k">2027년 아래 글자 미(未)</div>
      <div class="spec-v">{ss_cell(y['jiSS'])}<span class="spec-sub">미토의 정기 기(己)는 이 일간에게 <b>{esc(y['jjSS'])}({esc(SIPSUNG_HAN[y['jjSS']])})</b>{esc(particle(y['jjSS'], '으로', '로'))} 들어옵니다.</span></div>
    </div>
    <div class="spec-row">
      <div class="spec-k">글자끼리 관계</div>
      <div class="spec-v">{rel_cell}</div>
    </div>
    <div class="spec-row">
      <div class="spec-k">2027년 기운의 단계</div>
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
  <h2 class="ilju-h2">2027년 재물·사업·계약·부동산</h2>
  <div class="card plain">
    <div class="grade-line">
      <span class="grade-meter">{bars}</span>
      <span class="grade-label">{esc(g_label)}</span>
      <span class="grade-sub">{esc(g_sub)}</span>
    </div>
    {wealth_paras}
    <div class="divider"></div>
    <p class="mini-label">계약·정산 방식</p>
    <p class="body-text">{CONTRACT_2027[it['y']['ganSS']]}</p>
    <div class="divider"></div>
    <p class="mini-label">부동산 접근</p>
    <p class="body-text">{ASSET_BY_EL[ji_el]}</p>
    <div class="divider"></div>
    <p class="mini-label">약점 보완 포인트</p>
    <p class="body-text">{FIX_BY_REL[y['rel'][0] if y['rel'] else 'none']}</p>
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
            f"{name}일주는 돈을 어떻게 버나요?",
            f"{name}일주({han})는 천간 {gan}({it['ganHan']})과 지지 {ji}({it['jiHan']})로 이루어진 일주로, "
            f"'{it['ilju']['t']}'에 비유됩니다. 핵심 키워드는 {', '.join(kws)}이고, 돈 쪽에서는 "
            + MONEY_BY_STRUCT[it["struct"]]
            + f" 밀어붙이는 힘의 바탕은 {it['ilju']['b']}",
        ),
        (
            f"2027 정미년 {name}일주의 돈·계약 흐름은 어떤가요?",
            f"2027년 천간 정(丁)은 {name}일주에게 {y['ganSS']}, 지지 미(未)는 {y['jiSS']}의 자리가 됩니다. "
            f"{y['title']} — {y['body']} 지지 관계는 "
            + ("·".join(y["rel"]) if y["rel"] else "충·합·형·파·해 어느 것도 아닌 무관계")
            + f"이고, 재물운은 '{g_label}'({g_sub}) 구간입니다. "
            + CONTRACT_2027[y["ganSS"]],
        ),
        (
            f"{name}일주는 부동산을 어떻게 봐야 하나요?",
            f"{name}일주는 지지가 {ji}({it['jiHan']})로 {ji_el} 기운을 깔고 있습니다. " + ASSET_BY_EL[ji_el]
            + " 2027년에는 " + FIX_BY_REL[y["rel"][0] if y["rel"] else "none"],
        ),
        (
            f"내가 {name}일주인지 어떻게 알 수 있나요?",
            "일주는 태어난 날의 천간·지지입니다. 양력 생년월일과 출생 시각을 넣으면 절기 시각까지 계산한 만세력으로 "
            "내 사주의 네 기둥을 확인할 수 있습니다. 시각을 몰라도 일주는 그대로 나옵니다.",
        ),
        (
            "출생 시각을 몰라도 일주 풀이를 볼 수 있나요?",
            "네. 일주는 태어난 날짜만으로 정해지므로 시각을 몰라도 이 페이지의 재물 풀이가 그대로 적용됩니다. "
            "다만 시주(時柱)에서 나오는 자산·말년의 결와 현금흐름의 정밀도는 8글자일 때 더 높아집니다.",
        ),
    ]
    faq_html = "".join(
        f"<details><summary>{esc(q)}</summary><p>{esc(a)}</p></details>" for q, a in faq_items
    )
    faq_section = f"""<section class="ilju-body">
  <h2 class="ilju-h2">자주 묻는 것</h2>
  <div class="faq">{faq_html}</div>
</section>
<section class="ilju-body">
  <h2 class="ilju-h2">이 페이지에 나온 말, 이렇게 읽으면 됩니다</h2>
  <div class="gloss">
    <div class="gloss-row"><b>일주(日柱)</b><span>태어난 날의 두 글자. 위 글자는 ‘나’(일간), 아래 글자는 내가 앉는 자리를 뜻합니다.</span></div>
    <div class="gloss-row"><b>천간 · 지지</b><span>사주의 위 글자(천간)와 아래 글자(지지). 겉으로 드러난 모습과 안쪽 바탕을 각각 담당합니다.</span></div>
    <div class="gloss-row"><b>십성 — 비겁·식상·재성·관성·인성</b><span>다른 글자가 나에게 어떤 역할을 하는지 붙인 이름. 돈·사업 관점에서는 비겁=독립사업·경쟁과 지출 변수, 식상=아이템·영업, 재성=현금·매출, 관성=법인·계약·제도, 인성=부동산·문서·권리로 읽습니다.</span></div>
    <div class="gloss-row"><b>재성 · 관성 · 인성</b><span>재성은 현금과 매출, 관성은 법인·계약·제도, 인성은 부동산·문서·권리입니다. 이 세 기운이 재물의 들어오는 통로와 새는 구멍을 만듭니다.</span></div>
    <div class="gloss-row"><b>기운의 단계(12운성)</b><span>기운이 태어나 자라고 힘을 다하는 열두 단계. 같은 성격이라도 지금 어느 단계에 있느냐에 따라 쓰임이 달라집니다.</span></div>
    <div class="gloss-row"><b>합 · 충 · 형 · 파 · 해</b><span>글자끼리 끌리거나 부딪히는 다섯 가지 관계. 합은 붙는 것, 충은 정면으로 부딪히는 것, 형·파·해는 은근히 어긋나는 것입니다.</span></div>
  </div>
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
    title_tag = "60갑자 일주별 2027 돈·사업·계약·부동산 사주 | 월령"
    desc = (
        "갑자일주부터 계해일주까지 60갑자 일주 60편의 2027년 돈·사업·계약·부동산 흐름을 한자리에 모았습니다. "
        "일주별 재물 성향과 약점 보완 포인트, 돈이 트이는 달과 방어할 달을 확인하세요."
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
    <p class="eyebrow">60갑자 · 日柱 · 2027 돈 사주</p>
    <h1>일주 60편으로 보는<br><em>2027년 돈과 계약</em></h1>
    <p class="ilju-desc">
      사주의 네 기둥 중 <strong>일주(日柱)</strong>는 태어난 날의 천간과 지지입니다. 성격·기질의 바탕이면서,
      돈을 벌고 지키는 방식이 여기서 갈립니다. 갑자일주부터 계해일주까지 60편을 현금흐름·사업·계약·부동산 관점으로 풀었습니다.
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
    <h2 class="ilju-h2">일간별 60갑자 돈 사주</h2>
    <p class="ilju-p">같은 일간(천간)이라도 지지가 무엇을 받쳐주느냐에 따라 돈을 버는 방식과 재물 그릇이 달라집니다. 일간 여섯 편을 묶어 두었습니다.</p>
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

# ─────────────────────────────────────────────────────────────
# 8-B. 검색 의도별 가이드 페이지 (guide/)
#
# 일주 60편이 "내 일주"로 들어오는 검색을 받는다면, guide/는
# "창업 사주", "부동산 방위", "돈 궁합", "2027 정미년"처럼 방법을 묻는
# 검색을 받는다. 내용은 화면이 실제로 쓰는 데이터(content.js FENGSHUI·
# DOMAIN_TEXT, gunghap-content.json)에서 그대로 가져와, 리포트와 어긋나지
# 않게 만든다.
# ─────────────────────────────────────────────────────────────

GUIDE_DIR = ROOT / "guide"

GUIDE_SLUGS = [
    "changup-saup-saju",
    "budongsan-bangwi-oheng",
    "don-gunghap",
    "2027-jeongminyeon",
]

GUIDE_NAV = {
    "changup-saup-saju": "창업·계약 사주",
    "budongsan-bangwi-oheng": "부동산 방위·지역",
    "don-gunghap": "돈 궁합",
    "2027-jeongminyeon": "2027 정미년",
}


def guide_url(slug):
    return BASE_URL + "/guide/" + slug + ".html"


def g_table(headers, rows, cls=""):
    """가이드 본문 표 — 셀은 이미 이스케이프된 HTML 조각을 받는다."""
    th = "".join(f"<th>{esc(h)}</th>" for h in headers)
    body = "".join(
        "<tr>" + "".join(f"<td>{c}</td>" for c in r) + "</tr>" for r in rows
    )
    return (
        f'<div class="g-table-wrap"><table class="g-table {cls}">'
        f"<thead><tr>{th}</tr></thead><tbody>{body}</tbody></table></div>"
    )


def g_cards(items):
    """제목 + 본문 카드 묶음."""
    return '<div class="g-cards">' + "".join(
        f'<div class="g-card"><p class="g-card-h">{h}</p><p class="g-card-b">{b}</p></div>'
        for h, b in items
    ) + "</div>"


def g_list(items, cls=""):
    return f'<ul class="g-list {cls}">' + "".join(f"<li>{x}</li>" for x in items) + "</ul>"


def guide_topbar():
    return f"""<header class="topbar">
  <a class="brand" href="../">
    <span class="brand-mark">月</span>
    <span class="brand-name">월령</span>
  </a>
  <nav class="topbar-nav">
    <a class="topbar-link" href="../ilju/">일주 60편</a>
    <a class="topbar-link" href="../#birthForm">내 사주 보기</a>
  </nav>
</header>"""


def guide_crumbs(label):
    return f"""<nav class="crumbs" aria-label="위치">
  <a href="../">월령</a><span class="sep">/</span><a href="./">가이드</a><span class="sep">/</span><span>{esc(label)}</span>
</nav>"""


def guide_cta(text="내 생년월일시로 2027년 재물 사주 전체 보기"):
    return f"""<div class="cta-block">
  <a class="btn btn-primary btn-block" href="../#birthForm">{esc(text)} <span class="btn-arrow">→</span></a>
  <p class="cta-note">생년월일과 시각만 넣으면 절기 시각까지 계산한 여덟 글자로 2027년 현금흐름·사업·계약·부동산과 365일 재물운 캘린더까지 나옵니다. 지금은 오픈 기념으로 전부 무료입니다.</p>
</div>"""


def guide_related(slugs, extra=None):
    cards = "".join(
        f'<a class="link-card" href="{s}.html"><span class="lc-name">{esc(GUIDE_NAV[s])}</span>'
        f'<span class="lc-sub">가이드</span></a>'
        for s in slugs
    )
    if extra:
        cards += "".join(
            f'<a class="link-card" href="{href}"><span class="lc-name">{esc(name)}</span>'
            f'<span class="lc-sub">{esc(sub)}</span></a>'
            for name, href, sub in extra
        )
    return f'<section class="ilju-body"><h2 class="ilju-h2">이어서 읽기</h2><div class="link-grid">{cards}</div></section>'


def guide_faq_html(faqs):
    rows = "".join(
        f"<details><summary>{esc(q)}</summary><p>{esc(a)}</p></details>" for q, a in faqs
    )
    return f'<section class="ilju-body"><h2 class="ilju-h2">자주 묻는 것</h2><div class="faq">{rows}</div></section>'


# ── 가이드 1: 창업·사업운·계약 ─────────────────────────────

def guide_changup(ctx):
    SIPSUNG = ctx.tables["SIPSUNG"]
    DOM = ctx.tables["DOMAIN"]["business"]
    MN = ctx.tables["MONEY_NAMES"]["model"]
    FENG = ctx.tables["FENGSHUI"]

    hero = f"""<section class="ilju-hero">
  <p class="eyebrow">가이드 · 창업 · 사업 · 계약</p>
  <h1>창업·사업운,<br><em>사주에서 무엇부터 볼까</em></h1>
  <p class="ilju-desc">
    창업을 앞두고 사주를 보는 이유는 "될까 안 될까"를 점치기 위해서가 아니라,
    <strong>내가 어떤 방식으로 돈을 벌 때 오래 가는지</strong>를 미리 아는 것입니다.
    여기서는 월령이 실제 리포트에서 쓰는 기준 그대로 — 일간·신강/신약·재성·관성·식상 —
    다섯 가지만 골라 설명합니다. 어려운 용어는 처음 나올 때 풀어 씁니다.
  </p>
  <div class="chip-row"><span class="chip">일간</span><span class="chip">신강·신약</span><span class="chip">재성</span><span class="chip">관성</span><span class="chip">2027 정미년</span><span class="chip">계약 타이밍</span></div>
</section>"""

    s1 = f"""<section class="ilju-body">
  <h2 class="ilju-h2">1. 창업 사주에서 먼저 보는 세 가지</h2>
  {g_cards([
    ("① 일간(나) — 무엇을 팔 때 무리 없이 오래 가는가",
     "태어난 날의 위 글자(일간)가 '나'입니다. 갑을·병정·무기·경신·임계 열 가지 중 무엇인지에 따라 잘하는 일의 결이 갈립니다. 나무(갑을)는 기획·교육·유통, 불(병정)은 영업·콘텐츠·서비스, 흙(무기)은 부동산·중개·운영, 쇠(경신)는 제조·정밀·금융, 물(임계)은 무역·물류·정보 쪽에서 힘이 덜 듭니다."),
    ("② 신강·신약 — 혼자 밀어붙일지, 사람과 기반을 먼저 채울지",
     "내 힘이 센 편(신강)이면 지출도 함께 커지니 통제 장치가 먼저이고, 힘이 얇은 편(신약)이면 돈을 쫓기 전에 자격·사람·현금 기반을 채우는 순서가 맞습니다. 좋고 나쁨이 아니라 창업의 순서가 달라질 뿐입니다."),
    ("③ 재성·관성의 개수 — 돈이 도는 통로와 회사라는 그릇",
     "재성(돈과 결과를 만드는 기운)은 매출의 통로, 관성(법인·계약·책임의 기운)은 회사라는 그릇입니다. 재성이 두텁고 관성이 얇으면 장사는 잘 되는데 서류에서 새고, 반대면 회사는 반듯한데 판매가 느립니다."),
  ])}
  <p class="g-p">같은 다섯 기운을 리포트에서는 <strong>여덟 글자의 개수</strong>로 셉니다. 아래 표는 그 개수를 창업의 언어로 바꾼 것입니다.</p>
  {g_table(
    ["기운", "한자", "돈·사업에서의 뜻", "창업에서 하는 역할"],
    [
      ["비겁", esc(SIPSUNG["비견"]["han"]), esc(SIPSUNG["비견"]["key"]), "내 이름을 걸고 혼자 밀어붙이는 힘. 많으면 지출·몫이 함께 커집니다."],
      ["식상", esc(SIPSUNG["식신"]["han"]), esc(SIPSUNG["식신"]["key"]), "아이템을 만들고 파는 힘. 없으면 만들기만 하고 팔지 못합니다."],
      ["재성", esc(SIPSUNG["편재"]["han"]), esc(SIPSUNG["편재"]["key"]), "매출이 들어오는 통로. 많으면 잘 벌고 잘 새는 구조입니다."],
      ["관성", esc(SIPSUNG["정관"]["han"]), esc(SIPSUNG["정관"]["key"]), "법인·계약·자격이라는 그릇. 얇으면 규모가 커질수록 서류에서 새습니다."],
      ["인성", esc(SIPSUNG["정인"]["han"]), esc(SIPSUNG["정인"]["key"]), "자격·권리·부동산 같은 기반. 많으면 준비가 길어져 시작이 늦습니다."],
    ],
    "g-table-3",
  )}
</section>"""

    model_rows = []
    for key, label in [("sik", "상품·콘텐츠형"), ("jae", "거래·유통형"), ("gwan", "조직·계약형"), ("in", "전문·권리형"), ("bi", "1인 전문사업형")]:
        model_rows.append([
            f"<b>{esc(MN[key])}</b>",
            esc(DOM["model"].get(key, "")),
            esc(DOM["scope"].get(key, "")),
        ])

    s2 = f"""<section class="ilju-body">
  <h2 class="ilju-h2">2. 내 사주에 맞는 사업 형태 다섯 가지</h2>
  <p class="g-p">리포트의 「사업 · 수익모델」 카드는 여덟 글자에서 가장 두터운 기운으로 형태를 정합니다. 아래 다섯 중 내 사주에 가까운 줄을 먼저 읽어 보세요.</p>
  {g_table(["사업 형태", "맞는 방식", "무엇을 팔까"], model_rows, "g-table-3")}
  <p class="g-p g-muted">예를 들어 식상이 가장 두터우면 상품·콘텐츠형, 관성이 두터우면 조직·계약형입니다. 두 기운이 비슷하면 리포트가 더 강한 쪽으로 정하고, 약한 쪽은 사람이나 계약으로 채우라고 조언합니다.</p>
</section>"""

    contract_rows = []
    for d in ctx.tables["DING"]:
        contract_rows.append([
            f"<b>{esc(d['gan'])}</b>{esc(d['ganHan'])}",
            esc(d["ss"]),
            esc(d["title"]),
            esc(CONTRACT_2027.get(d["ss"], "")),
        ])

    s3 = f"""<section class="ilju-body">
  <h2 class="ilju-h2">3. 2027 정미년, 내 계약 타이밍은</h2>
  <p class="g-p">2027년의 하늘 글자는 <strong>정(丁)</strong>입니다. 같은 정(丁)이라도 내 일간에 따라 십성이 달라지므로, 계약에서 조심할 지점도 달라집니다. 내 일간을 찾아 그 줄만 읽으면 됩니다.</p>
  {g_table(["내 일간", "2027 십성", "한 해의 결", "계약·정산에서 이렇게"], contract_rows, "g-table-4")}
  <p class="g-p g-muted">일간은 태어난 날의 위 글자입니다. 생년월일만 넣으면 리포트가 내 일간과 2027년 월별 계약 타이밍(힘이 실리는 달·서명을 미룰 달)까지 계산해 줍니다.</p>
</section>"""

    s4 = f"""<section class="ilju-body">
  <h2 class="ilju-h2">4. 창업 전에 숫자로 확인할 다섯 가지</h2>
  {g_list([
    "<b>팔 사람 10명</b> — 만들기 전에 돈을 낼 사람 10명에게 먼저 물어봅니다. 확인된 것부터 만듭니다.",
    "<b>3개월 증명</b> — 3개월 안에 계약 1건이나 재구매 1건을 남깁니다. 감이 아니라 기록이 다음 투자·대출의 근거입니다.",
    "<b>세금 일정</b> — 부가세·원천세 신고 주기를 달력에 먼저 박아둡니다. 매출이 나기 전에 아는 것이 반입니다.",
    "<b>생활비 분리</b> — 최소 6개월 생활비는 사업 자금과 분리합니다. 이 선을 넘으면 판단이 흐려집니다.",
    "<b>지분 문서</b> — 동업은 지분·역할·출자금·정산 주기를 시작 전에 한 장으로 남깁니다.",
  ])}
  <p class="g-p">사주는 이 다섯 가지를 대신해 주지 않습니다. 다만 <strong>어느 순서로 할지</strong>는 알려 줍니다. 신약이면 기반부터, 신강이면 통제 장치부터, 관성이 얇으면 서류와 절차부터입니다.</p>
</section>"""

    faqs = [
        ("사주로 창업 시기를 알 수 있나요?",
         "시기를 정확히 맞히는 것은 아닙니다. 다만 리포트는 2027년 12개월을 절입일 기준으로 나눠 계약·매수에 힘이 실리는 달과 서명을 미뤄야 하는 달을 갈라 보여 줍니다. 창업 준비는 힘이 실리는 달에 밀고, 임차·채용 같은 고정비는 방어 달에 미루는 식으로 쓰면 됩니다."),
        ("재성이 없으면 사업하면 안 되나요?",
         "아닙니다. 재성(돈과 결과를 만드는 기운)이 겉으로 없으면 돈이 저절로 굴러오는 구조가 아니라는 뜻입니다. 대신 아이템·영업(식상)이나 자격·권리(인성), 계약·절차(관성)로 통로를 직접 설계하면 됩니다. 월령은 이 경우 현금 통로를 어떻게 만들지까지 카드로 보여 줍니다."),
        ("2027년 정미년에 창업해도 되나요?",
         "2027년은 정(丁)의 기운이 내 일간에 어떤 십성으로 들어오는지에 따라 결이 갈립니다. 재성·식상이 들어오면 만들고 파는 해, 관성이 들어오면 법인·계약을 갖추는 해, 인성이 들어오면 자격·권리를 쌓는 해입니다. 리포트는 내 일간 기준으로 이 결을 풀고, 유리한 달과 주의할 달을 함께 표시합니다."),
        ("동업은 사주 궁합을 봐야 하나요?",
         "보면 도움이 됩니다. 다만 사주가 동업의 성패를 정하지는 않습니다. 월령의 2인 돈 궁합은 두 사람의 수익 시너지·계약 소통·현금 균형·안정·2027 공동재물 다섯 축을 계산하고, 약한 축에는 역할 분담·지분·정산 규칙을 처방으로 붙입니다. 결론은 늘 '룰을 문서로 남기라'는 쪽입니다."),
        ("리포트는 무료인가요?",
         "지금은 오픈 기념으로 1인 재물 사주와 2인 돈 궁합 리포트 전체가 무료입니다. 생년월일과 시각을 넣으면 결제 없이 2027년 4대 영역, 고민 맞춤 처방, 12개월 타이밍, 365일 재물운 캘린더(.ics)와 PDF 소장용 저장까지 전부 열립니다."),
    ]

    return {
        "slug": "changup-saup-saju",
        "label": "창업·사업운·계약 사주 보는 법",
        "title_tag": "창업·사업운 사주 보는 법 — 계약 타이밍과 사업 형태 | 월령",
        "og_title": "창업·사업운, 사주에서 무엇부터 볼까 | 월령",
        "desc": "창업 사주에서 먼저 보는 일간·신강/신약·재성·관성·식상 다섯 가지와 내 사주에 맞는 사업 형태 5가지, 일간별 2027 정미년 계약 타이밍 표. 창업 전에 숫자로 확인할 다섯 가지까지 한 번에 정리했습니다.",
        "hero": hero,
        "body": s1 + s2 + s3 + s4,
        "faqs": faqs,
        "related": ["budongsan-bangwi-oheng", "don-gunghap", "2027-jeongminyeon"],
        "extra": [("60갑자 일주별 돈 사주", "../ilju/", "내 일주로 바로 보기")],
    }


# ── 가이드 2: 오행별 부동산 방위·배산임수·지역 ──────────────

def guide_budongsan(ctx):
    FENG = ctx.tables["FENGSHUI"]
    EL = ctx.tables["ELEMENT"]

    hero = f"""<section class="ilju-hero">
  <p class="eyebrow">가이드 · 부동산 · 방위 · 입지</p>
  <h1>부족한 오행으로<br><em>집과 동네를 고르는 법</em></h1>
  <p class="ilju-desc">
    사주에서 부동산을 볼 때 가장 많이 나오는 질문이 "내게 좋은 방위가 어디냐"입니다.
    월령은 여덟 글자에서 <strong>가장 얇은 오행</strong>을 찾아 방위·입지·지역까지 이어서 보여 줍니다.
    여기에는 실제 리포트에 들어가는 방위·입지 문장과 전국 6권역 지역표를 그대로 옮겼습니다.
  </p>
  <div class="chip-row"><span class="chip">배산임수</span><span class="chip">방위</span><span class="chip">부족한 오행</span><span class="chip">전국 6권역</span><span class="chip">2027 미토</span></div>
</section>"""

    s1 = f"""<section class="ilju-body">
  <h2 class="ilju-h2">1. 방위는 이렇게 잽니다</h2>
  <p class="g-p">{esc(FENG["howto"])}</p>
  <p class="g-p">{esc(FENG["basanimsu"])}</p>
  <div class="g-callout"><b>배산임수(背山臨水)</b> — 뒤는 산이나 언덕으로 받쳐 주고, 앞은 물이나 트인 땅으로 열린 자리. 오행과 상관없이 뒤가 든든하고 앞이 트인 집이 오래 편합니다.</div>
</section>"""

    el_blocks = []
    for el_name in ["목", "화", "토", "금", "수"]:
        d = FENG["el"][el_name]
        info = EL[el_name]
        area_rows = [[esc(a["zone"]), esc(a["picks"])] for a in d["area"]]
        el_blocks.append(f"""<div class="g-el-block">
  <p class="g-el-h"><span class="g-el-dot" style="background:{info['color']}"></span>{esc(el_name)}({esc(info['han'])}) — {esc(info['key'])}</p>
  <div class="g-kv"><span>방위</span><p>{esc(d['dir'])}</p></div>
  <div class="g-kv"><span>입지·지형</span><p>{esc(d['place'])}</p></div>
  <div class="g-kv"><span>피할 곳</span><p>{esc(d['avoid'])}</p></div>
  {g_table(["권역", "지역 콕 찝기"], area_rows, "g-table-2 g-table-area")}
</div>""")

    s2 = f"""<section class="ilju-body">
  <h2 class="ilju-h2">2. 오행별 방위·입지·지역</h2>
  <p class="g-p">내게 부족한 오행을 채우는 방향으로 현관·큰 창·내 자리를 두면 됩니다. 지역표는 같은 오행이라도 사는 권역이 다르면 어떻게 응용할지 보여 주기 위한 것입니다.</p>
  {''.join(el_blocks)}
</section>"""

    el_rows = [
        [f"<b>{esc(k)}</b>{esc(EL[k]['han'])}", esc(EL[k]["key"]), esc(EL[k]["b"]), esc(ctx.tables["ELEMENT_RX"][k]["dir"])]
        for k in ["목", "화", "토", "금", "수"]
    ]
    s3 = f"""<section class="ilju-body">
  <h2 class="ilju-h2">3. 내게 부족한 오행은 어떻게 찾나</h2>
  <p class="g-p">여덟 글자(시각을 모르면 여섯 글자)를 목·화·토·금·수로 나눠 개수를 셉니다. 가장 적은 오행이 내게 얇은 기운입니다. 리포트는 이 개수를 백분율로 보여 주고, 그 기운을 채우는 색·방위·업종·생활 루틴까지 적어 줍니다.</p>
  {g_table(["오행", "뜻", "이 기운이 하는 일", "채우는 방위"], el_rows, "g-table-4")}
  <p class="g-p g-muted">주의할 점은 <strong>가장 적은 오행과 용신이 다를 수 있다</strong>는 것입니다. 용신은 신강·신약까지 계산해 정하는 '가장 힘이 되는 기운'이고, 부족한 오행은 단순히 개수가 적은 기운입니다. 리포트는 둘을 구분해 보여 주고, 부동산 방위는 용신 기준으로 잡습니다.</p>
</section>"""

    s4 = f"""<section class="ilju-body">
  <h2 class="ilju-h2">4. 2027년 부동산 타이밍</h2>
  <p class="g-p">2027 정미년의 아래 글자는 <strong>미(未)토</strong>입니다. 흙 기운이 한 겹 더해지는 해라 부동산·토 자산의 기운이 강해집니다. 취득 타이밍은 나쁘지 않지만, 보유세·유지비·대출이자도 함께 커지므로 매수 전 숫자를 확인해야 합니다.</p>
  {g_list([
    "<b>3년치 현금흐름</b> — 대출이자·보유세·수리비를 표로 계산합니다. 월 소득의 30%를 넘는 대출은 무리입니다.",
    "<b>비상금 분리</b> — 매수 후 통장 잔고를 0으로 만드는 계획은 다시 짭니다.",
    "<b>명의·지분</b> — 부부·가족 공동명의는 지분·세금·책임을 문서로 남깁니다.",
    "<b>이사 시기</b> — 리포트가 표시한 방어 구간에는 이사·등기·명의 이동을 미룹니다.",
  ])}
</section>"""

    faqs = [
        ("내 사주에 좋은 방위는 어떻게 알 수 있나요?",
         "여덟 글자에서 가장 얇은 오행(또는 용신)을 찾고, 그 오행의 방위를 봅니다. 목은 동쪽, 화는 남쪽, 토는 생활권의 중심, 금은 서쪽, 수는 북쪽입니다. 현관이나 큰 창, 내가 주로 앉는 자리가 그 방향을 향하면 됩니다."),
        ("배산임수가 무슨 뜻인가요?",
         "뒤는 산이나 언덕으로 받쳐 주고 앞은 물이나 트인 땅으로 열린 자리를 말합니다. 뒤가 든든하고 앞이 트인 집이 오래 편하다는 뜻으로, 오행과 상관없이 적용되는 기본 조건입니다. 앞뒤가 꽉 막힌 집은 오행과 무관하게 답답합니다."),
        ("지방에 살면 수도권 지역표는 쓸모없나요?",
         "아닙니다. 지역표는 권역별로 나눠 두었습니다. 수도권·부산경남·대구경북·대전충청·광주전라·강원제주 여섯 권역에서 같은 오행의 결을 가진 동네를 각각 적었으니, 사는 권역의 줄만 보면 됩니다."),
        ("부족한 오행과 용신이 다르면 어느 쪽을 따라야 하나요?",
         "부동산 방위는 용신 기준으로 잡습니다. 용신은 신강·신약까지 계산한 '가장 힘이 되는 기운'이라, 단순 개수보다 정확합니다. 다만 리포트는 부족한 오행도 함께 보여 주니 두 값이 다르면 용신을 우선하세요."),
        ("2027년에 집을 사도 되나요?",
         "2027년은 미(未)토로 흙 기운이 더해지는 해라 부동산의 기운 자체는 강합니다. 다만 사주는 시장을 대신하지 않습니다. 리포트가 표시한 유리한 달에 매물을 보고 계약하되, 3년치 현금흐름과 명의·지분을 숫자와 문서로 확인하는 것이 먼저입니다."),
    ]

    return {
        "slug": "budongsan-bangwi-oheng",
        "label": "오행별 부동산 방위·배산임수·전국 지역",
        "title_tag": "부동산 방위·배산임수 — 부족한 오행으로 집·동네 고르기 | 월령",
        "og_title": "부족한 오행으로 집과 동네 고르는 법 | 월령",
        "desc": "사주에서 부족한 오행으로 부동산 방위와 입지를 고르는 법. 방위 재는 법, 배산임수 뜻, 목·화·토·금·수 오행별 방위·입지·피할 곳과 전국 6권역 실제 지역표, 2027 정미년 부동산 타이밍까지.",
        "hero": hero,
        "body": s1 + s2 + s3 + s4,
        "faqs": faqs,
        "related": ["changup-saup-saju", "don-gunghap", "2027-jeongminyeon"],
        "extra": [("60갑자 일주별 돈 사주", "../ilju/", "내 일주로 바로 보기")],
    }


# ── 가이드 3: 결혼·부부·동업자 돈 궁합 ─────────────────────

def guide_gunghap(ctx):
    data = json.loads((ROOT / "assets" / "data" / "gunghap-content.json").read_text(encoding="utf-8"))
    axes = data["axes"]
    tg = data["tenGods"]
    mp = data["moneyPrescription"]
    house = data["houseFengshui"]

    hero = f"""<section class="ilju-hero">
  <p class="eyebrow">가이드 · 돈 궁합 · 부부 · 동업</p>
  <h1>돈 궁합은<br><em>무엇을 보는 걸까</em></h1>
  <p class="ilju-desc">
    결혼을 앞두고, 혹은 동업자를 만나기 전에 "우리 돈 궁합"을 봅니다.
    월령의 돈 궁합은 두 사람의 성격을 비교하는 대신 <strong>다섯 축</strong>으로
    함께 돈을 벌고 지킬 때 어디서 시너지가 나고 어디서 새는지를 계산합니다.
    아래는 실제 리포트에 쓰는 축과 처방 문구입니다.
  </p>
  <div class="chip-row"><span class="chip">수익 시너지</span><span class="chip">계약 소통</span><span class="chip">현금 균형</span><span class="chip">안정</span><span class="chip">2027 공동재물</span></div>
</section>"""

    axis_rows = [
        [f"<b>{esc(a['name'])}</b>", f"{a['maxScore']}점", esc(a["levels"][1]["text"] if len(a["levels"]) > 1 else a["levels"][0]["text"])]
        for a in axes
    ]

    s1 = f"""<section class="ilju-body">
  <h2 class="ilju-h2">1. 다섯 축 — 무엇을 계산하나</h2>
  {g_table(["축", "배점", "중간 구간의 뜻"], axis_rows, "g-table-3")}
  <p class="g-p">총점은 100점입니다. 점수가 높고 낮음보다 중요한 것은 <strong>어느 축이 약한지</strong>입니다. 약한 축에는 역할 분담·자금 관리·명의·계약 규칙이 처방으로 붙습니다.</p>
</section>"""

    s2 = f"""<section class="ilju-body">
  <h2 class="ilju-h2">2. 부부·커플 모드와 동업·거래처 모드</h2>
  {g_cards([
    ("부부·커플 — 공동자산과 생활비의 호흡",
     esc(mp["household"])),
    ("동업·거래처 — 지분과 정산의 룰",
     esc(mp["business"])),
  ])}
  <p class="g-p">같은 다섯 축을 계산하지만 무게가 다릅니다. 부부 모드는 재성(현금)과 용신(서로의 빈자리) 비중이 생활비·공동자산 쪽으로 옮겨 가고, 동업 모드는 매출과 지분·정산 쪽으로 옮겨 갑니다.</p>
</section>"""

    ten_rows = []
    for k in ["비견", "겁재", "식신", "상관", "편재", "정재", "편관", "정관", "편인", "정인"]:
        ten_rows.append([f"<b>{esc(k)}</b>", esc(tg["business"].get(k, "")), esc(tg["lover"].get(k, ""))])

    s3 = f"""<section class="ilju-body">
  <h2 class="ilju-h2">3. 상대가 내 돈·사업에 맡는 역할</h2>
  <p class="g-p">상대의 일간이 내 일간에게 어떤 십성으로 작용하는지 보면, 두 사람의 경제적 관계가 드러납니다. 자금을 대는 쪽인지, 영업을 열어 주는 쪽인지, 지출을 키우는 쪽인지입니다.</p>
  {g_table(["상대의 역할(십성)", "동업·거래처에서", "부부·커플에서"], ten_rows, "g-table-3")}
  <p class="g-p g-muted">{esc(tg["note"])}</p>
</section>"""

    role_rows = [[f"<b>{esc(k)}</b>", esc(v)] for k, v in [
        ("수익 창출", mp["roles"]["income"]),
        ("자금 관리", mp["roles"]["cash"]),
        ("부동산", mp["roles"]["property"]),
        ("계약·명의", mp["roles"]["check"]),
    ]]

    s4 = f"""<section class="ilju-body">
  <h2 class="ilju-h2">4. 역할·지분·정산 규칙</h2>
  {g_table(["역할", "맡길 일"], role_rows, "g-table-2")}
  <p class="g-p">함께 살 집이나 사무실의 방위도 두 사람의 여덟 글자를 합쳐 가장 얇은 오행으로 정합니다. {esc(house["couple"])}</p>
</section>"""

    faqs = [
        ("돈 궁합은 점수가 높아야 좋은 건가요?",
         "점수는 관계의 좋고 나쁨이 아니라, 함께 돈을 다룰 때 어느 축을 조심해야 하는지를 보여 주는 지표입니다. 100점 만점 중 어느 축이 낮은지가 훨씬 중요하고, 낮은 축에는 역할 분담·자금 관리·계약 규칙 처방이 붙습니다."),
        ("결혼 전에 꼭 봐야 하나요?",
         "필수는 아닙니다. 다만 공동 통장·생활비 비율·부동산 명의·보증 같은 결정을 앞두고 있다면, 두 사람이 어디서 부딪히기 쉬운지 미리 알아 두면 대화가 훨씬 짧아집니다. 월령은 갈등 대처법까지 상황별로 적어 줍니다."),
        ("동업자와도 볼 수 있나요?",
         "네. 동업·거래처 모드로 보면 지분·의결권·역할·출구 조건을 어떻게 나눌지까지 처방으로 나옵니다. 사주가 동업의 성패를 정하지는 않지만, 약한 축을 미리 알면 룰로 막을 수 있습니다."),
        ("두 사람 생년월일이 서버에 저장되나요?",
         "아니요. 계산은 전부 브라우저 안에서 이뤄지고 서버로 보내지 않습니다. 결과 공유 링크에도 두 사람의 생년월일은 담기지 않습니다."),
        ("부부·동업 모드를 바꾸면 결과가 달라지나요?",
         "같은 다섯 축을 계산하되 비중과 처방 문구가 달라집니다. 부부 모드는 생활비·공동자산·부동산 매수 호흡 쪽으로, 동업 모드는 매출·지분·정산 쪽으로 무게가 옮겨 갑니다."),
    ]

    return {
        "slug": "don-gunghap",
        "label": "결혼·부부·동업자 돈 궁합 보는 법",
        "title_tag": "돈 궁합 보는 법 — 부부·동업 5축과 지분·정산 규칙 | 월령",
        "og_title": "돈 궁합은 무엇을 보는 걸까 | 월령",
        "desc": "두 사람의 사주로 보는 돈 궁합 5축(수익 시너지·계약 소통·현금 균형·안정·2027 공동재물), 부부·커플 모드와 동업·거래처 모드의 차이, 상대 일간 십성별 역할과 지분·정산·공동통장 규칙까지.",
        "hero": hero,
        "body": s1 + s2 + s3 + s4,
        "faqs": faqs,
        "related": ["changup-saup-saju", "budongsan-bangwi-oheng", "2027-jeongminyeon"],
        "extra": [("60갑자 일주별 돈 사주", "../ilju/", "내 일주로 바로 보기")],
    }


# ── 가이드 4: 2027 정미년 재물운과 일진 캘린더 ─────────────

def guide_2027(ctx):
    YG = ctx.tables["Y2027_GAN"]
    months = ctx.tables["MONTHS2027"]

    hero = f"""<section class="ilju-hero">
  <p class="eyebrow">가이드 · 2027 정미년 · 일진 캘린더</p>
  <h1>2027 정미년,<br><em>재물운은 어떻게 흐르나</em></h1>
  <p class="ilju-desc">
    2027년은 <strong>정미년(丁未年)</strong>입니다. 하늘 글자 정(丁)은 작은 불, 땅 글자 미(未)는 여름의 흙입니다.
    같은 해라도 내 일간에 따라 이 기운이 재성·관성·식상으로 달리 들어오기 때문에, 해마다 하는 운세와
    결이 다릅니다. 여기서는 2027년의 구조와, 365일 일진 캘린더를 실제로 쓰는 방법을 정리했습니다.
  </p>
  <div class="chip-row"><span class="chip">2027 정미년</span><span class="chip">정(丁) 화</span><span class="chip">미(未) 토</span><span class="chip">365일 일진</span><span class="chip">.ics</span><span class="chip">PDF</span></div>
</section>"""

    s1 = f"""<section class="ilju-body">
  <h2 class="ilju-h2">1. 2027 정미년의 구조</h2>
  {g_cards([
    ("정(丁) — 작은 불, 방향을 밝히는 기운",
     "정(丁)은 촛불·등불처럼 좁지만 밝은 불입니다. 크게 태우는 힘보다 한 곳을 비추는 힘이라, 판을 넓히기보다 이미 가진 것의 값을 올리는 해로 읽습니다."),
    ("미(未) — 여름의 흙, 저장하고 익히는 기운",
     "미(未)는 여름이 무르익는 흙입니다. 토 기운이라 부동산·자산과 인연이 닿고, 작물을 저장하듯 벌어 둔 것을 지키는 쪽에 힘이 실립니다."),
    ("그래서 2027년은",
     "새로 크게 벌이기보다, 가진 것을 값으로 바꾸고 지키는 해입니다. 리포트는 이 구조 위에 내 일간과 용신을 얹어 4대 영역·12개월·365일을 계산합니다."),
  ])}
</section>"""

    day_rows = []
    for d in ctx.tables["DING"]:
        body = esc(YG[d["ss"]]["b"].split(". ")[0] + ".")
        day_rows.append([f"<b>{esc(d['gan'])}</b>{esc(d['ganHan'])}", esc(d["ss"]), esc(YG[d["ss"]]["title"]), body])

    s2 = f"""<section class="ilju-body">
  <h2 class="ilju-h2">2. 내 일간별 2027년 재물운</h2>
  <p class="g-p">하늘 글자 정(丁)이 내 일간에 들어오는 십성을 찾으면 2027년의 결이 보입니다. 열 줄 중 내 일간을 찾아 읽어 보세요.</p>
  {g_table(["내 일간", "정(丁)의 십성", "한 해의 결", "재물 쪽 첫 문장"], day_rows, "g-table-4")}
</section>"""

    mon_rows = [[f"<b>{m['no']}월</b>", esc(m["label"]), esc(m["name"]), esc(m["range"])] for m in months]

    s3 = f"""<section class="ilju-body">
  <h2 class="ilju-h2">3. 12개월은 1월 1일이 아니라 절입일 기준</h2>
  <p class="g-p">사주에서 한 달은 달력이 아니라 계절이 바뀌는 시각(절입일·節入日)에 시작합니다. 그래서 리포트의 1월은 1월 5일 소한부터, 2월은 입춘부터입니다. 같은 1월이라도 초순과 하순의 기운이 다르기 때문에, 계약 날짜를 잡을 때는 이 경계를 알아 두면 좋습니다.</p>
  {g_table(["달", "월건", "절기 구간", "날짜"], [r for r in mon_rows], "g-table-4")}
  <p class="g-p g-muted">표의 월건은 그 달의 천간·지지입니다. 같은 2027년이라도 달마다 내 사주에 들어오는 십성이 달라지므로, 리포트는 달마다 할 일(계약·정산·점검)을 따로 적습니다.</p>
</section>"""

    s4 = f"""<section class="ilju-body">
  <h2 class="ilju-h2">4. 365일 일진 캘린더를 쓰는 법</h2>
  <p class="g-p">하루에도 천간·지지가 있습니다. 2027년 365일의 일진을 만세력으로 계산하고, 내 일간·용신과의 관계로 점수를 매기면 '오늘 큰 결제를 해도 되는 날인지'가 보입니다. 월령은 하루를 세 가지로만 나눕니다.</p>
  {g_cards([
    ("좋은 흐름", "계약·입금·단가 협상·영업이 잘 풀리는 날. 미뤄 둔 청구서·제안을 이 날 보냅니다."),
    ("보통", "무난한 날. 확인과 정리에 쓰고, 큰 결정은 다음 좋은 날로 미룹니다."),
    ("신중", "큰 결제·서명·이사·명의 이동을 하루 미루는 날. 부딪히는 글자가 걸리면 이유도 함께 나옵니다."),
  ])}
  <ol class="g-steps">
    <li><b>캘린더 열기</b> — 리포트의 「2027 재물운 365일 캘린더」에서 1~12월을 넘기며 날짜를 누르면 그날의 일진과 해석이 나옵니다.</li>
    <li><b>.ics로 저장</b> — 「2027 재물운 캘린더(.ics) 저장」을 누르면 구글 캘린더·아이폰 캘린더에 그대로 가져올 수 있는 파일이 받아집니다. 그달 요약 1개와 주요 길일·신중일이 함께 들어갑니다.</li>
    <li><b>PDF로 소장</b> — 「PDF 소장용 저장」을 누르고 인쇄 창에서 'PDF로 저장'을 고르면, 명식표·맞춤 처방·4대 영역·12개월·365일 요약이 A4로 정리돼 저장됩니다.</li>
  </ol>
</section>"""

    faqs = [
        ("2027 정미년이 무슨 뜻인가요?",
         "2027년의 천간이 정(丁), 지지가 미(未)라는 뜻입니다. 정은 작은 불, 미는 여름의 흙으로, 크게 벌이기보다 가진 것을 값으로 바꾸고 지키는 해로 읽습니다. 같은 해라도 내 일간에 따라 이 기운이 재성·관성·식상으로 달리 들어옵니다."),
        ("일진은 어떻게 계산하나요?",
         "날짜 자체의 60갑자 순환으로 계산합니다. 2027년 1월 1일은 경진(庚辰)일이고, 하루에 한 칸씩 순행합니다. 월령은 이 일진과 내 일간·용신의 관계를 규칙으로 계산해 점수를 매기며, 무작위나 매번 달라지는 값은 쓰지 않습니다."),
        ("캘린더 파일(.ics)은 어떻게 쓰나요?",
         "버튼을 누르면 표준 캘린더 파일이 내려받아집니다. 아이폰은 파일을 열면 캘린더 앱이 바로 물어보고, 구글 캘린더는 설정의 '가져오기'에서 파일을 올리면 됩니다. 그달 요약과 주요 길일·신중일이 일정으로 들어갑니다."),
        ("좋은 날에 꼭 계약해야 하나요?",
         "절대 규칙은 아닙니다. 다만 같은 조건이라면 힘이 실리는 날에 서명하고, 부딪히는 날에는 하루 미루는 편이 마음이 덜 흔들립니다. 사주는 참고이고, 실제 계약은 조건과 상대를 확인하는 것이 먼저입니다."),
        ("PDF로 저장하면 무엇이 들어가나요?",
         "월령 브랜드 헤더, 사주 명식표(네 기둥·오행 비율·용신), 지금 고민 맞춤 처방, 4대 재물 영역, 12개월 타이밍 표, 365일 핵심 길일·주의일 요약이 A4에 잘림 없이 들어갑니다. 휴대폰 브라우저에서 바로 저장할 수 있습니다."),
    ]

    return {
        "slug": "2027-jeongminyeon",
        "label": "2027 정미년 재물운 흐름과 일진 캘린더 활용법",
        "title_tag": "2027 정미년 재물운 — 일진 캘린더·.ics 활용법 | 월령",
        "og_title": "2027 정미년, 재물운은 어떻게 흐르나 | 월령",
        "desc": "2027 정미년(丁未年)의 구조와 내 일간별 재물운, 절입일 기준 12개월 표, 365일 일진 캘린더를 쓰는 법(.ics 저장·PDF 소장)까지. 무작위 없이 규칙으로 계산한 2027년 재물운 안내입니다.",
        "hero": hero,
        "body": s1 + s2 + s3 + s4,
        "faqs": faqs,
        "related": ["changup-saup-saju", "budongsan-bangwi-oheng", "don-gunghap"],
        "extra": [("60갑자 일주별 돈 사주", "../ilju/", "내 일주로 바로 보기")],
    }


GUIDE_BUILDERS = {
    "changup-saup-saju": guide_changup,
    "budongsan-bangwi-oheng": guide_budongsan,
    "don-gunghap": guide_gunghap,
    "2027-jeongminyeon": guide_2027,
}


def render_guide(ctx, g):
    url = guide_url(g["slug"])
    faq_schema = [
        {"@type": "Question", "name": q, "acceptedAnswer": {"@type": "Answer", "text": a}}
        for q, a in g["faqs"]
    ]
    schema = [
        {
            "@type": "Article",
            "headline": g["label"],
            "description": g["desc"],
            "inLanguage": "ko",
            "mainEntityOfPage": {"@type": "WebPage", "@id": url},
            "url": url,
            "author": {"@type": "Organization", "name": BRAND, "url": BASE_URL + "/"},
            "publisher": {"@type": "Organization", "name": BRAND, "url": BASE_URL + "/"},
            "datePublished": PUBLISH_DATE,
            "dateModified": BUILD_DATE,
            "about": [
                {"@type": "Thing", "name": "2027 정미년 재물운"},
                {"@type": "Thing", "name": "사주 돈·사업·계약·부동산"},
                {"@type": "Thing", "name": g["label"]},
            ],
            "isPartOf": {"@type": "CollectionPage", "@id": BASE_URL + "/guide/"},
        },
        {
            "@type": "BreadcrumbList",
            "itemListElement": [
                {"@type": "ListItem", "position": 1, "name": "월령", "item": BASE_URL + "/"},
                {"@type": "ListItem", "position": 2, "name": "가이드", "item": BASE_URL + "/guide/"},
                {"@type": "ListItem", "position": 3, "name": g["label"], "item": url},
            ],
        },
        {"@type": "FAQPage", "mainEntity": faq_schema},
    ]

    return f"""<!DOCTYPE html>
<html lang="ko">
<head>
{HEAD_COMMON.format(favicon=FAVICON, root="../", css=CSS_VERSION)}
<title>{esc(g['title_tag'])}</title>
<meta name="description" content="{esc(g['desc'])}">
<link rel="canonical" href="{url}">
<meta property="og:type" content="article">
<meta property="og:site_name" content="월령">
<meta property="og:title" content="{esc(g['og_title'])}">
<meta property="og:description" content="{esc(g['desc'])}">
<meta property="og:url" content="{url}">
<meta property="og:locale" content="ko_KR">
<meta name="twitter:card" content="summary">
<meta name="twitter:title" content="{esc(g['og_title'])}">
<meta name="twitter:description" content="{esc(g['desc'])}">
<script type="application/ld+json">{jsonld(schema)}</script>
{ANALYTICS}
</head>
<body class="ilju-page guide-page">

{guide_topbar()}
{guide_crumbs(g['label'])}

<main class="ilju-wrap">
{g['hero']}
{guide_cta()}
{g['body']}
{guide_cta()}
{guide_related(g['related'], g.get('extra'))}
{guide_faq_html(g['faqs'])}
<section class="ilju-body">
  <p class="disclaimer">{DISCLAIMER}</p>
</section>
</main>

{footer(ctx)}
</body>
</html>
"""


def render_guide_index(ctx, guides):
    url = BASE_URL + "/guide/"
    title_tag = "월령 가이드 — 창업·부동산 방위·돈 궁합·2027 재물운"
    desc = (
        "창업·계약 사주 보는 법, 부족한 오행으로 고르는 부동산 방위·배산임수·전국 지역, "
        "부부·동업자 돈 궁합 5축, 2027 정미년 재물운과 365일 일진 캘린더 활용법을 한자리에 모았습니다."
    )
    cards = "".join(
        f'<a class="g-index-card" href="{g["slug"]}.html">'
        f'<p class="gic-k">가이드</p><p class="gic-t">{esc(g["label"])}</p>'
        f'<p class="gic-d">{esc(g["desc"])}</p></a>'
        for g in guides
    )
    schema = [
        {
            "@type": "CollectionPage",
            "name": "월령 가이드",
            "description": desc,
            "url": url,
            "inLanguage": "ko",
            "isPartOf": {"@type": "WebSite", "@id": BASE_URL + "/"},
            "hasPart": [
                {"@type": "Article", "name": g["label"], "url": guide_url(g["slug"])}
                for g in guides
            ],
        },
        {
            "@type": "BreadcrumbList",
            "itemListElement": [
                {"@type": "ListItem", "position": 1, "name": "월령", "item": BASE_URL + "/"},
                {"@type": "ListItem", "position": 2, "name": "가이드", "item": url},
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
<meta property="og:title" content="월령 가이드 — 재물 사주 읽는 법">
<meta property="og:description" content="{esc(desc)}">
<meta property="og:url" content="{url}">
<meta property="og:locale" content="ko_KR">
<meta name="twitter:card" content="summary">
<script type="application/ld+json">{jsonld(schema)}</script>
{ANALYTICS}
</head>
<body class="ilju-page guide-page">

{guide_topbar()}
<nav class="crumbs" aria-label="위치"><a href="../">월령</a><span class="sep">/</span><span>가이드</span></nav>

<main class="ilju-wrap">
<section class="ilju-hero">
  <p class="eyebrow">가이드 · 재물 사주 읽는 법</p>
  <h1>사주로 돈을 읽는<br><em>네 가지 방법</em></h1>
  <p class="ilju-desc">일주 60편이 "내 일주"로 찾아오는 글이라면, 여기는 <strong>방법을 묻는 질문</strong>에 답하는 글입니다. 창업, 부동산 방위, 돈 궁합, 2027년 재물운 — 실제 리포트가 쓰는 기준 그대로 정리했습니다.</p>
</section>
{guide_cta()}
<section class="ilju-body">
  <h2 class="ilju-h2">가이드 목록</h2>
  <div class="g-index-grid">{cards}</div>
</section>
<section class="ilju-body">
  <h2 class="ilju-h2">바로 계산해 보기</h2>
  <div class="link-grid">
    <a class="link-card" href="../#birthForm"><span class="lc-name">내 2027 재물 사주</span><span class="lc-sub">생년월일만 넣으면 무료</span></a>
    <a class="link-card" href="../#ghForm"><span class="lc-name">2인 돈 궁합</span><span class="lc-sub">부부·동업 무료</span></a>
    <a class="link-card" href="../ilju/"><span class="lc-name">60갑자 일주 60편</span><span class="lc-sub">내 일주로 보기</span></a>
  </div>
</section>
<section class="ilju-body">
  <p class="disclaimer">{DISCLAIMER}</p>
</section>
</main>

{footer(ctx)}
</body>
</html>
"""


# ─────────────────────────────────────────────────────────────
# 8-C. AI 검색 대응 — llms.txt · robots.txt
# ─────────────────────────────────────────────────────────────

def render_llms(ctx):
    """AI 검색엔진(ChatGPT·Perplexity·Claude·Gemini 등)이 그대로 인용하기 좋은 서비스 요약."""
    L = []
    L.append("# 월령 (月令) — 2027년 돈·사업·계약·부동산 사주 리포트")
    L.append("")
    L.append(f"> {BASE_URL}/")
    L.append("")
    L.append(
        "월령은 생년월일·출생 시각만으로 절기(節氣) 시각까지 계산한 만세력으로 사주 여덟 글자를 세우고, "
        "2027 정미년(丁未年)의 돈·사업·계약·부동산 흐름을 네 갈래로 풀어 주는 한국어 웹 서비스입니다. "
        "결혼·부부·동업자 사이의 '돈 궁합'도 같은 산식으로 계산합니다. "
        "모든 계산은 서버 전송 없이 브라우저 안에서 이뤄지고, 외부 AI API나 유료 데이터를 쓰지 않습니다. "
        "2026년 11월 기준 오픈 기념으로 리포트 전체가 무료입니다."
    )
    L.append("")
    L.append("## 무엇을 제공하나")
    L.append("")
    L.append("- **1인 재물 사주**: 2027년 현금흐름·투자, 사업·수익모델, 계약·문서·리스크, 부동산·자산 증식 4대 영역. 신강·신약(내 힘의 세기), 용신(가장 힘이 되는 기운), 십성, 대운, 12개월 타이밍, 돈이 새는 구멍과 보완 전략까지.")
    L.append("- **지금 고민 맞춤 처방**: '전체 재물·사업 흐름 / 창업·신규 사업 / 사업 성장·확장 / 이직·연봉 협상 / 투자·자산 증식 / 부동산 매매·이사 / 동업·부채·자금 정리' 7가지 중 고른 고민에 원국·2027 흐름·유리한 달·주의할 달을 겹쳐 실행 전략과 피할 함정을 제시.")
    L.append("- **2027 재물운 365일 캘린더**: 2027-01-01~12-31의 일진(천간·지지)을 계산해 하루를 '좋은 흐름 / 보통 / 신중'으로 나누고, 날짜별 짧은 실용 해석을 제공. 표준 RFC 5545 `.ics` 파일로 내려받아 구글 캘린더·아이폰 캘린더에 넣을 수 있음.")
    L.append("- **PDF 소장용 저장**: 브랜드 헤더·사주 명식표·고민 맞춤 처방·4대 영역·12개월 흐름·365일 핵심 길일/주의일을 A4로 잘림 없이 인쇄·PDF 저장.")
    L.append("- **2인 돈 궁합**: 부부·커플 / 동업·거래처 두 모드. 수익 시너지(30)·계약·의사결정 소통(20)·현금 균형(25)·안정(15)·2027 공동재물(10) 다섯 축 100점. 역할 분담·지분·정산·공동명의 규칙과 함께 살 집·사무실 방위까지.")
    L.append("- **오행별 부동산 방위·입지**: 부족한 오행(목·화·토·금·수)에 맞춘 방위, 배산임수(背山臨水) 입지, 피할 자리, 전국 6권역(수도권·부산경남·대구경북·대전충청·광주전라·강원제주) 실제 지역 예시.")
    L.append("- **60갑자 일주 60편**: 태어난 날의 간지(갑자~계해)로 보는 재물 성향과 2027년 흐름.")
    L.append("")
    L.append("## 핵심 URL")
    L.append("")
    L.append(f"- 서비스(1인 재물 사주·2인 돈 궁합): {BASE_URL}/")
    L.append(f"- 가이드 허브: {BASE_URL}/guide/")
    L.append(f"- 창업·사업운·계약 사주 보는 법: {guide_url('changup-saup-saju')}")
    L.append(f"- 오행별 부동산 방위·배산임수·전국 지역: {guide_url('budongsan-bangwi-oheng')}")
    L.append(f"- 결혼·부부·동업자 돈 궁합 보는 법: {guide_url('don-gunghap')}")
    L.append(f"- 2027 정미년 재물운과 일진 캘린더 활용법: {guide_url('2027-jeongminyeon')}")
    L.append(f"- 60갑자 일주 60편 목록: {BASE_URL}/ilju/")
    L.append(f"- 이용약관·환불정책: {BASE_URL}/terms.html")
    L.append("")
    L.append("## 계산 방식 (인용 시 함께 밝혀 주세요)")
    L.append("")
    L.append("- 절기 시각: 태양 황경으로 계산한 1920~2040년 입춘·경칩 등 24절기 시각(분 단위)을 미리 계산해 두고 사용. 사주의 해는 입춘(立春)에, 달은 절입일(節入日)에 바뀌며 달력의 1월 1일과 다름.")
    L.append("- 일주(日柱): 날짜의 60갑자 순환으로 계산. 예) 1990-03-25는 기축(己丑)일, 2027-01-01은 경진(庚辰)일.")
    L.append("- 신강·신약: 여덟 글자의 자리별 무게(월지 30, 일지 15, 월간 15, 시간 11, 년지 10, 시지 10, 년간 9)와 오행 생극으로 점수화.")
    L.append("- 일별 재물운: 그날 일진의 천간·지지가 내 일간에 작용하는 십성, 일지와의 합·충·형·파·해, 용신·희신·기신 해당 여부로 점수를 매기고 '좋은 흐름/보통/신중' 세 단계로 표시. 무작위 값은 쓰지 않음.")
    L.append("- 같은 생년월일·시각이면 언제 열어도 같은 결과가 나옵니다.")
    L.append("")
    L.append("## 자주 묻는 질문")
    L.append("")
    L.append("### 사주로 사업운·계약 타이밍을 볼 수 있나요?")
    L.append("월령은 2027년 12개월을 절입일 기준으로 나눠, 계약·매수에 힘이 실리는 달과 서명을 미뤄야 하는 달을 갈라 보여 줍니다. 사업 형태(상품·콘텐츠형/거래·유통형/조직·계약형/전문·권리형/1인 전문사업형)도 여덟 글자의 십성 구성으로 정합니다. 참고·오락용 콘텐츠이며 실제 투자·계약 판단의 근거로 쓸 수 없습니다.")
    L.append("")
    L.append("### 부부·동업자 돈 궁합은 무엇을 보나요?")
    L.append("두 사람의 수익 시너지(30점)·계약·의사결정 소통(20점)·현금 균형(25점)·안정(15점)·2027 공동재물(10점) 다섯 축을 100점으로 계산합니다. 점수보다 어느 축이 약한지가 중요하며, 약한 축에는 역할 분담·자금 관리·지분·정산·명의 규칙을 처방으로 제시합니다.")
    L.append("")
    L.append("### 부족한 오행으로 부동산·집터 방위를 고르는 법은?")
    L.append("여덟 글자에서 가장 얇은 오행(또는 용신)을 찾아 그 오행의 방위를 씁니다. 목=동쪽, 화=남쪽, 토=생활권 중심, 금=서쪽, 수=북쪽입니다. 현관·큰 창·주로 앉는 자리가 그 방향을 향하게 하고, 뒤가 산으로 받쳐지고 앞이 트인 배산임수 자리를 기본 조건으로 봅니다. 전국 6권역별 실제 지역 예시도 제공합니다.")
    L.append("")
    L.append("### 2027 정미년은 어떤 해인가요?")
    L.append("천간 정(丁)은 작은 불, 지지 미(未)는 여름의 흙입니다. 새로 크게 벌이기보다 가진 것을 값으로 바꾸고 지키는 해로 읽습니다. 같은 해라도 내 일간에 따라 정(丁)이 재성·관성·식상·인성·비겁 중 어떤 십성으로 들어오는지가 달라집니다.")
    L.append("")
    L.append("### 무료인가요?")
    L.append("2026년 11월 기준 오픈 기념으로 1인 재물 사주와 2인 돈 궁합 리포트 전체가 무료입니다. 결제 없이 365일 캘린더(.ics)와 PDF 저장까지 사용할 수 있습니다.")
    L.append("")
    L.append("### 생년월일이 저장되나요?")
    L.append("아니요. 모든 계산은 브라우저 안에서 이뤄지고 서버로 전송되지 않습니다. 편의를 위해 마지막 입력과 열람 여부만 그 기기의 브라우저 저장소에 남습니다.")
    L.append("")
    L.append("## 크롤링 안내")
    L.append("")
    L.append("- 검색엔진과 AI 검색봇의 수집을 허용합니다. 자세한 규칙은 robots.txt를 참고하세요.")
    L.append("- 인용 시 출처로 '월령(wolryeong-saju.vercel.app)'과 해당 페이지 URL을 함께 표기해 주세요.")
    L.append("- 월령의 리포트는 전통 명리학 계산 규칙을 프로그램으로 옮긴 참고·오락용 콘텐츠이며, 의료·법률·투자 판단의 근거가 될 수 없습니다.")
    L.append(f"- 문의: {CONTACT_EMAIL}")
    L.append("")
    return "\n".join(L)


def render_robots():
    bots = [
        "*", "Googlebot", "Googlebot-Image", "Yeti", "NaverBot", "Daum",
        "bingbot", "OAI-SearchBot", "ChatGPT-User", "GPTBot",
        "PerplexityBot", "Perplexity-User", "ClaudeBot", "Claude-Web",
        "anthropic-ai", "Google-Extended", "Applebot", "Applebot-Extended",
        "cohere-ai", "Bytespider", "Amazonbot", "meta-externalagent",
    ]
    lines = []
    for b in bots:
        lines.append(f"User-agent: {b}")
        lines.append("Allow: /")
        lines.append("")
    lines.append(f"Sitemap: {BASE_URL}/sitemap.xml")
    lines.append("")
    lines.append("# AI 검색·인용용 요약: " + BASE_URL + "/llms.txt")
    lines.append("")
    return "\n".join(lines)


def render_sitemap(ctx):
    rows = [
        (BASE_URL + "/", "1.0", "weekly"),
        (BASE_URL + "/ilju/", "0.9", "weekly"),
        (BASE_URL + "/terms.html", "0.3", "yearly"),
    ]
    for it in ctx.items:
        rows.append((ctx.page_url(it), "0.8", "monthly"))
    rows.append((BASE_URL + "/guide/", "0.7", "monthly"))
    for slug in GUIDE_SLUGS:
        rows.append((guide_url(slug), "0.7", "monthly"))

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
            count = src.count("내 생년월일시로 돈·사업·부동산 사주")
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

    # ── 가이드 페이지 (guide/) — 일주 페이지와 같은 기준으로 검사
    guide_pages = sorted(GUIDE_DIR.glob("*.html")) if GUIDE_DIR.exists() else []
    if len(guide_pages) != len(GUIDE_SLUGS) + 1:
        problems.append(
            f"guide/ 페이지 수가 {len(GUIDE_SLUGS) + 1}(목록+{len(GUIDE_SLUGS)})이 아님: {len(guide_pages)}"
        )
    for path in guide_pages:
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

        # 본문에 실제 내용(질문·답)이 있는지 — AI 검색이 인용할 최소 분량
        text_len = len(re.sub(r"<[^>]+>", "", src))
        if text_len < 2500:
            problems.append(f"{rel}: 본문 텍스트가 너무 짧음 ({text_len}자)")

        for href in p.links:
            if href.startswith(("http://", "https://", "mailto:", "#", "data:")):
                continue
            target = href.split("#")[0].split("?")[0]
            if not target:
                continue
            if target.startswith("/_vercel/"):
                continue
            resolved = (path.parent / target).resolve()
            if target.endswith("/"):
                resolved = resolved / "index.html"
            if not resolved.exists():
                problems.append(f"{rel}: 깨진 링크 {href}")

    # ── 가이드 본문에 실데이터가 들어갔는지 (반복 스팸 페이지 방지)
    if len(guide_pages) == len(GUIDE_SLUGS) + 1:
        joined = "".join(p.read_text(encoding="utf-8") for p in guide_pages)
        for token in ("배산임수", "수익 시너지", "정미년", "일진"):
            if token not in joined:
                problems.append(f"guide/: 핵심 데이터 '{token}' 누락")
        for slug in GUIDE_SLUGS:
            f = GUIDE_DIR / f"{slug}.html"
            if not f.exists():
                problems.append(f"guide/: {slug}.html 없음")
            elif '"@type": "FAQPage"' not in f.read_text(encoding="utf-8"):
                problems.append(f"guide/{slug}.html: FAQPage JSON-LD 누락")

    # ── llms.txt (AI 검색·인용용 요약)
    llms = ROOT / "llms.txt"
    if not llms.exists():
        problems.append("llms.txt 없음")
    else:
        lt = llms.read_text(encoding="utf-8")
        if not lt.startswith("# 월령"):
            problems.append("llms.txt: 제목(# 월령)이 아님")
        for token in (BASE_URL + "/", BASE_URL + "/ilju/", BASE_URL + "/guide/",
                      guide_url("changup-saup-saju"), guide_url("budongsan-bangwi-oheng"),
                      guide_url("don-gunghap"), guide_url("2027-jeongminyeon"),
                      "2027 정미년", "365일", ".ics", "무료"):
            if token not in lt:
                problems.append(f"llms.txt: '{token}' 누락")
        if len(lt) < 2000:
            problems.append(f"llms.txt: 내용이 너무 짧음 ({len(lt)}자)")

    # sitemap ↔ 실제 파일
    sm = ROOT / "sitemap.xml"
    if not sm.exists():
        problems.append("sitemap.xml 없음")
    else:
        locs = re.findall(r"<loc>([^<]+)</loc>", sm.read_text(encoding="utf-8"))
        expected_urls = 63 + 1 + len(GUIDE_SLUGS)   # 기존 63 + 가이드 목록 1 + 가이드 4
        if len(locs) != expected_urls:
            problems.append(f"sitemap URL 수가 {expected_urls}이 아님: {len(locs)}")
        for slug in GUIDE_SLUGS:
            if guide_url(slug) not in locs:
                problems.append(f"sitemap: 가이드 URL 누락 — {guide_url(slug)}")
        if BASE_URL + "/guide/" not in locs:
            problems.append("sitemap: 가이드 목록 URL 누락")
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
    else:
        rt = rb.read_text(encoding="utf-8")
        if "Sitemap:" not in rt:
            problems.append("robots.txt: Sitemap 줄 없음")
        for bot in ("Googlebot", "Yeti", "OAI-SearchBot", "ChatGPT-User", "GPTBot",
                    "PerplexityBot", "ClaudeBot", "Google-Extended"):
            if f"User-agent: {bot}" not in rt:
                problems.append(f"robots.txt: AI/검색봇 {bot} 허용 줄 없음")
        if "llms.txt" not in rt:
            problems.append("robots.txt: llms.txt 안내 없음")

    # 메인에서 일주 목록으로 가는 링크
    main_html = (ROOT / "index.html").read_text(encoding="utf-8")
    if 'href="ilju/"' not in main_html:
        problems.append("index.html: ilju/ 로 가는 링크 없음")
    if 'href="guide/"' not in main_html:
        problems.append("index.html: guide/ 로 가는 링크 없음")
    for token in ('"@type": "WebApplication"', '"@type": "FAQPage"', '"@type": "Organization"'):
        if token not in main_html:
            problems.append(f"index.html: JSON-LD {token} 누락")

    return problems


# ─────────────────────────────────────────────────────────────
# 10. 실행
# ─────────────────────────────────────────────────────────────

def build():
    items, tables = load_items()
    ctx = Ctx(items, tables)
    ILJU_DIR.mkdir(exist_ok=True)
    GUIDE_DIR.mkdir(exist_ok=True)

    for it in items:
        (ILJU_DIR / f"{SLUGS[it['i']]}.html").write_text(render_ilju(ctx, it), encoding="utf-8")
    (ILJU_DIR / "index.html").write_text(render_index(ctx), encoding="utf-8")

    guides = [GUIDE_BUILDERS[slug](ctx) for slug in GUIDE_SLUGS]
    for g in guides:
        (GUIDE_DIR / f"{g['slug']}.html").write_text(render_guide(ctx, g), encoding="utf-8")
    (GUIDE_DIR / "index.html").write_text(render_guide_index(ctx, guides), encoding="utf-8")

    (ROOT / "sitemap.xml").write_text(render_sitemap(ctx), encoding="utf-8")
    (ROOT / "robots.txt").write_text(render_robots(), encoding="utf-8")
    (ROOT / "llms.txt").write_text(render_llms(ctx), encoding="utf-8")

    n_urls = 63 + 1 + len(GUIDE_SLUGS)
    print(f"생성 완료 — 일주 60개 + 목록 1개 + 가이드 {len(GUIDE_SLUGS)}개 + 목록 1개")
    print(f"sitemap.xml({n_urls} URL) · robots.txt(AI 검색봇 허용) · llms.txt")
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
