import React, { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import GuidePanelLayout, { type GuideSelection } from './guide/GuidePanelLayout.js';
import { HELP_CENTER_CATEGORIES } from '../shared/constants/helpCenterContent.js';

/**
 * URL 라우팅으로 접근 가능한 도움말 센터 페이지.
 * - AdSense 크롤러가 직접 접근할 수 있는 실질 콘텐츠 페이지
 * - 비회원(비로그인) 상태에서도 접근 가능
 * - `#/help`, `#/help/{categoryId}`, `#/help/{categoryId}/{subId}` 지원
 */
interface HelpPageProps {
    /** URL 파라미터: 열려있어야 하는 대분류/소분류 */
    initialCategoryId?: string | null;
    initialSubId?: string | null;
}

const HelpPage: React.FC<HelpPageProps> = ({ initialCategoryId, initialSubId }) => {
    const { t } = useTranslation('common');

    const initialSelection = useMemo<GuideSelection | undefined>(() => {
        if (!initialCategoryId) return undefined;
        const cat = HELP_CENTER_CATEGORIES.find((c) => c.id === initialCategoryId);
        if (!cat) return undefined;
        const sub = initialSubId
            ? cat.subcategories.find((s) => s.id === initialSubId)
            : cat.subcategories[0];
        if (!sub) return undefined;
        return { categoryId: cat.id, subId: sub.id };
    }, [initialCategoryId, initialSubId]);

    const handleSelectionChange = useCallback((sel: GuideSelection) => {
        const nextHash = `#/help/${sel.categoryId}/${sel.subId}`;
        if (typeof window !== 'undefined' && window.location.hash !== nextHash) {
            window.history.replaceState(null, '', nextHash);
        }
    }, []);

    return (
        <div className="relative flex min-h-0 w-full flex-1 flex-col overflow-hidden bg-gradient-to-b from-zinc-950 via-zinc-950 to-black">
            <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-3 px-3 py-4 sm:gap-4 sm:px-6 sm:py-6">
                <header className="shrink-0 rounded-xl border border-amber-400/30 bg-black/40 px-4 py-3 shadow-[0_10px_30px_-16px_rgba(251,191,36,0.35)] sm:px-6 sm:py-4">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-amber-200/90">
                        {t('helpCenterEyebrow', { defaultValue: 'Help Center' })}
                    </p>
                    <h1 className="mt-1 text-lg font-bold text-on-panel sm:text-xl">
                        {t('helpCenterTitle', { defaultValue: '수담바둑 도움말 · 게임 가이드' })}
                    </h1>
                    <p className="mt-1 text-xs leading-relaxed text-on-panel/75 sm:text-sm">
                        {t('helpCenterIntro', {
                            defaultValue:
                                '바둑 규칙, 16종 게임 모드, 캐릭터·장비·길드·모험 시스템까지 서비스 전반의 사용 가이드를 확인할 수 있습니다.',
                        })}
                    </p>
                </header>

                <div className="min-h-0 flex-1 overflow-hidden rounded-xl border border-color/40 bg-gradient-to-b from-secondary/30 via-secondary/15 to-transparent shadow-[0_14px_40px_rgba(0,0,0,0.35)]">
                    <GuidePanelLayout
                        initialSelection={initialSelection}
                        onSelectionChange={handleSelectionChange}
                    />
                </div>
            </div>
        </div>
    );
};

export default HelpPage;
