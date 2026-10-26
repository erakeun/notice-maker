# 출력 회귀 검사

도트 기능 검사는 같은 로컬 서버에서 `npm run test:dots`로 실행합니다.
하냥이 41 / 하이비비 24 포즈의 원본 이름·선택·비율, 썸네일 지연 로드,
문자 포즈 반전 안내, 크기·위치·반전의 탭 종료 후 복원, 작업파일 왕복,
기존 작업파일 호환, 실제 PNG/PDF/인쇄 문서, 가로로 긴 포즈의 세로 출력을
검사합니다. 결과는 `test-results/dots/`에 저장합니다. 분석 통신은 차단합니다.

외부 CDN 또는 로컬 포트 접근이 제한된 환경에서는 선택적으로
`TEST_LOCAL_FILES=1`을 설정합니다. 이 모드는 같은 HTTP origin과 브라우저
저장소를 유지하면서 로컬 파일을 Playwright로 제공하고, 외부 폰트 대신
설치된 대체 글꼴을 사용합니다. 앱의 고정 버전 CDN 스크립트
`html2canvas@1.4.1/dist/html2canvas.min.js`,
`jspdf@2.5.1/dist/jspdf.umd.min.js`를 각각
`test-results/vendor/html2canvas.min.js`,
`test-results/vendor/jspdf.umd.min.js`에 미리 받아야 합니다.
이 테스트 설정은 앱 코드의 CDN 경로를 변경하지 않습니다.

정적 앱을 로컬 서버로 연 뒤 Chromium에서 검사합니다.

```sh
npm ci
npx playwright install chromium
python3 -m http.server 8765 --bind 127.0.0.1
# 별도 터미널
npm test
```

다른 주소는 `BASE_URL=http://127.0.0.1:포트 npm test`로 지정합니다.
가상 데이터만 사용하며 PDF, PNG, 작업파일, 결과 JSON은 Git에서 제외된
`test-results/`에 저장합니다. 운영 사이트를 대상으로 실행하지 마세요.

검사 범위: 본문 빈 여백, 투명 PNG 테두리, 3px 경미한 접촉, 실제 큰 겹침과
페이지 잘림 차단, 수정 위치 이동, 강조문 15/26/60px 미리보기·자동저장,
작업파일 왕복, 기존 형식 기본값과 잘못된 크기 경계값, 가로·세로 출력,
긴 문구 넘침, 인쇄 전용 문서 생성.

2026-10-22 수동 확인: iMac Chrome의 인쇄 버튼으로 가로·세로 모두
인쇄 미리보기 한 페이지를 확인했습니다. Chrome에서 저장한 PDF도
PDFKit으로 A4 가로 한 페이지임을 확인했습니다.
앱의 가로·세로 PDF와 15/60px PDF를 렌더링해 글자와 캐릭터 잘림이 없는지 확인했습니다.
실물 프린터 인쇄와 Safari/Firefox는 검사하지 않았습니다.

기존 V1.7.0과 같은 배치 비교에서는 짧은 본문 오른쪽에 캐릭터를 둔 경우
빈 여백만 겹쳐도 30% 충돌로 출력이 차단됐고, 수정본은 정상으로 판정했습니다.
원본 피드백의 정확한 편집 상태 파일은 없어 스크린샷의 배치값 전체를
동일하게 복원한 검사는 아닙니다.
