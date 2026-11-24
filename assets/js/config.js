/* ============================================================
 * 월령 · 설정 파일  (여기 한 줄만 바꾸면 결제 창구가 바뀝니다)
 * ============================================================ */
var CONFIG = {
  /* 브랜드 */
  brand: '월령',
  brandHan: '月令',
  tagline: '절기로 읽는 사주 리포트',

  /* ---- 수금 창구 (여기에 링크를 붙여넣으면 바로 활성화) ---- */
  /* 예) 토스 송금 링크: https://toss.me/아이디
     예) 카카오페이 송금 링크: https://qr.kakaopay.com/XXXXXXXX    */
  tossUrl: '',        // ← 토스 송금 링크
  kakaoUrl: '',       // ← 카카오페이 송금 링크
  payNote: '결제 후 받은 코드를 입력하면 이 기기에서 계속 열람할 수 있습니다.',

  /* 가격 */
  price: 9900,
  priceLabel: '9,900원',
  anchorLabel: '커피 두 잔 값',

  /* ---- 잠금 해제 코드 ---- */
  /* 데모 코드: TEST2027 (누구나 전체 리포트를 체험) */
  demoCode: 'TEST2027',
  accessCodes: ['TEST2027'],   // 판매한 코드를 여기에 추가 (쉼표로 구분)

  /* ---- 계산 옵션 ---- */
  applyKoreanDST: true,        // 1987~1988 서머타임 1시간 보정
  serviceYear: 2027,

  /* ---- 문의 (비워두면 화면에서 숨김) ---- */
  contactEmail: '',            // 예: 'hello@example.com'
  businessInfo: '사업자 정보 준비 중'  // 상호·대표·사업자등록번호·통신판매업 신고번호
};

if (typeof window !== 'undefined') { window.CONFIG = CONFIG; }
if (typeof module !== 'undefined' && module.exports) { module.exports = CONFIG; }
