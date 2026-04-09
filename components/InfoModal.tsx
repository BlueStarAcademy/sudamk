import React, { useCallback, useEffect, useMemo, useState } from 'react';
import DraggableWindow from './DraggableWindow.js';
import { useIsHandheldDevice } from '../hooks/useIsMobileLayout.js';
import {
    HELP_CENTER_CATEGORIES,
    getDefaultHelpSelection,
    type HelpArticle,
    type HelpBlock,
    type HelpCategory,
} from '../shared/constants/helpCenterContent.js';

interface InfoModalProps {
    onClose: () => void;
    isTopmost?: boolean;
}

function HelpBlockView({ block }: { block: HelpBlock }) {
    switch (block.type) {
        case 'heading': {
            const Tag = block.level === 3 ? 'h4' : 'h3';
            const cls =
                block.level === 3
                    ? 'mt-5 mb-2 text-sm font-semibold tracking-wide text-amber-200/95'
                    : 'mt-6 mb-2 text-base font-bold text-amber-100';
            return <Tag className={cls}>{block.text}</Tag>;
        }
        case 'paragraph':
            return <p className="text-[13px] leading-relaxed text-slate-300/95 sm:text-sm">{block.text}</p>;
        case 'bullets':
            return (
                <ul className="mt-2 list-none space-y-2.5 text-[13px] leading-relaxed text-slate-300/95 sm:text-sm">
                    {block.items.map((item, i) => (
                        <li key={i} className="flex gap-2.5">
                            <span
                                className="mt-2 h-1 w-1 shrink-0 rounded-full bg-amber-400/80 shadow-[0_0_6px_rgba(251,191,36,0.5)]"
                                aria-hidden
                            />
                            <span>{item}</span>
                        </li>
                    ))}
                </ul>
            );
        case 'callout': {
            const tone =
                block.tone === 'warn'
                    ? 'border-red-500/30 bg-red-950/35 text-red-100/95'
                    : block.tone === 'tip'
                      ? 'border-emerald-500/25 bg-emerald-950/30 text-emerald-50/95'
                      : 'border-sky-500/25 bg-sky-950/25 text-sky-50/95';
            return (
                <div className={`mt-4 rounded-xl border px-4 py-3 text-[13px] leading-relaxed shadow-inner sm:text-sm ${tone}`}>
                    {block.title && <p className="mb-1.5 font-semibold text-current">{block.title}</p>}
                    <p className="text-slate-200/90">{block.text}</p>
                </div>
            );
        }
        case 'imageRow':
            return (
                <div
                    className={`mt-4 flex flex-wrap gap-3 ${block.compact ? 'justify-start' : 'justify-center sm:justify-start'}`}
                >
                    {block.images.map((img, i) => (
                        <figure
                            key={`${img.src}-${i}`}
                            className="flex w-[4.5rem] flex-col items-center gap-1.5 sm:w-[5.25rem]"
                        >
                            <div className="relative aspect-square w-full overflow-hidden rounded-lg ring-1 ring-white/10 shadow-[0_8px_24px_rgba(0,0,0,0.45)]">
                                <img src={img.src} alt={img.alt} className="h-full w-full object-cover" loading="lazy" decoding="async" />
                            </div>
                            {img.caption && (
                                <figcaption className="line-clamp-2 text-center text-[10px] font-medium text-slate-400 sm:text-[11px]">
                                    {img.caption}
                                </figcaption>
                            )}
                        </figure>
                    ))}
                </div>
            );
        case 'figure':
            return (
                <figure className="mt-4 overflow-hidden rounded-xl ring-1 ring-white/10 shadow-[0_12px_40px_rgba(0,0,0,0.5)]">
                    <img src={block.src} alt={block.alt} className="max-h-56 w-full object-cover object-center sm:max-h-64" loading="lazy" />
                    {block.caption && (
                        <figcaption className="border-t border-white/10 bg-black/40 px-3 py-2 text-center text-xs text-slate-400">
                            {block.caption}
                        </figcaption>
                    )}
                </figure>
            );
        default:
            return null;
    }
}

function HelpArticlePanel({ article }: { article: HelpArticle }) {
    return (
        <article className="min-h-0">
            {article.hero && (
                <div className="relative mb-5 overflow-hidden rounded-2xl ring-1 ring-amber-500/20 shadow-[0_20px_50px_rgba(0,0,0,0.55)]">
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/40 to-transparent" />
                    <img
                        src={article.hero.src}
                        alt={article.hero.alt}
                        className="h-44 w-full object-cover object-center sm:h-52"
                        loading="lazy"
                        decoding="async"
                    />
                    <div className="absolute bottom-0 left-0 right-0 p-4 sm:p-5">
                        <h2 className="text-xl font-bold tracking-tight text-white drop-shadow-md sm:text-2xl">{article.title}</h2>
                        {article.tagline && (
                            <p className="mt-1.5 max-w-2xl text-sm text-amber-100/90 drop-shadow">{article.tagline}</p>
                        )}
                    </div>
                </div>
            )}
            {!article.hero && (
                <header className="mb-5 border-b border-white/10 pb-4">
                    <h2 className="text-xl font-bold tracking-tight text-amber-100 sm:text-2xl">{article.title}</h2>
                    {article.tagline && <p className="mt-2 text-sm text-slate-400">{article.tagline}</p>}
                </header>
            )}
            <div className="space-y-1 pb-2">
                {article.blocks.map((b, i) => (
                    <HelpBlockView key={i} block={b} />
                ))}
            </div>
        </article>
    );
}

