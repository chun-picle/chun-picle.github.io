#!/usr/bin/env python3
"""tests/test_saju.js · tests/test_gunghap.js 를 quickjs로 실행하는 러너.

사용: python3 tests/run_tests.py
Node.js가 있으면 `node tests/test_saju.js` 로도 동일하게 실행된다.

엔진 테스트(만세력·신강/신약·대운·12개월 심화·2인 궁합)와 함께,
잠금 코드 보안 설정과 궁합 무료/유료 경계가 파일에 실제로 배선됐는지도
정적으로 검사한다.
"""
import os
import sys

try:
    import quickjs
except ImportError:
    sys.exit("quickjs 모듈이 필요합니다: pip install quickjs")

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

ENGINE_FILES = [
    os.path.join(BASE, "assets", "js", "solar-terms.js"),
    os.path.join(BASE, "assets", "js", "saju-core.js"),
    os.path.join(BASE, "assets", "js", "content.js"),
    os.path.join(BASE, "assets", "js", "config.js"),
    os.path.join(BASE, "assets", "js", "report.js"),
    os.path.join(BASE, "assets", "js", "concern.js"),
    os.path.join(BASE, "assets", "js", "calendar365.js"),
    os.path.join(BASE, "assets", "js", "printdoc.js"),
    os.path.join(BASE, "assets", "js", "gunghap-content.js"),
    os.path.join(BASE, "assets", "js", "gunghap.js"),
]

fail = 0


def run_js_suite(label, test_file, text_var, fail_var):
    """엔진 + 테스트 파일을 한 컨텍스트에서 실행하고 결과를 출력한다."""
    global fail
    src = "\n;\n".join(
        [open(f, encoding="utf-8").read() for f in ENGINE_FILES]
        + [open(test_file, encoding="utf-8").read()]
    )
    ctx = quickjs.Context()
    try:
        ctx.eval(src)
    except Exception as exc:  # noqa: BLE001 - 엔진 예외는 그대로 보고
        print("== %s ==" % label)
        print("FAIL | 실행 예외 | %s" % exc)
        fail += 1
        return

    text = ctx.get(text_var)
    f = ctx.get(fail_var)
    print("== %s ==" % label)
    if text:
        print(text)
    print("")
    fail += int(f or 0)


def check_file(label, rel, must_have, must_not_have=()):
    global fail
    path = os.path.join(BASE, rel)
    body = open(path, encoding="utf-8").read()
    ok = True
    for token in must_have:
        if token not in body:
            ok = False
            static_lines.append("FAIL | %s | '%s' 가 없습니다" % (label, token))
    for token in must_not_have:
        if token in body:
            ok = False
            static_lines.append("FAIL | %s | '%s' 가 남아 있습니다" % (label, token))
    if ok:
        static_lines.append("PASS | %s" % label)
    else:
        fail += 1


static_lines = []

run_js_suite("1인 리포트 엔진 (test_saju.js)",
             os.path.join(BASE, "tests", "test_saju.js"), "__testText", "__testFail")
run_js_suite("2인 궁합 엔진 (test_gunghap.js)",
             os.path.join(BASE, "tests", "test_gunghap.js"), "__ghText", "__ghFail")
run_js_suite("v3 고민처방·365일캘린더·PDF (test_v3.js)",
             os.path.join(BASE, "tests", "test_v3.js"), "__v3Text", "__v3Fail")


# 잠금 코드 보안: 데모 코드 흔적 제거 + 사용 횟수 제한 배선
check_file("config.js 데모 코드 제거", "assets/js/config.js",
           ["demoCode: ''", "accessCodes: []", "maxCodeUses: 3"], ["TEST2027"])
check_file("app.js 사용 횟수 제한", "assets/js/app.js",
           ["increment_uses_count=true", "maxCodeUses", "최대 사용 횟수"], ["TEST2027"])
check_file("index.html 데모 코드 안내 제거", "index.html",
           ["라이선스 키", "내 사주 원국 정밀 해부", "wongukTable", "gyeokName", "relList", "sinsalGrid"],
           ["TEST2027", "데모 코드"])
