#!/usr/bin/env python3
"""tests/test_saju.js 를 quickjs로 실행하는 러너.

사용: python3 tests/run_tests.py
Node.js가 있으면 `node tests/test_saju.js` 로도 동일하게 실행된다.
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
    os.path.join(BASE, "tests", "test_saju.js"),
]

src = "\n;\n".join(open(f, encoding="utf-8").read() for f in FILES)
ctx = quickjs.Context()
ctx.eval(src)
text = ctx.get("__testText")
fail = ctx.get("__testFail")
if text:
    print(text)
print("\nexit:", "FAIL" if fail else "OK")
sys.exit(1 if fail else 0)
