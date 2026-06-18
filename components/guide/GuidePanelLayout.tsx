import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useIsHandheldDevice } from '../../hooks/useIsMobileLayout.js';
import { HELP_CENTER_CATEGORIES, type HelpCategory } from '../../shared/constants/helpCenterContent.js';
import { HelpArticlePanel } from './HelpArticleViews.js';

export type GuideSelection = { categoryId: string; subId: string };

export type GuidePanelLayoutProps = {
    /** 표시할 대분류 id만 (없으면 전체) */
    categoryFilter?: string[];
    /** 목차 앞에 붙일 추가 대분류 (게임 모드 규칙 등) */
    extraCategories?: HelpCategory[];
    initialSelection?: GuideSelection;
    onSelectionChange?: (sel: GuideSelection) => void;
    footer?: React.ReactNode;
};

type MobilePane = 'list' | 'detail';

const navButtonClass = (active: boolean) =>
    `w-full rounded-lg px-3 py-2.5 text-left text-[13px] font-medium transition-all sm:text-sm ${
        active
            ? 'border border-amber-500/35 bg-gradient-to-r from-amber-500/20 via-amber-600/10 to-transparent text-amber-50 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]'
            : 'border border-transparent text-slate-400 hover:border-white/10 hover:bg-white/5 hover:text-slate-200'
    }`;

