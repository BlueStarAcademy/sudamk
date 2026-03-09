# 길드 보스전 보상 적용 검증

## 1. 보상 흐름 요약

- **클라이언트**: `utils/guildBossSimulator.ts`의 `calculateBossRewards(damage)`로 등급(tier)과 보상 수량 계산 → `result.rewards` 생성 (장비는 `{ grade }`만 포함).
- **서버**: `server/actions/guildActions.ts`의 `START_GUILD_BOSS_BATTLE`에서 `result.rewards`를 기준으로 실제 지급 수행.
- **모달**: `components/guild/GuildBoss.tsx`에서 **서버 응답** `guildBossBattleResult`를 사용해 `GuildBossBattleResultModal`에 전달 (이전 수정으로 모달 = 실제 지급 내용과 일치).

---

## 2. 항목별 서버 지급 및 반영 여부

| 보상 항목 | 서버 지급 코드 | DB/상태 반영 | 클라이언트 반영 |
|-----------|----------------|--------------|-----------------|
| **길드 코인** | `totalGuildCoins = rewards.guildCoins + personalGuildCoins` (딜량 구간별 추가 코인 적용) | `freshUser.guildCoins += totalGuildCoins`, `user.guildCoins` 동기화 | `updatedUser`로 전달 → `setCurrentUser(mergedUser)`, `inventoryCriticalActions`에 포함되어 즉시 반영 |
| **골드** | `freshUser.gold += rewards.gold` | `db.updateUser(freshUser)` | 동일 `updatedUser`에 포함 |
| **길드 경험치** | `guild.xp += rewards.guildXp` | `db.setKV('guilds', guilds)` 후 `broadcast({ type: 'GUILD_UPDATE', payload: { guilds } })` | 응답의 `guilds`로 길드 목록 갱신, `flushSync` 후 길드 정보 갱신 |
| **연구소 포인트** | `guild.researchPoints += rewards.researchPoints` | 동일 (길드 객체에 반영 후 저장·브로드캐스트) | 길드 정보 갱신으로 연구소 포인트 표시 반영 |
| **강화재료** | `getItemTemplateByName(rewards.materials.name)`으로 템플릿 조회 후 `itemsToAdd`에 추가, 수량은 `rewards.materials.quantity` | `addItemsToInventory` → `freshUser.inventory` 갱신 후 `db.updateUser` | `updatedUser.inventory`로 전달, `START_GUILD_BOSS_BATTLE`가 인벤토리 중요 액션으로 등록되어 즉시 반영 |
| **변경권** | `rewards.tickets` 각 항목에 대해 `getItemTemplateByName(ticket.name)` 후 소모품으로 `itemsToAdd`에 추가 | 위와 동일 | 위와 동일 |
| **장비** | `rewards.equipment.grade`만 사용, 슬롯은 서버에서 랜덤 선택 후 `generateNewItem(grade, randomSlot)`로 1개 생성해 `itemsToAdd`에 추가 | 동일 (인벤토리 추가 후 DB 저장) | 동일 + **모달에는 서버가 생성한 동일 장비**가 `result.rewards.equipment`(이름·이미지·슬롯·item)로 표시됨 |

---

## 3. 상세 검증 포인트

### 3.1 아이템 템플릿

- **강화재료**: `GUILD_BOSS_REWARDS_BY_TIER`의 `materials.name`은 `'하급 강화석'` ~ `'신비의 강화석'`.  
  `shared/constants/items.ts`의 `MATERIAL_ITEMS`에 동일 키로 정의되어 있으며, `utils/inventoryUtils.ts`의 `getItemTemplateByName`은 `MATERIAL_TEMPLATE_MAP`(← `MATERIAL_ITEMS`)에서 조회하므로 모두 매칭됨.
- **변경권**: `GUILD_BOSS_TICKET_TYPES`는 `'옵션 종류 변경권'`, `'옵션 수치 변경권'`, `'신화 옵션 변경권'`.  
  `CONSUMABLE_ITEMS`에 동일 이름으로 정의되어 있어 `getItemTemplateByName`으로 조회 가능.

### 3.2 개인 추가 길드 코인

- `GUILD_BOSS_PERSONAL_REWARDS_TIERS`로 딜량 구간별 추가 코인 계산 후 `result.rewards.guildCoins`를 `totalGuildCoins`로 덮어씀.
- 지급은 `totalGuildCoins` 기준으로만 이루어지며, 모달에도 이 덮어쓴 `result.rewards`가 그대로 전달되므로 **표시 = 지급** 일치.

### 3.3 장비

- 서버가 한 번만 `generateNewItem(grade, randomSlot)`로 생성한 아이템을 인벤토리에 넣고, 동일 객체를 `result.rewards.equipment`(및 `.item`)에 넣어 반환.
- 클라이언트는 `guildBossBattleResult`(스프레드로 최상위에 있음)를 읽어 모달에 넘기므로, **모달에 보이는 장비 = 가방에 들어간 장비**.

### 3.4 사용자/길드 동기화

- **사용자**: `freshUser`에 모든 보상 반영 후 `db.updateUser(freshUser)`, `broadcastUserUpdate(freshUser, ['guildCoins', 'gold', 'inventory', ...])`, 응답에 `updatedUser: freshUser` 포함.
- **길드**: `guild.xp`, `guild.researchPoints` 갱신 후 `db.setKV('guilds', guilds)`, `broadcast({ type: 'GUILD_UPDATE', payload: { guilds } })`.
- 클라이언트는 `result.updatedUser`(스프레드로 최상위)를 받아 `applyUserUpdate` 후 `setCurrentUser`로 반영하고, `START_GUILD_BOSS_BATTLE`가 인벤토리 중요 액션 목록에 있어 즉시 UI 갱신됨.

---

## 4. 결론

- **길드 코인, 골드, 길드 경험치, 연구소 포인트, 강화재료, 변경권, 장비** 모두 서버에서 한 번만 계산·지급되며, 그 결과가 DB·브로드캐스트·응답(`updatedUser`, `guildBossBattleResult`, `guilds`)에 일관되게 반영됨.
- 결과 모달은 서버가 반환한 `guildBossBattleResult`를 사용하므로, **모달에 표시된 보상과 실제 적용된 보상(가방·길드·연구소 포인트 등)이 일치**함.
