import React, { type ReactNode } from 'react';

export type MobileGameResultTab = 'match' | 'record';

type MobileResultTabPanelStackProps = {
    active: MobileGameResultTab;
    /** 첫 번째 탭(경기 내용 / 경기 결과) 본문 — 비활성 시에도 레이아웃 높이에 반영됨 */
    matchPanel: ReactNode;
    /** 두 번째 탭(대국 결과 / 기록) 본문 */
    recordPanel: ReactNode;
    className?: string;
};

/**
 * 두 탭을 같은 그리드 셀에 겹쳐 두고, 비활성 탭은 `invisible`로만 숨겨
 * **항상 더 높은 탭의 높이**로 영역이 잡히게 한다 (탭 전환 시 높이 변동 없음).
 */
export const MobileResultTabPanelStack: React.FC<MobileResultTabPanelStackProps> = ({
    active,
    matchPanel,
    recordPanel,
    className = '',
}) => (
    <div className={`grid w-full min-w-0 grid-cols-1 ${className}`.trim()}>
        <div
            className={`col-start-1 row-start-1 min-w-0 ${
                active === 'match' ? 'relative z-[1]' : 'pointer-events-none invisible relative z-0 select-none'
            }`}
            aria-hidden={active !== 'match'}
        >
            {matchPanel}
        </div>
        <div
            className={`col-start-1 row-start-1 min-w-0 ${
                active === 'record' ? 'relative z-[1]' : 'pointer-events-none invisible relative z-0 select-none'
            }`}
            aria-hidden={active !== 'record'}
        >
            {recordPanel}
        </div>
    </div>
);

type MobileEqualHeightTabPanelItem = { tabKey: string; panel: ReactNode };

/** 임의 개수 탭 — 활성 탭만 보이되, 영역 높이는 **모든 탭 콘텐츠 중 최대**로 고정 */
export const MobileEqualHeightTabPanels: React.FC<{
    activeTabKey: string;
    items: MobileEqualHeightTabPanelItem[];
    className?: string;
    /** 부모가 flex 등으로 높이를 준 경우: 한 줄을 꽉 채워 `h-full` 자식(랭킹 보드 등)이 맞게 스크롤되게 함 */
    fillParentHeight?: boolean;
}> = ({ activeTabKey, items, className = '', fillParentHeight = false }) => (
    <div
        className={`grid w-full min-w-0 grid-cols-1 ${fillParentHeight ? 'min-h-0 [grid-template-rows:minmax(0,1fr)]' : ''} ${className}`.trim()}
    >
        {items.map(({ tabKey, panel }) => (
            <div
                key={tabKey}
                className={`col-start-1 row-start-1 min-w-0 ${fillParentHeight ? 'min-h-0 h-full max-h-full overflow-hidden' : ''} ${
                    activeTabKey === tabKey
                        ? 'relative z-[1]'
                        : 'pointer-events-none invisible relative z-0 select-none'
                }`}
                aria-hidden={activeTabKey !== tabKey}
            >
                {panel}
            </div>
        ))}
    </div>
);

type MobileGameResultTabBarProps = {
    active: MobileGameResultTab;
    onChange: (tab: MobileGameResultTab) => void;
    matchLabel?: string;
    recordLabel?: string;
    className?: string;
};

/** 모바일 경기 결과: 경기 내용 ↔ 기록/보상 전환 */
export const MobileGameResultTabBar: React.FC<MobileGameResultTabBarProps> = ({
    active,
    onChange,
    matchLabel = '경기 내용',
    recordLabel = '대국 결과',
    className = '',
}) => (
    <div
        className={`flex w-full shrink-0 gap-1 rounded-lg border border-amber-500/35 bg-slate-950/80 p-1 ring-1 ring-inset ring-amber-500/12 ${className}`}
        role="tablist"
        aria-label="결과 탭"
    >
        <button
            type="button"
            role="tab"
            aria-selected={active === 'match'}
            className={`min-h-[2.25rem] flex-1 rounded-md px-2 py-1.5 text-center text-[11px] font-bold uppercase tracking-[0.08em] transition-colors sm:text-xs ${
                active === 'match'
                    ? 'border border-amber-400/40 bg-amber-500/20 text-amber-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]'
                    : 'border border-transparent text-slate-500 hover:text-slate-300'
            }`}
            onClick={() => onChange('match')}
        >
            {matchLabel}
        </button>
        <button
            type="button"
            role="tab"
            aria-selected={active === 'record'}
            className={`min-h-[2.25rem] flex-1 rounded-md px-2 py-1.5 text-center text-[11px] font-bold uppercase tracking-[0.1em] transition-colors sm:text-xs ${
                active === 'record'
                    ? 'border border-violet-400/35 bg-violet-500/18 text-violet-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]'
                    : 'border border-transparent text-slate-500 hover:text-slate-300'
            }`}
            onClick={() => onChange('record')}
        >
            {recordLabel}
        </button>
    </div>
);
