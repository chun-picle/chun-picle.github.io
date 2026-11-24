# 월령 (月令) — 2027 정미년 사주 리포트

절기(節氣) 시각까지 계산하는 정밀 만세력으로 사주팔자·오행 균형을 무료로 보여주고,
2027 정미년 재물운·월별 운세·귀인 방위를 프리미엄 리포트로 파는 **개인 수익형 정적 웹 서비스**입니다.
GitHub Pages에서 바로 동작하며 서버·DB·결제 PG 가입 없이도 운영할 수 있습니다.

- 라이브: https://chun-picle.github.io/
- 회사(노보젠) 업무와 무관한 개인 프로젝트입니다.

---

## 1. 구조

```
index.html                서비스 화면 (입력 → 원국 → 무료 결과 → 프리미엄 잠금)
terms.html                이용약관 · 환불정책 · 개인정보 처리
404.html                  없는 페이지
ilju/                     60갑자 일주별 2027 운세 (index.html + 60개 일주 페이지) — 검색 유입용
sitemap.xml               사이트맵 (메인·약관·일주 목록·60개 일주)
robots.txt                크롤러 허용 + 사이트맵 위치
assets/css/style.css      스타일 (모바일 퍼스트, 720px 이상 데스크톱 확장)
assets/js/solar-terms.js  절입 시각 테이블 (KST, 1910~2050, 천문 계산)
assets/js/saju-core.js    만세력 엔진 (사주·오행·십성·지장간·12운성·공망·격국·합충·신살)
assets/js/content.js      해석 콘텐츠 (60갑자 일주, 일간, 오행, 십성, 격국, 신살, 2027 세운, 월운 템플릿)
assets/js/report.js       원국 → 화면용 리포트 (원국 심층 해부·재물 구간·월별 등급·귀인 방위 계산)
assets/js/config.js       ★ 결제 링크·가격·잠금 코드 (여기만 고치면 됨)
assets/js/app.js          화면 로직 (폼·렌더·잠금·공유)
assets/data/gunghap-content.json   ★ 2인 궁합 해석 문안 원본 (수지 확정본)
assets/js/gunghap-content.js      위 JSON의 자동 생성 번들 (fetch 없이 로드)
assets/js/gunghap.js      2인 궁합 계산 엔진 (천간합·지지합·충형파해·오행·십성·용신·2027 흐름)
assets/js/gunghap-ui.js   2인 궁합 화면 (탭·입력·무료 미리보기·잠금·12개월 캘린더·공유)
scripts/build_gunghap_content.py  ★ JSON → gunghap-content.js 번들 생성기
scripts/build_seo.py      ★ 일주 60개 페이지 · sitemap · robots 생성기 (도메인 한 줄로 전체 치환)
tests/test_saju.js        계산 검증 테스트 (116개)
tests/test_gunghap.js     궁합 검증 테스트 (명세서 QA 체크리스트)
tests/run_tests.py        테스트 러너 (quickjs 또는 node)
```

---

## 2. 수금 창구 바꾸는 법 (한 줄)

`assets/js/config.js`만 열면 됩니다.

```js
gumroadUrl: 'https://chuniverse61.gumroad.com/l/wolryeong-2027',   // 결제 페이지
gumroadProductId: '3eMAYhr_WKGgAd4-fUXXvA==',                     // Gumroad 상품 ID (라이선스 검증용)
priceLabel: '4,900원',                          // 판매가 (실제 결제 금액과 같게 유지)
originalPriceLabel: '9,900원',                   // 정가 (잠금 영역·결제 모달에 취소선으로 병기)
discountLabel: '50% 할인',                        // 정가 대비 할인 표시
discountPercent: 50,
accessCodes: [],                                // 수동 판매한 열람 코드 (쉼표로 추가)
maxCodeUses: 3,                                 // 라이선스 키 1개당 인증 횟수 상한
```

- 결제는 Gumroad(`gumroadUrl`)에서 카드·애플페이로 이루어지고, 구매자에게 라이선스 키가 발급됩니다.
  사이트는 입력된 코드를 `https://api.gumroad.com/v2/licenses/verify`에 POST해 검증한 뒤 열어 줍니다
  (`success === true` 이고 환불·차지백이 아닐 때).
- 가격 표시는 `priceLabel`(판매가)과 `originalPriceLabel`(정가)·`discountLabel`(할인율)로 그려집니다.
  가격을 바꿀 때는 이 세 값과 Gumroad 상품 금액을 함께 맞춰 주세요.