check_file("app.js 원국 심층 렌더", "assets/js/app.js",
           ["renderWonguk", "renderGyeok", "renderRelations"])
check_file("report.js 원국 심층 생성", "assets/js/report.js",
           ["buildWonguk", "wonguk: wonguk"])
check_file("saju-core.js 원국 심층 엔진", "assets/js/saju-core.js",
           ["JANGAN", "unsung", "gongmang", "gyeokguk", "scanRelations", "scanSinsal"])
check_file("style.css 원국 심층 스타일", "assets/css/style.css",
           [".wk-table", ".palace-grid", ".sinsal-grid", ".rel-badge"])

# 2인 궁합: 무료/유료 경계 배선 + 문구 하드코딩 방지
check_file("index.html 궁합 입력·미리보기·잠금", "index.html",
           ["ghForm", "ghResult", "ghScore", "ghBand", "ghAttraction", "ghGoodMonthCard",
            "ghPremium", "ghLock", "ghUnlockBtn", "ghMonths", "ghAdvice", "ghShareBtn",
            "gunghap-content.js", "gunghap.js", "gunghap-ui.js", "시각을 몰라요"])
check_file("gunghap.js 축·산식", "assets/js/gunghap.js",
           ["attraction: 30", "communication: 20", "wealth: 25", "stability: 15", "flow2027: 10",
            "freePreview", "PAID_AXES", "MONTH_JI", "isSamhap"])
check_file("gunghap-ui.js 무료/유료 배선", "assets/js/gunghap-ui.js",
           ["freePreview", "applyLock", "is-locked", "wolryeong:unlocked", "openUnlockModal",
            "GUNGHAP_CONTENT"])
check_file("gunghap-content.js 문구 번들", "assets/js/gunghap-content.js",
           ["GUNGHAP_CONTENT", "재물 상승 동맹", "monthlySynergy2027", "conflictAdvice", "moneyPrescription"])
check_file("궁합 스타일", "assets/css/style.css",
           [".modetabs", ".gh-axes", ".gh-month", ".pill.good", ".gh-score"])

# v2 전환 흐름: 무료 1인 진단 → Gate A → 무료 미리보기 → Gate B → Gate C
check_file("index.html v2 전환 흐름 배선", "index.html",
           ["freeReading", "frIlju", "frBalance", "frYongsin", "frToday", "frKeyword",
            "gateA", "gateABtn", "soloReportLink", "ghGateTop", "ghGateTopBtn",
            "ghGateBottomText", "ghCrossSellBtn", "premiumSkeleton", "ghSkeleton",
            "무료로 내 재물 사주 보기"])
check_file("app.js 무료 진단·유료 지연 렌더", "assets/js/app.js",
           ["renderFreeReading", "applyFunnelCopy", "soloReportLink",
            "wolryeong:unlocked", "if (state.unlocked) renderPremium(rep)"])
check_file("gunghap.js v2 산식·무료 진단", "assets/js/gunghap.js",
           ["WEALTH_SPLIT", "lover: { jae: 15, yongsin: 10 }",
            "business: { jae: 20, yongsin: 5 }", "freeReading", "bestGoodMonth",
            "todayFortune", "keyword2027", "Math.floor(clamp"])
check_file("gunghap-ui.js 게이트·유료 지연 렌더", "assets/js/gunghap-ui.js",
           ["prefillA", "ghGateTopBtn", "ghCrossSellBtn", "renderSkeleton", "renderPaid",
            "ghGateBottomText"])
check_file("gunghap-content.js funnel 번들", "assets/js/gunghap-content.js",
           ["funnel", "첫 장을 열어봤어요", "총점은 봤어요", "가장 좋은 달 1개만 봤어요",
            "구매에 포함 · 나의 2027년 리포트 바로 보기"])
check_file("v2 스타일", "assets/css/style.css",
           [".fr-keyword", ".gate-card", ".lock-skeleton", ".premium.is-locked .lock-skeleton"])
check_file("콘텐츠 빌드 스크립트", "scripts/build_gunghap_content.py",
           ["assets/data/gunghap-content.json", "gunghap-content.js"])