const GuidePanelLayout: React.FC<GuidePanelLayoutProps> = ({
    categoryFilter,
    extraCategories,
    initialSelection,
    onSelectionChange,
    footer,
}) => {
    const { t } = useTranslation('common');
    const handheld = useIsHandheldDevice(768);

    const visibleCategories = useMemo(() => {
        const base = categoryFilter?.length
            ? HELP_CENTER_CATEGORIES.filter((c) => categoryFilter.includes(c.id))
            : HELP_CENTER_CATEGORIES;
        const extra = extraCategories ?? [];
        if (!extra.length) return base;
        const extraIds = new Set(extra.map((c) => c.id));
        return [...extra, ...base.filter((c) => !extraIds.has(c.id))];
    }, [categoryFilter, extraCategories]);

    const defaultSel = useMemo((): GuideSelection => {
        if (initialSelection) {
            const cat = visibleCategories.find((c) => c.id === initialSelection.categoryId);
            if (cat?.subcategories.some((s) => s.id === initialSelection.subId)) {
                return initialSelection;
            }
        }
        const first = visibleCategories[0];
        const sub = first?.subcategories[0];
        if (!first || !sub) return { categoryId: 'start', subId: 'start-home' };
        return { categoryId: first.id, subId: sub.id };
    }, [initialSelection, visibleCategories]);

    const [categoryId, setCategoryId] = useState(defaultSel.categoryId);
    const [subId, setSubId] = useState(defaultSel.subId);
    const [mobilePane, setMobilePane] = useState<MobilePane>('list');

    useEffect(() => {
        setCategoryId(defaultSel.categoryId);
        setSubId(defaultSel.subId);
    }, [defaultSel.categoryId, defaultSel.subId]);

    const selectedArticle = useMemo(() => {
        const cat = visibleCategories.find((c) => c.id === categoryId);
        const sub = cat?.subcategories.find((s) => s.id === subId);
        return sub?.article ?? null;
    }, [visibleCategories, categoryId, subId]);

    useEffect(() => {
        if (!selectedArticle && visibleCategories.length > 0) {
            const first = visibleCategories[0]!;
            const sub = first.subcategories[0];
            if (sub) {
                setCategoryId(first.id);
                setSubId(sub.id);
            }
        }
    }, [selectedArticle, visibleCategories]);

    useEffect(() => {
        onSelectionChange?.({ categoryId, subId });
    }, [categoryId, subId, onSelectionChange]);

    const openArticle = useCallback(
        (cat: HelpCategory, subIdToOpen: string) => {
            setCategoryId(cat.id);
            setSubId(subIdToOpen);
            if (handheld) setMobilePane('detail');
        },
        [handheld],
    );

    const renderNav = () => (
        <nav className="min-h-0 flex-1 space-y-1 overflow-y-auto overscroll-contain pr-0.5" aria-label={t('guidePanel.navAria')}>
            {visibleCategories.map((cat) => (
                <div key={cat.id} className="mb-3 last:mb-0">
                    <div
                        className={`mb-1.5 flex items-center gap-2 rounded-lg px-2 py-1.5 ${
                            cat.accentClass ? `bg-gradient-to-r ${cat.accentClass}` : 'bg-white/5'
                        }`}
                    >
                        {cat.iconSrc && (
                            <span className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-md bg-black/30 ring-1 ring-white/10">
                                <img src={cat.iconSrc} alt="" className="h-6 w-6 object-contain" loading="lazy" />
                            </span>
                        )}
                        <span className="text-xs font-bold uppercase tracking-wider text-amber-200/90">{cat.label}</span>
                    </div>
                    <ul className="space-y-0.5 border-l border-white/10 pl-3">
                        {cat.subcategories.map((sub) => {
                            const active = categoryId === cat.id && subId === sub.id;
                            return (
                                <li key={sub.id}>
                                    <button
                                        type="button"
                                        onClick={() => openArticle(cat, sub.id)}
                                        className={navButtonClass(active)}
                                    >
                                        {sub.label}
                                    </button>
                                </li>
                            );
                        })}
                    </ul>
                </div>
            ))}
        </nav>
    );

    return (
        <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden bg-gradient-to-br from-slate-950 via-slate-900 to-black">
            {!handheld && (
                <div className="flex min-h-0 flex-1">
                    <aside className="flex min-h-0 w-[min(34%,320px)] max-w-[320px] shrink-0 flex-col overflow-hidden border-r border-white/10 bg-black/25 px-3 py-4 backdrop-blur-sm">
                        <p className="mb-3 shrink-0 px-1 text-[11px] font-semibold uppercase tracking-widest text-slate-500">
                            {t('guidePanel.toc')}
                        </p>
                        {renderNav()}
                    </aside>
                    <section className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
                        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-5 sm:px-6">
                            {selectedArticle ? (
                                <HelpArticlePanel article={selectedArticle} />
                            ) : (
                                <p className="text-center text-slate-500">{t('guidePanel.selectItem')}</p>
                            )}
                        </div>
                        {footer ? (
                            <div className="shrink-0 border-t border-white/10 bg-black/30 px-4 py-3 sm:px-6">{footer}</div>
                        ) : null}
                    </section>
                </div>
            )}

            {handheld && mobilePane === 'list' && (
                <div className="flex min-h-0 flex-1 flex-col overflow-hidden px-3 py-3">
                    <p className="mb-2 shrink-0 px-1 text-center text-xs text-slate-500">
                        {t('guidePanel.mobileHint')}
                    </p>
                    <div className="min-h-0 flex-1 overflow-hidden">{renderNav()}</div>
                    {footer ? <div className="mt-2 shrink-0 border-t border-white/10 pt-3">{footer}</div> : null}
                </div>
            )}

            {handheld && mobilePane === 'detail' && (
                <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
                    <div className="flex shrink-0 items-center gap-2 border-b border-white/10 bg-black/30 px-2 py-2 backdrop-blur-md">
                        <button
                            type="button"
                            onClick={() => setMobilePane('list')}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm font-semibold text-amber-100 transition hover:bg-white/10 active:scale-[0.98]"
                        >
                            <span className="text-lg leading-none" aria-hidden>
                                ←
                            </span>
                            {t('guidePanel.list')}
                        </button>
                        <span className="min-w-0 flex-1 truncate text-center text-xs font-medium text-slate-400">
                            {selectedArticle?.title ?? t('guidePanel.defaultTitle')}
                        </span>
                        <span className="w-[4.5rem]" aria-hidden />
                    </div>
                    <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4">
                        {selectedArticle ? (
                            <HelpArticlePanel article={selectedArticle} />
                        ) : (
                            <p className="text-center text-slate-500">{t('guidePanel.noItems')}</p>
                        )}
                    </div>
                    {footer ? (
                        <div className="shrink-0 border-t border-white/10 bg-black/30 px-4 py-3">{footer}</div>
                    ) : null}
                </div>
            )}
        </div>
    );
};

export default GuidePanelLayout;