- `accessCodes`를 채우면 그 코드만 네트워크 없이 즉시 열립니다(수동 발급용). 비어 있으면 Gumroad 라이선스 키만 통과합니다.
- 링크가 비어 있으면 모달의 버튼이 "준비 중" 상태로 표시됩니다(결제는 일어나지 않음).
- 해제 상태는 이 브라우저에 저장되어 다시 들어와도 잠금이 풀린 상태로 열립니다.
- 예전 데모 코드(`TEST2027`)는 보안 허점 지적으로 제거했습니다. 다시 넣지 마세요.

> ⚠️ 정적 사이트라 코드 검증은 브라우저에서 합니다. Gumroad 라이선스 검증은 상품 ID 기준으로 서버에서 응답하므로
> 코드 목록이 소스에 노출되지 않습니다. `accessCodes`에 수동 코드를 추가하면 그 코드만 소스에서 보입니다.

---

## 3. 계산 엔진 정확도

| 항목 | 방식 |
|---|---|
| 년주 | 입춘(立春) 기준 사주년. `(연도-4) mod 10/12` |
| 월주 | 24절기 중 12절의 **절입 시각(분 단위)** 으로 월이 바뀜 + 오호둔법(五虎遁) |
| 일주 | 율리우스일(JDN) 기반 60갑자 순환. 일진은 자정(00:00) 기준 |
| 시주 | 2시간 단위 시지 + 오자둔법(五鼠遁) |
| 오행 | 천간·지지 8글자(시각 미상이면 6글자) 분포 |
| 부가 | 1987~1988 서머타임 1시간 보정, 지지 충·합·형·파·해, 십성 10종 |

절입 시각은 PyEphem으로 태양 겉보기 황경이 15° 배수가 되는 순간을 풀어 만든 테이블입니다.
한국천문연구원 발표치(2023 입춘 02-04 11:42 / 2024 입춘 02-04 17:27 / 2025 입춘 02-03 23:10 KST)와 일치합니다.

### 검증 실행

```bash
python3 -m pip install quickjs     # 최초 1회
python3 tests/run_tests.py         # 116개 케이스, ALL PASS 확인
# 또는 node tests/test_saju.js
```

주요 케이스 (모두 PASS):

- `1990-03-25 15:30` → **경오 기묘 기축 임신 (기축일주)** · 庚午 己卯 己丑 壬申
- `2000-01-01 12:00` → 기묘 병자 무오 무오
- `1985-08-15 06:00` → 을축 갑신 병술 신묘
- 절입 경계(입춘 20분 전/후, 경칩 30분 전/후), 자시 경계, 시각 미상 6글자, 60갑자 연속 순환
- 외부 만세력 대조: `2026-11-24` → 병오 기해 임인 (일진 임인일과 일치)

---

## 4. 수익 구조

| 구분 | 내용 |
|---|---|
| 무료 | 사주팔자 8글자, 오행 밸런스, 일주 성격, 일간 기질, 2027 정미년 한 줄 총운 |
| 유료 (프리미엄) | ① 원국 지장간·12운성·공망 정밀 표 ② 타고난 격국·십성 구조·겉과 속·4대 궁 해부 ③ 원국 합·충·형·파·해·원진과 신살·귀인 감정 ④ 신강·신약과 용신 처방 ⑤ 10년 대운 ⑥ 2027 4대 영역·12개월·분기 로드맵·귀인 방위 |
| 가격 | config.js `price: 4900` / `priceLabel: '4,900원'` (정가 9,900원에서 50% 할인, 정가는 취소선으로 병기) |
| 결제 | Gumroad (`wolryeong-2027`, 4,900원) — 카드·애플페이, 구매 시 라이선스 키 발급 (1회성 디지털 콘텐츠) |
| 바이럴 | Web Share API 공유 버튼 (iOS 공유 시트) + 클립보드 폴백 |

공유 링크에는 생년월일이 담기지 않습니다. 링크를 연 사람은 자기 사주로 새로 계산됩니다.

### 4-1. 2인 궁합 (같은 페이지의 두 번째 탭, 4,900원)

상단 탭 `2인 궁합`에서 두 사람의 생년월일시와 관계 모드(연인·동업자)를 넣으면 궁합 리포트가 나옵니다.
계산 규칙은 명세서(`wolryeong-gunghap-spec.md`) 2.3·2.4 그대로입니다.

