# 스포츠 중계와 응원 채팅

`/sports`에서 경기 선택, HTTPS 동영상/YouTube 재생, 경기별 Firestore 실시간 채팅을 제공합니다. 기존 메뉴 마지막에 스포츠가 추가됩니다. 실제 중계가 미등록된 상태에는 **6개 예시 경기**를 표시하며 실제 LIVE 경기나 가짜 점수·메시지·접속자 수로 표시하지 않습니다.

## 실제 서비스 연결

1. 기존 Firebase 프로젝트의 웹 앱 설정을 환경 설정 또는 Git에서 제외된 `.env.local`에 입력합니다: `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_STORAGE_BUCKET`, `VITE_FIREBASE_MESSAGING_SENDER_ID`, `VITE_FIREBASE_APP_ID`. Vite의 `VITE_*`는 브라우저 번들에 포함되므로 서버 비밀키를 사용하지 않습니다. 개발 서버를 다시 시작합니다.
2. Firebase Authentication에서 Google 제공자를 활성화하고 실제 앱 도메인을 승인합니다. 채팅은 Firebase 인증 상태를 사용하며 새로고침 후에도 로그인 복원을 지원합니다.
3. `docs/sports.firestore.rules`의 `sportsGames` 블록을 기존 프로젝트 규칙에 **병합**합니다. 기존 사용자 문서 규칙을 통째로 교체하지 않습니다. 외부 배포는 이 변경에 포함하지 않습니다. 기존에 광범위한 `allow write: if true` 규칙이 있다면 먼저 제거/축소해야 합니다. Firestore allow 규칙은 OR로 결합됩니다.
4. 신뢰할 수 있는 관리 서버나 Firestore 콘솔에서 `sportsGames/{gameId}` 문서를 최소 6개 등록합니다. 클라이언트는 경기를 생성하거나 점수·중계 주소를 변경할 수 없습니다. 공식 일정/점수 API를 사용하는 서버가 문서를 갱신하면 브라우저의 목록과 점수가 즉시 갱신됩니다. 저장소에는 공식 경기 API와 중계 주소가 제공되지 않아 자동 수집은 포함하지 않았습니다.

예시 문서 구조 (데이터가 아닌 스키마 설명):

```js
{
  order: 1,                 // 필수: 목록 정렬 기준. 조회 최대 50개
  away: '원정팀', home: '홈팀', league: 'KBO', venue: '경기장',
  status: 'live',           // live | scheduled | ended
  awayScore: 0, homeScore: 0, inning: '1회 초',
  streamUrl: 'https://공식-중계-호스트/허가받은-영상.mp4'
}
```

실제로 사용 권한이 있고 외부 재생을 허용하는 HTTPS 중계 주소를 등록해야 합니다. YouTube watch/youtu.be/embed URL과 직접 재생 MP4/WebM, 브라우저가 지원하는 HLS(.m3u8)를 받습니다. HLS는 브라우저 기본 지원에 따르므로 Chrome에서 HLS만 제공하는 중계에는 별도 HLS 플레이어 연동이 필요합니다. DRM, 임의 웹페이지 iframe, 재생 권한 우회는 지원하지 않습니다. YouTube 영상의 임베드 허용·지역 제한은 제공자 정책에 따릅니다. 스트림 호스트와 `www.youtube-nocookie.com`, 필요한 Firebase 프로젝트 인증 도메인을 배포 환경의 CSP/네트워크 정책에 추가합니다. 로그인/중계 동작은 실제 주소와 인증 설정으로 확인해야 합니다.

## 채팅과 접속자

- `sportsGames/{gameId}/messages`: `uid`, `name`, `text`, `createdAt`(서버 타임스탬프). 최신 100개를 실시간 구독해 시간순으로 표시합니다. 공백 메시지와 300자 초과를 차단하며 HTML은 React 텍스트로 렌더링됩니다.
- `sportsGames/{gameId}/viewers/{sessionId}`: `uid`, `lastSeen`(서버 타임스탬프). 각 탭이 30초마다 갱신하고 나갈 때 삭제합니다. 최근 90초 내 로그인한 UID 수를 집계하므로 동일 사용자의 여러 탭은 1명입니다. 비로그인 시청자 전체 수가 아닙니다. 비정상 종료의 기록은 최대 약 120초 후 집계에서 빠집니다.
- 경기 전환·로그아웃 시 구독과 타이머를 해제하며 입력 내용도 새 방으로 전달하지 않습니다. 전송 실패 시 입력을 보존하고 오류를 표시합니다. 서버 연결 확인 전 전송을 막습니다.
- 운영 규모에 맞게 Firestore TTL(lastSeen), 페이지 제한/집계, App Check, 서버 측 속도 제한 및 신고·관리 기능을 추가하세요. 현재 클라이언트와 규칙만으로 채팅 도배를 방지하지는 않습니다.

## 검증

`npm run build`, `npx eslint src/features/sports src/pages/Sports.jsx`, `node --test src/features/sports/games.test.js`.

실제 Firebase 연결 후 서로 다른 두 계정/브라우저로 같은 경기를 선택하여 메시지 양방향 수신, 접속자 집계, 다른 경기와의 분리, 재접속, 비인가/위조 UID/초과 길이 쓰기 거부를 확인하세요. 실제 중계 주소의 재생도 별도 확인이 필요합니다.

### 이번 작업에서 확인한 결과

- 빌드, 새 스포츠 코드 ESLint, 데이터·영상 URL 검증 테스트 3개 통과.
- Chromium에서 스포츠 메뉴의 마지막 위치, 경기 카드 6개, 경기 전환, LIVE 필터, 예시 채팅 전송 비활성화, 런타임 오류 없음 확인.
- 320/390/768/1024/1440px에서 가로 넘침과 헤더 겹침 없음 확인.
- 실제 Firebase 인증·공식 중계 정보가 없어 실제 중계 재생과 사용자 간 채팅은 미검증. Firestore 에뮬레이터 통합 검증도 다운로드 호스트 `storage.googleapis.com` 접근 실패로 실행되지 않았습니다. 작성된 보안 규칙의 실제 적용과 권한 검증은 서비스 연결 후 필요합니다.