# Vercel Web Analytics: 전 페이지 삽입 + 핵심 전환 이벤트 배선
check_file("index.html Vercel Analytics", "index.html",
           ["/_vercel/insights/script.js", "window.va", "window.wolryeongTrack"])
check_file("terms.html Vercel Analytics", "terms.html",
           ["/_vercel/insights/script.js", "window.wolryeongTrack"])
check_file("일주 페이지 Vercel Analytics", "ilju/gapja.html",
           ["/_vercel/insights/script.js"])
check_file("SEO 생성기 Vercel Analytics", "scripts/build_seo.py",
           ["ANALYTICS", "/_vercel/insights/script.js"])
check_file("app.js 전환 이벤트", "assets/js/app.js",
           ["free_diagnosis", "checkout_open", "checkout_click", "license_unlocked",
            "typeof window.wolryeongTrack === 'function'"])
check_file("gunghap-ui.js 전환 이벤트", "assets/js/gunghap-ui.js",
           ["gate_a_to_gunghap", "gunghap_free_preview"])

# 무료 오픈 모드 (2026-11-25): config 토글로 잠금/오픈을 갈아 끼운다
check_file("config.js 무료 오픈 토글", "assets/js/config.js",
           ["freeOpen: true", "freeOpen: false", "maxCodeUses: 3", "priceLabel: '4,900원'",
            "gumroadVerifyUrl"])
check_file("app.js 무료 오픈 배선", "assets/js/app.js",
           ["function isFreeOpen()", "state.unlocked = isFreeOpen() || paidUnlocked",
            "unlocked: paidUnlocked", "is-free-open", "isFreeOpen() || state.unlocked",
            "verifyGumroad"],
           ["demoCode: 'TEST2027'"])
check_file("gunghap-ui.js 무료 오픈 배선", "assets/js/gunghap-ui.js",
           ["function isFreeOpen()", "state.unlocked = isFreeOpen() || savedUnlocked()",
            "is-free-open", "isFreeOpen() ? true : !state.unlocked", "openUnlockModal"])
check_file("style.css 무료 오픈 숨김 규칙", "assets/css/style.css",
           ["html.is-free-open .section-title .tag", "html.is-free-open .premium .lock",
            "html.is-free-open .lock-skeleton", "html.is-free-open .gate-b",
            "html.is-free-open #ghCrossSell", ".free-open-note"])
check_file("index.html 무료 오픈 안내", "index.html",
           ["free-open-note", "오픈 기념", "리포트 전체 무료", "궁합 전체 무료"])
check_file("terms.html 무료 기간 안내", "terms.html",
           ["오픈 기념 기간", "모든 리포트를 무료"])

# v3(2026-11-28): 고민 맞춤 처방 · 365일 캘린더 · PDF 소장용
check_file("index.html v3 배선", "index.html",
           ["concernSelect", "concernSection", "concernBody", "cal365Section", "cal365Grid",
            "cal365Title", "cal365Prev", "cal365Next", "cal365Day", "icsBtn", "pdfBtn", "printDoc",
            "concern.js", "calendar365.js", "printdoc.js", "2027 재물운 캘린더(.ics) 저장", "PDF 소장용 저장"])
check_file("index.html 고민 선택지 7개", "index.html",
           ['value="all"', 'value="startup"', 'value="growth"', 'value="job"',
            'value="invest"', 'value="realestate"', 'value="debt"'])
check_file("app.js v3 렌더·다운로드·인쇄", "assets/js/app.js",
           ["renderConcern", "renderCalendar", "renderPrintDoc", "Calendar365.ics", "text/calendar",
            "ics_download", "print_pdf", "beforeprint", "window.print()", "concern_select"])
check_file("concern.js 고민 분기", "assets/js/concern.js",
           ["var LIST", "BANK", "function build(", "moves", "traps", "timing", "startup", "realestate", "debt"])
check_file("calendar365.js 365일·ics", "assets/js/calendar365.js",
           ["function dayInfo", "function build", "function ics", "RFC", "BEGIN:VCALENDAR", "\\r\\n",
            "GOOD_MIN", "CARE_MAX", "function fold", "VERSION:2.0", "DTSTART;VALUE=DATE:"])
