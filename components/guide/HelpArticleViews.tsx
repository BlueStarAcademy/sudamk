import React from 'react';
import type { HelpArticle, HelpBlock } from '../../shared/constants/helpCenterContent.js';

export function HelpBlockView({ block }: { block: HelpBlock }) {
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
                                <img
                                    src={img.src}
                                    alt={img.alt}
                                    className="h-full w-full object-cover"
                                    loading="lazy"
                                    decoding="async"
                                />
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
                    <img
                        src={block.src}
                        alt={block.alt}
                        className="max-h-56 w-full object-cover object-center sm:max-h-64"
                        loading="lazy"
                        decoding="async"
                    />
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

export function HelpArticlePanel({ article }: { article: HelpArticle }) {
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
                        <h2 className="text-xl font-bold tracking-tight text-white drop-shadow-md sm:text-2xl">
                            {article.title}
                        </h2>
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
