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
           ["GUNGHAP_CONTENT", "천생연분", "monthlySynergy2027", "conflictAdvice"])
check_file("궁합 스타일", "assets/css/style.css",
           [".modetabs", ".gh-axes", ".gh-month", ".pill.good", ".gh-score"])

# v2 전환 흐름: 무료 1인 진단 → Gate A → 무료 미리보기 → Gate B → Gate C
check_file("index.html v2 전환 흐름 배선", "index.html",
           ["freeReading", "frIlju", "frBalance", "frYongsin", "frToday", "frKeyword",
            "gateA", "gateABtn", "soloReportLink", "ghGateTop", "ghGateTopBtn",
            "ghGateBottomText", "ghCrossSellBtn", "premiumSkeleton", "ghSkeleton",
            "무료로 내 운세 보기"])
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