check_file("printdoc.js 소장용 문서", "assets/js/printdoc.js",
           ["사주 명식표", "지금 고민 맞춤 처방", "4대 재물 영역", "12개월", "365일", "pd-doc"])
check_file("style.css v3·인쇄 A4", "assets/css/style.css",
           [".cn-head", ".cal365-grid", ".cal365-cell.is-good", "@media print", "@page",
            "break-inside: avoid", "#printDoc { display: block !important", ".pd-doc"])

# GEO/AI 검색 최적화: llms.txt · robots.txt · 구조화 데이터
check_file("llms.txt AI 검색 요약", "llms.txt",
           ["# 월령", "https://wolryeong-saju.vercel.app/guide/", "365일", ".ics",
            "2027 정미년", "자주 묻는 질문", "robots.txt"])
check_file("robots.txt AI 봇 허용", "robots.txt",
           ["User-agent: Googlebot", "User-agent: Yeti", "User-agent: OAI-SearchBot",
            "User-agent: ChatGPT-User", "User-agent: GPTBot", "User-agent: PerplexityBot",
            "User-agent: ClaudeBot", "User-agent: Google-Extended",
            "Sitemap: https://wolryeong-saju.vercel.app/sitemap.xml", "llms.txt"])
check_file("index.html 구조화 데이터", "index.html",
           ['"@type": "WebApplication"', '"@type": "FAQPage"', '"@type": "Organization"',
            '"price": "0"', "priceCurrency", "href=\"guide/\""])
check_file("build_seo.py 가이드·llms 생성", "scripts/build_seo.py",
           ["GUIDE_SLUGS", "def render_guide(", "def render_guide_index(", "def render_llms(",
            "def render_robots(", "llms.txt", "guide_url(slug)"])
for _slug, _label in [("changup-saup-saju", "창업"), ("budongsan-bangwi-oheng", "부동산"),
                      ("don-gunghap", "돈 궁합"), ("2027-jeongminyeon", "2027")]:
    check_file("guide/%s.html 구조화 데이터" % _slug, "guide/%s.html" % _slug,
               ['"@type": "Article"', '"@type": "FAQPage"', '"@type": "BreadcrumbList"',
                'rel="canonical"', 'property="og:title"', _label])
check_file("guide/index.html 목록", "guide/index.html",
           ["g-index-grid", "changup-saup-saju.html", "budongsan-bangwi-oheng.html",
            "don-gunghap.html", "2027-jeongminyeon.html"])

# sitemap에 가이드 5개 URL이 모두 들어갔는지
_sm = open(os.path.join(BASE, "sitemap.xml"), encoding="utf-8").read()
_locs = _sm.count("<loc>")
if _locs == 68:
    static_lines.append("PASS | sitemap.xml 68 URL (가이드 5개 포함)")
else:
    static_lines.append("FAIL | sitemap.xml URL 수: %d" % _locs)
    fail += 1
for _slug in ["changup-saup-saju", "budongsan-bangwi-oheng", "don-gunghap", "2027-jeongminyeon"]:
    if "/guide/%s.html" % _slug in _sm:
        static_lines.append("PASS | sitemap 가이드 URL %s" % _slug)
    else:
        static_lines.append("FAIL | sitemap 가이드 URL 누락 %s" % _slug)
        fail += 1

# config.js를 그대로 실행해 freeOpen 값이 실제로 true인지 확인
free_ctx = quickjs.Context()
free_ctx.eval(
    open(os.path.join(BASE, "assets", "js", "config.js"), encoding="utf-8").read()
    + "\n;var __freeOpen = (typeof CONFIG !== 'undefined' && CONFIG.freeOpen === true);"
)
if free_ctx.get("__freeOpen"):
    static_lines.append("PASS | config.js freeOpen 값 = true (무료 오픈 상태)")
else:
    static_lines.append("FAIL | config.js freeOpen 값이 true가 아닙니다")
    fail += 1

if static_lines:
    print("== 정적 검사 ==")
    print("\n".join(static_lines))
print("\nexit:", "FAIL" if fail else "OK")
sys.exit(1 if fail else 0)