type MobilePane = 'list' | 'detail';

const InfoModal: React.FC<InfoModalProps> = ({ onClose, isTopmost }) => {
    const handheld = useIsHandheldDevice(768);
    const defaultSel = useMemo(() => getDefaultHelpSelection(), []);
    const [categoryId, setCategoryId] = useState(defaultSel.categoryId);
    const [subId, setSubId] = useState(defaultSel.subId);
    const [mobilePane, setMobilePane] = useState<MobilePane>('list');

    const selectedArticle = useMemo(() => {
        const cat = HELP_CENTER_CATEGORIES.find((c) => c.id === categoryId);
        const sub = cat?.subcategories.find((s) => s.id === subId);
        return sub?.article ?? null;
    }, [categoryId, subId]);

    useEffect(() => {
        if (!selectedArticle && HELP_CENTER_CATEGORIES.length > 0) {
            const d = getDefaultHelpSelection();
            setCategoryId(d.categoryId);
            setSubId(d.subId);
        }
    }, [selectedArticle]);

    const openArticle = useCallback((cat: HelpCategory, subIdToOpen: string) => {
        setCategoryId(cat.id);
        setSubId(subIdToOpen);
        if (handheld) setMobilePane('detail');
    }, [handheld]);

    const goBackMobile = useCallback(() => {
        setMobilePane('list');
    }, []);

    const navButtonClass = (active: boolean) =>
        `w-full rounded-lg px-3 py-2.5 text-left text-[13px] font-medium transition-all sm:text-sm ${
            active
                ? 'border border-amber-500/35 bg-gradient-to-r from-amber-500/20 via-amber-600/10 to-transparent text-amber-50 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]'
                : 'border border-transparent text-slate-400 hover:border-white/10 hover:bg-white/5 hover:text-slate-200'
        }`;

    const renderNav = (opts: { forMobileList?: boolean }) => (
        <nav
            className={`flex min-h-0 flex-col gap-1 overflow-y-auto overscroll-contain pr-1 ${opts.forMobileList ? 'pb-2' : ''}`}
            aria-label="도움말 목록"
        >
            {HELP_CENTER_CATEGORIES.map((cat) => (
                <div key={cat.id} className="mb-3 last:mb-0">
                    <div
                        className={`mb-1.5 flex items-center gap-2 rounded-lg px-2 py-1.5 ${
                            cat.accentClass ? `bg-gradient-to-r ${cat.accentClass}` : 'bg-white/5'
                        }`}
                    >
                        {cat.iconSrc && (
                            <span className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-md ring-1 ring-white/10 bg-black/30">
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
        <DraggableWindow
            title="도움말 센터"
            onClose={onClose}
            windowId="info-modal"
            initialWidth={960}
            initialHeight={620}
            isTopmost={isTopmost}
            mobileViewportFit={handheld}
            headerShowTitle
            bodyPaddingClassName="!p-0"
            bodyScrollable={false}
            bodyNoScroll
            pcViewportMaxHeightCss="min(85vh, 720px)"
            containerExtraClassName="!max-w-[min(96vw,1040px)]"
        >
            <div className="flex h-full min-h-[min(72dvh,560px)] flex-1 flex-col overflow-hidden bg-gradient-to-br from-slate-950 via-slate-900 to-black sm:min-h-[min(76vh,640px)]">
                {!handheld && (
                    <div className="flex min-h-0 flex-1">
                        <aside className="flex w-[min(32%,300px)] shrink-0 flex-col border-r border-white/10 bg-black/25 px-3 py-4 backdrop-blur-sm">
                            <p className="mb-3 px-1 text-[11px] font-semibold uppercase tracking-widest text-slate-500">목차</p>
                            {renderNav({})}
                        </aside>
                        <section className="min-w-0 flex-1 overflow-y-auto overscroll-contain px-4 py-5 sm:px-6">
                            {selectedArticle ? (
                                <HelpArticlePanel article={selectedArticle} />
                            ) : (
                                <p className="text-center text-slate-500">항목을 선택해 주세요.</p>
                            )}
                        </section>
                    </div>
                )}

                {handheld && mobilePane === 'list' && (
                    <div className="flex min-h-0 flex-1 flex-col px-3 py-3">
                        <p className="mb-2 px-1 text-center text-xs text-slate-500">대분류 · 중분류를 눌러 상세 안내를 엽니다.</p>
                        {renderNav({ forMobileList: true })}
                    </div>
                )}

                {handheld && mobilePane === 'detail' && (
                    <div className="flex min-h-0 flex-1 flex-col">
                        <div className="flex shrink-0 items-center gap-2 border-b border-white/10 bg-black/30 px-2 py-2 backdrop-blur-md">
                            <button
                                type="button"
                                onClick={goBackMobile}
                                className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm font-semibold text-amber-100 transition hover:bg-white/10 active:scale-[0.98]"
                            >
                                <span className="text-lg leading-none" aria-hidden>
                                    ←
                                </span>
                                목록
                            </button>
                            <span className="min-w-0 flex-1 truncate text-center text-xs font-medium text-slate-400">
                                {selectedArticle?.title ?? '도움말'}
                            </span>
                            <span className="w-[4.5rem]" aria-hidden />
                        </div>
                        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4">
                            {selectedArticle ? (
                                <HelpArticlePanel article={selectedArticle} />
                            ) : (
                                <p className="text-center text-slate-500">항목이 없습니다.</p>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </DraggableWindow>
    );
};

export default InfoModal;
