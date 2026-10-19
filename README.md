# LUKEN WORKSPACE — 통합 업무 시스템

현재는 기존 7개 운영 도구로 연결되는 **시안**입니다. 실제 통합 로그인, 지점별 권한 분리, 실시간 동기화는 아직 구현되지 않았습니다.

## GitHub에 업로드하기
1. `lhd1810-cmyk/luken-workspace` 저장소에서 **Add file → Upload files**를 누릅니다.
2. 이 폴더의 `index.html`, `README.md`를 업로드하고 **Commit changes**를 누릅니다.
3. `schema.sql`은 설계 검토용 파일입니다. 아직 기존 Supabase 프로젝트에서 실행하지 마세요.

## 기존 운영 시스템
- 월드킹: 매출 `worldking-report`, 발주 `worldking-order`, 예약 `worldking-rsv`, 근무 `worldking-wkstaff`
- 헬로방방: 매출 `hellobang-reportv2`, 예약 `hellobang-rve`, 근무 `hellobang-hbstaff`
- 월드킹·헬로방방 홈페이지 메뉴 제외

## 보안
현재 앱은 브라우저 localStorage 기반입니다. 인증이 없으므로 실제 고객/직원/매출 비공개 데이터를 통합 저장하지 마세요. Private GitHub 저장소 자체가 배포된 웹사이트 접근을 제한하지는 않습니다. 추후 Supabase Auth 및 RLS 검증이 필요합니다.