| 축 | 배점 | 가점·감점 (gunghap.js `POINTS`) |
|---|---|---|
| 끌림 | 30 | 기본 15 · 일간 천간합 +10 · 지지 일지 육합 +9 / 삼합 +6 · 그 밖의 지지합 +1(최대 +3) · 천간충 +2 |
| 소통 | 20 | 기본 10 · 오행 상생 +8 / 같은 오행 +5 / 상극 +2 · 십성 식상 +5 · 비견·겁재 +4 |
| 재물 시너지 | 25 | 재물 25 = 정재·편재 관계 + 용신 보완 — 연인 15+10 / 동업 20+5 (`WEALTH_SPLIT`) |
| 안정 | 15 | 기본 15에서 차감 — 일지 충 −5 · 일지 형 −3 · 일지 파/해 −2 · 그 밖의 기둥 −1(최대 −5) · 0점 하한 |
| 2027년 흐름 | 10 | 기본 5 · 2027 정미년과 일간·일지의 합(+3)·삼합(+2)·충(−3)·형·파(−2)·해(−2)를 두 사람에 각각 적용 |

총점은 다 쓴 축 점수의 합(0~100, 정수 내림)으로 `scoreBands` 구간에 넣습니다.
무료는 **총점·구간 타이틀·끌림 축 요약·2027년 좋은 달 1개**이고, 나머지 4개 축·모든 조합 해석·12개월 캘린더·갈등 대처법은 4,900원 라이선스 키로 열립니다(1인 리포트와 같은 키·같은 결제 흐름).
결과·공유 문구에는 두 사람의 생년월일이 들어가지 않으며, 궁합 입력값은 localStorage에도 저장하지 않습니다.

### 4-2. 무료 → 유료 전환 흐름 (v2)

기획서·스펙(`wolryeong-conversion-plan-v2.md`, `wolryeong-calc-screen-spec-v2.md`)의 S0~S5 흐름을 그대로 구현했습니다. 문구는 전부 `gunghap-content.json`의 `funnel` 키에서 온다(코드 하드코딩 금지).

```
S0 랜딩 → S1 무료 1인 진단 → [Gate A] → S2 궁합 입력 → S3 무료 미리보기
                                              └─[Gate B]→ S4 결제(4,900원, Gumroad 키)
                                                            → S5 전체 리포트 → [Gate C] 1인 리포트
S1 하단 링크(4,900원) → 기존 1인 리포트 결제
```

| 지점 | 내용 |
|---|---|
| S1 무료 1인 진단 | 일주·오행 균형·용신 1줄, 오늘의 운세 1줄(당일 일진 3등급), 2027 키워드 1개. 월별·대운·재물 상세는 계산·노출하지 않는다 (`Gunghap.freeReading`) |
| Gate A | 결제 없음. S1의 A 입력을 궁합 입력으로 그대로 넘긴다 (`GunghapUI.prefillA`) |
| Gate B | 미리보기 상단 카드 + 잠금 상자(하단) 2곳. 버튼에 4,900원 명시 |
| Gate C | 궁합 결제 후 하단에서 1인 리포트로. 키 하나로 두 리포트가 함께 열리므로 추가 결제는 없다 |
| 유료 미전송 | 결제 전에는 유료 문구·점수를 DOM에 그리지 않는다. 잠금 영역은 축 이름만 있는 자리표시자(`.lock-skeleton`) |
| 좋은 달 1개 | '좋음' 중 가장 이른 달, 없으면 '보통' 중 가장 이른 달 |
| 소수점 | 모든 축 점수는 내림(floor). 반올림하지 않는다 |

문안을 고칠 때는 `assets/data/gunghap-content.json`을 고치고 번들을 다시 만듭니다.

```bash
python3 scripts/build_gunghap_content.py   # JSON → assets/js/gunghap-content.js
python3 tests/run_tests.py                 # 궁합 QA 체크리스트 포함 전체 테스트
```

---

## 5. 일주 60개 SEO 페이지 (`ilju/`)

검색 유입용 정적 페이지입니다. 60갑자 일주마다 한 편씩, 2027 정미년과의 관계까지 계산해 넣었습니다.

- `ilju/index.html` — 60갑자 목록 (일간 10그룹 + 지지 12그룹)
- `ilju/{slug}.html` — 갑자(`gapja`) ~ 계해(`gyehae`) 60개
- 각 페이지: 고유 title/description·canonical·OG·JSON-LD(Article·BreadcrumbList·FAQPage), 상·하단 CTA(→ `/`),
  같은 일간 5편·같은 지지 4편 내부 링크, 이전/다음 일주

