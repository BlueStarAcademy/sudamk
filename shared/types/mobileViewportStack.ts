import type { GameMode, GameRecord, InventoryItem, UserWithStatus } from '../../types.js';
import type { QuickUtilityPanelKind } from './quickUtilityPanel.js';

export type MobileViewportEntry =
    | { type: 'quickUtility'; kind: QuickUtilityPanelKind }
    | {
          type: 'itemDetail';
          item: InventoryItem;
          isOwnedByCurrentUser: boolean;
          hideEnhanceActions?: boolean;
      }
    | { type: 'gameRecordViewer'; record: GameRecord }
    | { type: 'settings' }
    | { type: 'mailbox' }
    | { type: 'profileEdit' }
    | { type: 'statAllocation' }
    | { type: 'userProfile'; user: UserWithStatus }
    | {
          type: 'pastRankings';
          info: { user: UserWithStatus; mode: GameMode | 'strategic' | 'pair' | 'unified' };
      }
    | { type: 'equipmentEffects' }
    | { type: 'blacksmithEffects' }
    | { type: 'chatQuick' }
    | { type: 'actionPoint' };

export type MobileViewportEntryType = MobileViewportEntry['type'];

export const MOBILE_VIEWPORT_ENTRY_TITLES: Record<MobileViewportEntryType, string> = {
    quickUtility: '',
    itemDetail: '아이템 상세',
    gameRecordViewer: '기보',
    settings: '설정',
    mailbox: '우편함',
    profileEdit: '프로필 편집',
    statAllocation: '스탯 배분',
    userProfile: '유저 프로필',
    pastRankings: '과거 랭킹',
    equipmentEffects: '장비 효과',
    blacksmithEffects: '대장간 효과',
    chatQuick: '채팅',
    actionPoint: '행동력 충전',
};
