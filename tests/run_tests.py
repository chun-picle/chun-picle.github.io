#!/usr/bin/env python3
"""tests/test_saju.js 를 quickjs로 실행하는 러너.

사용: python3 tests/run_tests.py
Node.js가 있으면 `node tests/test_saju.js` 로도 동일하게 실행된다.

엔진 테스트(만세력·신강/신약·대운·12개월 심화)와 함께, 잠금 코드 보안 설정이
파일에서 실제로 제거됐는지도 정적으로 검사한다.
"""
import os
import sys

try:
    import quickjs
except ImportError:
    sys.exit("quickjs 모듈이 필요합니다: pip install quickjs")

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FILES = [
    os.path.join(BASE, "assets", "js", "solar-terms.js"),
    os.path.join(BASE, "assets", "js", "saju-core.js"),
    os.path.join(BASE, "assets", "js", "content.js"),
    os.path.join(BASE, "assets", "js", "config.js"),
    os.path.join(BASE, "assets", "js", "report.js"),
    os.path.join(BASE, "tests", "test_saju.js"),
]

src = "\n;\n".join(open(f, encoding="utf-8").read() for f in FILES)
ctx = quickjs.Context()
ctx.eval(src)
text = ctx.get("__testText")
fail = ctx.get("__testFail")

static_lines = []


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


# 잠금 코드 보안: 데모 코드 흔적 제거 + 사용 횟수 제한 배선
check_file("config.js 데모 코드 제거", "assets/js/config.js",
           ["demoCode: ''", "accessCodes: []", "maxCodeUses: 3"], ["TEST2027"])
check_file("app.js 사용 횟수 제한", "assets/js/app.js",
           ["increment_uses_count=true", "maxCodeUses", "최대 사용 횟수"], ["TEST2027"])
check_file("index.html 데모 코드 안내 제거", "index.html",
           ["라이선스 키"], ["TEST2027", "데모 코드"])

if text:
    print(text)
if static_lines:
    print("")
    print("== 잠금 코드 정적 검사 ==")
    print("\n".join(static_lines))
print("\nexit:", "FAIL" if fail else "OK")
sys.exit(1 if fail else 0)
