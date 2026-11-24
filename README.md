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
assets/js/saju-core.js    만세력 계산 엔진 (년주·월주·일주·시주·오행·십성·지지관계)
assets/js/content.js      해석 콘텐츠 (60갑자 일주, 일간, 오행, 십성, 2027 세운, 월운 템플릿)
assets/js/report.js       원국 → 화면용 리포트 (재물 구간·월별 등급·귀인 방위 계산)
assets/js/config.js       ★ 결제 링크·가격·잠금 코드 (여기만 고치면 됨)
assets/js/app.js          화면 로직 (폼·렌더·잠금·공유)
scripts/build_seo.py      ★ 일주 60개 페이지 · sitemap · robots 생성기 (도메인 한 줄로 전체 치환)
tests/test_saju.js        계산 검증 테스트 (25개)
tests/run_tests.py        테스트 러너 (quickjs 또는 node)
```

---

## 2. 수금 창구 바꾸는 법 (한 줄)

`assets/js/config.js`만 열면 됩니다.

```js
gumroadUrl: 'https://chuniverse61.gumroad.com/l/wolryeong-2027',   // 결제 페이지
gumroadProductId: '3eMAYhr_WKGgAd4-fUXXvA==',                     // Gumroad 상품 ID (라이선스 검증용)
priceLabel: '9,900원',
accessCodes: ['TEST2027', 'A7F2K9'],           // 수동 판매한 열람 코드 (쉼표로 추가)
```

- 결제는 Gumroad(`gumroadUrl`)에서 카드·애플페이로 이루어지고, 구매자에게 라이선스 키가 발급됩니다.
  사이트는 입력된 코드를 `https://api.gumroad.com/v2/licenses/verify`에 POST해 검증한 뒤 열어 줍니다
  (`success === true` 이고 환불·차지백이 아닐 때).
- `accessCodes`·데모 코드는 네트워크 없이 즉시 열립니다(수동 발급·테스트용).
- 링크가 비어 있으면 모달의 버튼이 "준비 중" 상태로 표시됩니다(결제는 일어나지 않음).
- 해제 상태는 이 브라우저에 저장되어 다시 들어와도 잠금이 풀린 상태로 열립니다.
- 데모 코드 `TEST2027`은 누구나 전체 리포트를 체험할 수 있게 남겨둔 코드입니다.
  실제 판매를 시작할 때는 `accessCodes`에서 빼는 것이 좋지만, 체험용으로 남겨도 수금에는 영향이 없습니다.

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
python3 tests/run_tests.py         # 25개 케이스, ALL PASS 확인
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
| 유료 (프리미엄) | 2027 재물운·투자 타이밍(공격/방어 구간), 1~12월 상세 운세(5단계 등급), 피해야 할 달, 귀인 방위, 십성 구조 |
| 가격 | config.js `price: 9900` |
| 결제 | Gumroad (`wolryeong-2027`, 9,900원) — 카드·애플페이, 구매 시 라이선스 키 발급 (1회성 디지털 콘텐츠) |
| 바이럴 | Web Share API 공유 버튼 (iOS 공유 시트) + 클립보드 폴백 |

공유 링크에는 생년월일이 담기지 않습니다. 링크를 연 사람은 자기 사주로 새로 계산됩니다.

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

## 7. 알아둘 점

- 입력값은 서버로 전송되지 않습니다. 마지막 입력과 열람 여부만 브라우저 localStorage에 저장됩니다.
- 프리미엄 잠금은 화면상 블러 처리입니다. 정적으로 계산되는 콘텐츠라 소스를 보면 값이 보입니다(위 2번 참고).
- 일주가 자정에 바뀌는 방식이라, 23:00~24:00 출생은 학파에 따라 하루 차이가 날 수 있습니다.
- 음력 생일은 양력으로 변환해 입력해야 합니다.
- `businessInfo`, `contactEmail`은 실제 판매 전에 채워 넣어야 합니다(현재 "준비 중").
  통신판매업 신고가 필요한 경우 대표자 명의로 신고 후 그 번호를 넣으면 됩니다.
