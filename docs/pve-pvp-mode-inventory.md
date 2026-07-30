# PVE / PVP mode inventory (정리 · 축소 아님)

로비에서 모드를 숨기지 않는다. 디버깅 우선순위와 실시간 비용만 분류한다.

## 등급

| 등급 | 의미 | 모드 / 베뉴 |
|------|------|-------------|
| 안정 | 턴·보드 동기화 단순 | Standard, Capture, Speed, Castle, Omok, Ttamok |
| 주의 | 페이즈·마스킹·시계 많음 → 버그 감시 우선 | Base, Uniform, Hidden, Missile |
| 고위험 | 듀얼턴·물리·다단계 → 디버깅 비용 큼 | Chess, Mix, Dice, Thief, Alkkagi, Curling |
| PVE 전용 | `matchAxis: pve` 베뉴 (인간 PVP 아님) | Adventure, Tower, SinglePlayer, GuildWar (+ AI lobby) |

## 축 정리

- **GameMode**: 규칙 변형 (16종)
- **ArenaKind / gameCategory**: 베뉴
- **matchAxis**: `pvp` | `pve` | `mixed_pair` — [liveSessionArenaKind.ts](../shared/utils/liveSessionArenaKind.ts)

인간 1v1 랭킹 허용(참고): Standard, Capture, Speed, Base, Hidden, Missile, Uniform, Castle — Chess/Mix/playful ranked 제외. 캐주얼은 SPECIAL/PLAYFUL 전체(admin availability).

랭킹 Hidden 캡: `hiddenStoneCount: 1`, `scanCount: 1` ([rankedGameSettings](../shared/constants/rankedGameSettings.ts)). 캐주얼 Hidden 기본·협상은 별도.

## 노출 축소

보류. BR 레지스터에서 재발률·수정 비용 증거가 쌓인 뒤에만 별도 제품 결정.
