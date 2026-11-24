#!/usr/bin/env python3
"""궁합 해석 콘텐츠 JSON → assets/js/gunghap-content.js 번들 생성.

원본은 assets/data/gunghap-content.json (수지가 확정한 최종 문안).
브라우저는 fetch 대신 이 번들을 읽으므로 로컬 파일·GitHub Pages·Vercel 어디서도
404·CORS 없이 동작한다.

사용: python3 scripts/build_gunghap_content.py
"""
import json
import os

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(BASE, "assets", "data", "gunghap-content.json")
OUT = os.path.join(BASE, "assets", "js", "gunghap-content.js")

HEADER = """/* ============================================================
 * 월령 · 궁합 해석 콘텐츠 (gunghap-content.js)
 *  - 자동 생성 파일: scripts/build_gunghap_content.py
 *  - 원본: assets/data/gunghap-content.json
 *  - 문구는 전부 최종 문안이므로 손으로 고치지 말고 JSON을 고친 뒤 재생성한다.
 * ============================================================ */
"""


def main():
    with open(SRC, encoding="utf-8") as f:
        data = json.load(f)

    body = json.dumps(data, ensure_ascii=False, indent=1)
    js = (
        HEADER
        + "(function (root) {\n"
        + "  'use strict';\n\n"
        + "  var CONTENT = " + body + ";\n\n"
        + "  root.GUNGHAP_CONTENT = CONTENT;\n"
        + "  if (typeof module !== 'undefined' && module.exports) module.exports = CONTENT;\n"
        + "})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));\n"
    )
    with open(OUT, "w", encoding="utf-8") as f:
        f.write(js)
    print("wrote %s (%d bytes, %d keys)" % (OUT, len(js.encode("utf-8")), len(data)))


if __name__ == "__main__":
    main()
