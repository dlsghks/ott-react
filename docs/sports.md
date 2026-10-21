# 실제 야구 라이브와 방송별 채팅

메인 메뉴 마지막의 **스포츠** → `/sports`. 기존 React/Vite 라우터·녹색/검정 디자인·Firebase Google 로그인·Zustand 인증 작업을 재사용합니다. 영화·시리즈 등 기존 라우트는 유지합니다. 예시 경기 목록은 제거했습니다. 실제 라이브 검색이 실패하거나 결과가 없으면 빈 목록과 정확한 사유를 표시합니다.

## 데이터 출처와 확인 범위

사용 소스는 **YouTube Data API v3**입니다. 이번 작업에서는 Google 공식 [`googleapis/google-api-nodejs-client`의 YouTube discovery 스키마](https://raw.githubusercontent.com/googleapis/google-api-nodejs-client/main/discovery/youtube-v3.json)를 실제로 다운로드해 아래 옵션과 필드를 확인했습니다.

- `search.list`: `q=야구|baseball`(OR), `type=video`, `eventType=live`, `videoEmbeddable=true`, `order=viewCount`, `maxResults=50`. 페이지를 최대 3개 조회하고 영상 ID를 중복 제거합니다. 한도에 도달하면 UI에 일부 결과가 누락될 수 있다고 표시합니다. ‘전체’는 이 검색에서 검증된 전체 결과이며 전 세계 모든 중계 목록을 의미하지 않습니다.
- `videos.list`: `part=snippet,status,liveStreamingDetails`. `privacyStatus=public`, `embeddable=true`, `liveBroadcastContent=live`, 실제 `actualStartTime` 존재, `actualEndTime` 미존재 조건을 모두 확인합니다. 삭제·미공개·시작 전·종료 방송은 표시하지 않습니다.
- 제목·태그에서 명확한 게임/시뮬레이션/하이라이트/다시보기/해설/분석/입중계/라이브 스코어/리액션/소프트볼 등을 제외하고 야구 관련성도 확인합니다. 메타데이터 필터이므로 모든 영상의 실제 내용이나 중계권을 직접 확인한 것은 아닙니다. 불분명한 영상이 남을 가능성이 있습니다.
- 동시 시청자 수는 `liveStreamingDetails.concurrentViewers`만 사용합니다. 일반 누적 조회 수(`statistics.viewCount`)를 동시 시청자 수로 쓰지 않습니다. 미제공 값은 ‘시청자 수 비공개’로 표시하며 순위에서 제외합니다. 제공된 실제 숫자로 인기 TOP 5를 정렬하며 5개보다 적으면 있는 개수만 표시합니다.
- WBSC 필터는 `channels.list(forHandle=@WBSC)`로 정확한 핸들의 채널 ID를 조회한 뒤 `search.list.channelId`와 결과 채널 ID를 모두 확인합니다. 표시 이름만 WBSC인 다른 채널을 신뢰하지 않습니다. WBSC의 소프트볼/게임 방송에도 같은 제외 필터를 적용합니다. 이번 환경에서는 WBSC 사이트와 YouTube 페이지 접근이 403으로 차단되어 **공식 사이트의 채널 링크와 운영 API의 핸들 응답은 독립 검증하지 못했습니다**. 배포 전 아래 공식 사이트의 YouTube 링크와 `@WBSC` 일치를 확인해야 합니다.

공식 참고 링크: [search.list](https://developers.google.com/youtube/v3/docs/search/list), [videos.list](https://developers.google.com/youtube/v3/docs/videos/list), [channels.list](https://developers.google.com/youtube/v3/docs/channels/list), [WBSC](https://www.wbsc.org/en), [WBSC YouTube 핸들](https://www.youtube.com/@WBSC). 이 중 개발자 문서 웹페이지와 WBSC 페이지는 이번 환경에서 접근이 차단되었고, 위 Google 공식 저장소의 스키마만 실제로 읽었습니다.

## 캐시·갱신·플레이어

- 탭의 메모리에 필터별 **5분 캐시**를 저장하며 동시 조회는 하나로 합칩니다. 5분마다 갱신하고 탭 복귀 시 캐시가 만료되었으면 다시 조회합니다. API 키는 캐시/URL/로그에 저장하지 않고 `X-Goog-Api-Key` 헤더로 보냅니다.
- 새로고침·다른 탭·다른 사용자는 별도 캐시입니다. 다수 접속자의 쿼터를 공유하려면 서버 측 공용 캐시/API 프록시가 필요합니다. 현 구현은 정적 Vite 앱에 맞춘 브라우저 직접 조회이며 운영 규모에 따라 검색 페이지 수·갱신 간격·프로젝트 할당량을 조정해야 합니다.
- 조회 중, 결과 없음, 키 누락, 권한/활성화/리퍼러 제한, 쿼터 초과, 네트워크 오류를 구분합니다. API 오류 응답의 원문이나 키를 화면·로그에 내보내지 않습니다.
- 영상 선택은 영상 ID와 채팅방을 함께 전환합니다. YouTube IFrame API/`youtube-nocookie.com` 플레이어를 쓰며 원본 영상 링크도 제공합니다. 자동재생을 강제하지 않습니다.
- 선택 방송은 60초마다 `videos.list`로 재확인합니다. 실제 종료·비공개 전환을 구분하고 플레이어 종료/오류 이벤트도 안내합니다. 전체 목록/순위는 마지막 확인 시점 기준 5분 캐시이므로 갱신 전 종료된 항목이 잠시 남을 수 있습니다.
- 임베드 허용 메타데이터가 있어도 지역·연령·권리·제공자 정책으로 재생이 제한될 수 있습니다. 실제 영상의 재생 시작은 별도로 확인해야 합니다. iframe 생성이나 API 성공을 재생 성공으로 간주하지 않습니다.

## 안전한 설정

`.env.example`에는 **빈 이름만** 있습니다. 안전한 환경 설정 또는 Git에서 제외된 `.env.local`에 실제 값을 넣고 Vite를 재시작/재빌드합니다. 키를 대화·로그·Git에 붙여 넣지 않습니다.

| 이름                                                                                                     | 필요한 작업                                                                               |
| -------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| `VITE_YOUTUBE_API_KEY`                                                                                   | 실제 YouTube 검색/채널 확인/라이브 검증. Google Cloud에서 YouTube Data API v3 활성화 필요 |
| `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_APP_ID` | 기존 Firebase 앱 초기화, Google 로그인, Firestore 채팅                                    |
| `VITE_FIREBASE_STORAGE_BUCKET`, `VITE_FIREBASE_MESSAGING_SENDER_ID`                                      | 기존 Firebase 웹 앱 설정 유지                                                             |
| `VITE_TMDB_API_KEY`                                                                                      | 기존 영화 기능. 스포츠 검색과는 별개                                                      |

Vite의 `VITE_*`는 **브라우저에 공개되는 설정**입니다. 서버 비밀키를 넣지 마세요. YouTube 키는 YouTube Data API v3와 실제 배포 도메인의 HTTP 리퍼러로 제한합니다. Firebase API 키는 공개 웹 앱 설정이며 Firestore 규칙·Firebase 승인 도메인으로 보호해야 합니다. 프록시에서만 치환되는 비밀값 플레이스홀더는 브라우저 호출용 실제 키를 대신하지 못합니다.

이번 실행 머신에는 위 실제 값이 없었습니다. 클라우드 환경의 초안 요구사항은 존재하지만 값이 주입된 증거는 없습니다. 배포 서비스의 빌드 환경에도 별도로 실제 값을 설정해야 합니다. 설정 없는 빌드는 성공할 수 있지만 라이브와 채팅이 동작하는 배포는 아닙니다.

## 인증·실시간 채팅·규칙

기존 `useAuthStore.onGoogleLogin`을 호출하며 기존 Firebase Auth 상태를 구독합니다. 채팅도 기존 Google 제공자를 사용합니다. 로그인은 Firebase Authentication에서 Google 활성화 및 실제 배포 도메인 승인이 필요합니다.

- `sportsRooms/{youtubeVideoId}/messages`: `uid`, `name`, `text`, `createdAt` 서버 타임스탬프. `onSnapshot(orderBy(createdAt, desc), limit(100))`로 최신 100개를 시간순 표시합니다. 1~300자, 공백 전송 금지, 전송 중 중복 입력 방지, 실패 안내/입력 보존, 서버 연결 전 전송 금지를 적용합니다.
- `sportsRooms/{youtubeVideoId}/viewers/{sessionId}`: 탭마다 30초 heartbeat. 최근 90초 안에 갱신한 **로그인 사용자 UID**를 중복 제거합니다. 비로그인 시청자 전체 수나 YouTube 동시 시청자 수와는 다릅니다. 강제 종료 시 최대 약 120초 후 집계에서 빠집니다.
- 영상 전환/로그아웃/화면 이탈 시 구독과 타이머를 정리합니다. 채팅 입력도 다른 방송으로 전달하지 않습니다. 메시지는 HTML로 해석하지 않습니다.
- 새 규칙은 `docs/sports-live.firestore.rules`입니다. **`sportsRooms` 블록만 기존 프로젝트 규칙에 추가**하세요. 기존 `users`/기존 `sportsGames` 및 다른 규칙은 교체하지 않습니다. 이전 `docs/sports.firestore.rules` 파일도 보존했습니다.
- 규칙은 인증 여부, 영상 ID 형식, 발신 UID 일치, 허용 필드, 문자열 길이/공백, 서버 타임스탬프를 확인하고 메시지 수정·삭제 및 다른 사용자 presence 조작을 거부합니다. 실제 YouTube 영상 여부를 규칙 자체가 검증하지는 않습니다.
- 기존 광범위 `allow write: if true` 규칙이 있으면 OR 결합으로 보호가 무력화됩니다. 운영 규칙을 먼저 읽고 해당 부분을 좁힌 뒤 병합해야 합니다. 기존 프로젝트 접근 권한이 없어 **운영 규칙 병합/배포는 수행하지 않았습니다**.
- 운영 도배 방지에는 App Check/서버 측 속도 제한/신고·관리 기능, 오래된 presence 문서에는 TTL 등 별도 운영 구성이 필요합니다.

## 실행과 재현 가능한 검증

기존 `/workspace/ott-react` 체크아웃을 사용합니다. 별도 worktree는 필요하지 않습니다. 검증한 런타임은 Node.js 24입니다.

```sh
npm ci --cache /workspace/.npm --no-audit --no-fund
npm run dev -- --host 0.0.0.0 --port 5173 --strictPort
npm run build
npx eslint src/pages/Sports.jsx src/features/sports src/store/useAuthStore.js tests/sports.browser.test.js tests/sports.firestore.test.js
npm run test:sports
npm run test:sports:browser
```

브라우저 테스트는 Vite 개발 서버가 먼저 실행 중이어야 합니다. `SPORTS_BASE_URL`(기본 `http://127.0.0.1:5173`)과 `CHROMIUM_PATH`(기본 `/usr/bin/chromium`)를 지정할 수 있습니다. 테스트용 API/플레이어 대역은 테스트 코드 안에서만 주입하며 운영 환경이나 Git에 가짜 키를 설정하지 않습니다.

Firestore 통합 테스트는 **데모 프로젝트 에뮬레이터 전용**이며 실제 운영 데이터에 연결하지 않습니다. Java 21과 에뮬레이터 다운로드가 필요합니다.

```sh
FIREBASE_EMULATORS_PATH=/tmp/ott-sports-cache \
XDG_CONFIG_HOME=/tmp/ott-sports-config \
npm run test:sports:emulator
```

`tests/sports.firestore.test.js`는 두 인증 사용자의 메시지 실시간 수신/양방향 데이터, 영상별 격리, 비인증·위조 UID·초과 길이·공백·추가 필드·위조 시간·메시지 수정/삭제·타인 presence 수정/삭제 거부를 검사합니다. 기존 운영 규칙과의 병합 안전성까지 증명하는 테스트는 아닙니다.

### 이번 작업의 검증 기록

- **로컬 실제 앱**: 설정 누락 안내, 예시 경기 없음, `/sports` 직접 접속·새로고침, 메뉴 위치 확인.
- **모의 데이터 단위 테스트 9개**: 라이브 조건, 제외 필터, 실제 수치 정렬/비공개 처리, API 검색 옵션과 재검증, 5분 캐시/중복 요청, WBSC 채널 ID, 오류 분류, 페이지 제한, 종료/삭제 상태 통과.
- **Chromium 브라우저 테스트 5개**: 실제 앱의 키 누락 상태 + 모의 API/플레이어로 TOP 5/전체 6개/5개 미만 개수/필터/영상 선택/원본 링크/빈 결과/권한/할당량 안내 확인. 320/390/768/1024/1440px 화면 넘침과 헤더 겹침 없음. **모의 플레이어 테스트는 실제 재생 검증이 아닙니다. 가상 시계로 5분 자동 갱신과 플레이어 종료 이벤트 안내도 확인했습니다.**
- **에뮬레이터**: 다운로드 호스트 `storage.googleapis.com` 접근 실패로 실행 차단. 두 사용자 송수신/보안 규칙 테스트는 작성했으나 통과했다고 주장하지 않습니다.
- **운영 API**: 키가 없으며 무키 조회는 HTTP 403으로 거부됨. 실제 라이브 목록과 WBSC 운영 응답은 미검증입니다.
- **운영 영상/채팅**: 실제 영상 재생·두 계정 운영 채팅·운영 규칙은 설정/접근 미확보로 미검증입니다.

## 기존 Vercel 배포

GitHub 저장소 공개 홈페이지 링크에서 기존 사이트 `https://ott-react-eta.vercel.app`를 확인했습니다. 새 프로젝트는 만들지 않습니다. `vercel.json`은 `/sports` 등 SPA 경로를 `/index.html`로 rewrite하여 직접 접속·새로고침을 지원하고 정적 자산 요청은 유지합니다.

기존 프로젝트에 Vite 환경변수를 입력하고 Git 연동의 production branch가 `main`인지 확인해야 합니다. `main` 푸시는 연동이 활성화되어 있으면 배포를 촉발할 수 있지만 **성공한 운영 배포의 증거는 아닙니다**. 이 환경에서는 Vercel 토큰/로컬 프로젝트 연결 파일이 없고 Vercel 사이트·GitHub API 요청도 네트워크에서 차단되었고 Chromium은 외부 사이트 TLS 신뢰 오류로 접속하지 못해 배포 성공 여부를 확인할 수 없었습니다.

접근이 열리면 Vercel의 새 커밋 Production 배포가 Ready인지 확인하고 `/sports` 직접 접속·새로고침 HTTP 200, 렌더링, 실제 API, 원본 영상과 앱 내 재생, 두 계정 채팅/격리를 각각 검사해야 합니다. 이 체크리스트 완료 전에는 운영 기능 완료로 보고하지 않습니다.

필요한 네트워크 대상: `www.googleapis.com`, `www.youtube.com`, `www.youtube-nocookie.com`, `i.ytimg.com`, 스트림용 `*.googlevideo.com`, Firebase 인증/Firestore 대상 및 실제 프로젝트 인증 도메인. 조사/검증에는 `developers.google.com`, `www.wbsc.org`, `storage.googleapis.com`, `api.github.com`, `ott-react-eta.vercel.app` 접근도 필요합니다. TLS·체크섬 검증은 끄지 않습니다.