생성은 사이트 엔진을 그대로 불러서 합니다(quickjs로 `saju-core.js`·`content.js`·`report.js` 실행).
그래서 화면의 만세력·십성·지지관계·재물 점수와 항상 같은 규칙입니다.

```bash
python3 scripts/build_seo.py          # 60개 + 목록 + sitemap + robots 생성 후 자체 검증
python3 scripts/build_seo.py --check  # 생성 없이 검증만 (HTML 구조·내부 링크·메타 중복·sitemap 정합성)
```

> 📌 도메인 확정 시 `scripts/build_seo.py`의 `BASE_URL` 한 줄만 실제 도메인으로 바꾸고 다시 실행하면
> 60개 페이지의 canonical·og:url·JSON-LD와 `sitemap.xml`·`robots.txt`가 한 번에 치환됩니다.
> (현재 기본값: `https://wolryeong-saju.vercel.app` — Vercel 프로덕션 도메인)

---

## 6. 배포

정적 파일만 있으므로 `main` 브랜치에 푸시하면 GitHub Pages가 그대로 서빙합니다.

```bash
git add -A && git commit -m "..." && git push origin main
gh api repos/chun-picle/chun-picle.github.io/pages   # 상태 확인
```

`.nojekyll` 파일이 있어 Jekyll 처리를 건너뜁니다.

---

## 6-1. 유입 분석 (Vercel Web Analytics)

Vercel 프로젝트 `wolryeong`(`prj_I83sMtmDhXrqdzfbgj29JnMLy1QH`)의 **Web Analytics**를 켜 두었고,
모든 HTML(`index.html`·`terms.html`·`404.html` + `ilju/` 61개)의 `<head>`에 같은 스니펫이 들어 있습니다.
`ilju/` 쪽은 `scripts/build_seo.py`의 `ANALYTICS` 상수로 생성되므로, 손으로 고치지 말고 생성기를 고친 뒤 재생성하세요.

```html
<script>window.va = window.va || function () { (window.vaq = window.vaq || []).push(arguments); };</script>
<script defer src="/_vercel/insights/script.js"></script>
```

- **자동 집계(무료)**: 페이지뷰·방문자, 유입경로(referrer), 국가, 기기, 페이지 경로.
- **전환 이벤트(커스텀)**: `free_diagnosis`(무료 1인 진단 실행), `gate_a_to_gunghap`(Gate A 궁합 이동),
  `gunghap_free_preview`(궁합 무료 미리보기), `checkout_open`(결제 모달 열기), `checkout_click`(Gumroad 결제 클릭),
  `license_unlocked`(라이선스 키 인증 성공). 호출은 `window.wolryeongTrack(name, data)` 한 줄이며 실패해도 조용히 무시됩니다.
- **Hobby 플랜의 한계**: 커스텀 이벤트는 Pro/Enterprise에서만 수집·조회됩니다(`/v1/query/web-analytics/events/*` → `payment_required`).
  UTM 차원은 Enterprise 또는 Web Analytics Plus 전용입니다.
- **GitHub Pages**(`chun-picle.github.io`)에서는 `/_vercel/insights/script.js`가 404입니다. 콘솔에 리소스 오류만 남고 기능에는 지장이 없습니다.
- 대시보드: https://vercel.com/chun8129-1514/wolryeong/analytics

---

## 7. 알아둘 점

- 입력값은 서버로 전송되지 않습니다. 마지막 입력과 열람 여부만 브라우저 localStorage에 저장됩니다.
- 프리미엄 잠금은 화면상 블러 처리입니다. 정적으로 계산되는 콘텐츠라 소스를 보면 값이 보입니다(위 2번 참고).
- 일주가 자정에 바뀌는 방식이라, 23:00~24:00 출생은 학파에 따라 하루 차이가 날 수 있습니다.
- 음력 생일은 양력으로 변환해 입력해야 합니다.
- `contactEmail`은 문의 전용 메일(`wolryeong.saju@gmail.com`)로 설정되어 푸터·약관·라이선스 초과 안내에 표시됩니다.
- `businessInfo`는 실제 판매 전에 채워 넣어야 합니다(현재 "사업자 정보 준비 중").
  통신판매업 신고가 필요한 경우 대표자 명의로 신고 후 그 번호를 넣으면 됩니다.
