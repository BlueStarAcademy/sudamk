import React, { useState } from 'react';
import { HomeBoardPost } from '../types/entities.js';
import DraggableWindow from './DraggableWindow.js';

interface HomeBoardPanelProps {
    posts: HomeBoardPost[];
    isAdmin?: boolean;
    onAction?: (action: any) => void;
    /** 네이티브 홈 한 화면: 부모 높이에 맞춤 */
    fitViewport?: boolean;
}

const HomeBoardPanel: React.FC<HomeBoardPanelProps> = ({ posts, fitViewport = false }) => {
    const [selectedPost, setSelectedPost] = useState<HomeBoardPost | null>(null);

    // 고정글을 먼저, 그 다음 최신순으로 정렬
    const sortedPosts = [...posts].sort((a, b) => {
        if (a.isPinned && !b.isPinned) return -1;
        if (!a.isPinned && b.isPinned) return 1;
        return b.createdAt - a.createdAt;
    });

    const formatDateTime = (timestamp: number) => {
        const date = new Date(timestamp);
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        return `${year}-${month}-${day} ${hours}:${minutes}`;
    };

    const formatDateParts = (timestamp: number) => {
        const date = new Date(timestamp);
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        return {
            dateLine: `${year}-${month}-${day}`,
            timeLine: `${hours}:${minutes}`,
        };
    };

    const handlePostClick = (post: HomeBoardPost) => {
        setSelectedPost(post);
    };

    const headerPad = fitViewport ? 'px-1.5 py-1 sm:px-2' : 'px-3 py-2.5 sm:px-4';
    const listPad = fitViewport
        ? 'flex min-h-0 flex-1 flex-col overflow-hidden px-1 pb-1 pt-0'
        : 'flex min-h-0 flex-1 flex-col px-2 pb-2 pt-0 sm:px-3';
    const displayPostsFit = fitViewport ? sortedPosts.slice(0, 6) : sortedPosts;

    return (
        <>
            <div className="bg-panel border border-color text-on-panel rounded-lg min-h-0 flex flex-col h-full overflow-hidden">
                <div className={`flex-shrink-0 border-b border-color text-center ${headerPad}`}>
                    <h3
                        className={
                            fitViewport
                                ? 'text-[12px] font-bold leading-tight text-primary sm:text-[13px]'
                                : 'text-base font-bold leading-tight text-primary sm:text-lg md:text-xl'
                        }
                    >
                        공지사항
                    </h3>
                </div>
                <div className={listPad}>
                    {sortedPosts.length === 0 ? (
                        <div
                            className={
                                fitViewport
                                    ? 'flex flex-1 items-center justify-center py-2 text-center text-[10px] text-tertiary'
                                    : 'flex flex-1 items-center justify-center py-6 text-center text-sm text-tertiary sm:text-base'
                            }
                        >
                            공지사항이 없습니다.
                        </div>
                    ) : fitViewport ? (
                        <div className="flex min-h-0 flex-1 flex-col gap-1 overflow-hidden" role="list">
                            {displayPostsFit.map((post) => (
                                <button
                                    key={post.id}
                                    type="button"
                                    role="listitem"
                                    className={`group relative flex min-h-[2.35rem] min-w-0 flex-1 basis-0 cursor-pointer flex-col justify-start overflow-hidden rounded-md border-2 px-1.5 py-1 text-left shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_4px_10px_rgba(0,0,0,0.25)] transition-all hover:-translate-y-px hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.12),0_8px_14px_rgba(0,0,0,0.32)] active:scale-[0.99] ${
                                        post.isPinned
                                            ? 'border-amber-400/90 bg-gradient-to-b from-amber-900/35 via-amber-950/15 to-secondary/70'
                                            : 'border-slate-500/70 bg-gradient-to-b from-slate-700/35 via-slate-800/25 to-secondary/55'
                                    }`}
                                    onClick={() => handlePostClick(post)}
                                >
                                    <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-white/20" />
                                    <div className="flex min-w-0 items-start gap-1">
                                        {post.isPinned && (
                                            <span className="flex-shrink-0 text-[10px] text-amber-300 drop-shadow" aria-hidden>
                                                📌
                                            </span>
                                        )}
                                        <span className="line-clamp-2 min-w-0 flex-1 text-[9px] font-semibold leading-snug text-primary sm:text-[10px]">
                                            {post.title}
                                        </span>
                                    </div>
                                    <div className="mt-0.5 truncate border-t border-white/10 pt-0.5 text-[8px] leading-none text-slate-300 sm:text-[9px]">
                                        {formatDateTime(post.createdAt).slice(2, 16)}
                                    </div>
                                </button>
                            ))}
                        </div>
                    ) : (
                        <div className="min-h-0 max-h-[min(100%,calc(2.75rem*10+0.25rem))] flex-1 overflow-x-hidden overflow-y-auto rounded-md border border-color/60 bg-secondary/20">
                            <div className="flex min-w-0 flex-col" role="list">
                                {sortedPosts.map((post) => {
                                    const { dateLine, timeLine } = formatDateParts(post.createdAt);
                                    return (
                                        <button
                                            key={post.id}
                                            type="button"
                                            role="listitem"
                                            className={`group flex w-full min-h-[2.75rem] items-center gap-2 border-b border-color/35 px-2.5 py-2 text-left transition-colors last:border-b-0 hover:bg-secondary/55 sm:gap-3 sm:px-3 sm:py-2.5 ${
                                                post.isPinned
                                                    ? 'bg-gradient-to-r from-amber-900/25 via-amber-950/15 to-secondary/40'
                                                    : 'bg-secondary/15'
                                            }`}
                                            onClick={() => handlePostClick(post)}
                                        >
                                            <span className="w-6 flex-shrink-0 text-center text-base leading-none sm:w-7 sm:text-lg" aria-hidden>
                                                {post.isPinned ? <span className="text-amber-300 drop-shadow">📌</span> : <span className="text-tertiary/40">·</span>}
                                            </span>
                                            <span className="min-w-0 flex-1 truncate text-sm font-semibold text-primary sm:text-base md:text-[1.0625rem]">
                                                {post.title}
                                            </span>
                                            <span className="hidden w-[9.25rem] flex-shrink-0 text-right text-sm tabular-nums text-tertiary sm:inline-block sm:text-base">
                                                {formatDateTime(post.createdAt)}
                                            </span>
                                            <span className="flex w-[5.5rem] flex-shrink-0 flex-col items-end justify-center gap-0.5 text-right leading-tight sm:hidden">
                                                <span className="text-xs font-medium tabular-nums text-tertiary">{dateLine}</span>
                                                <span className="text-xs font-medium tabular-nums text-tertiary">{timeLine}</span>
                                            </span>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {selectedPost && (
                <DraggableWindow
                    title={selectedPost.title}
                    onClose={() => setSelectedPost(null)}
                    windowId={`home-board-post-${selectedPost.id}`}
                    initialWidth={600}
                    initialHeight={500}
                    isTopmost={true}
                >
                    <div className="p-4 text-on-panel">
                        <div className="mb-4 flex items-center justify-between border-b border-color pb-2">
                            <div className="flex items-center gap-2">
                                {selectedPost.isPinned && <span className="text-base font-bold text-yellow-500">📌</span>}
                                <span className="text-sm text-tertiary sm:text-base">
                                    {formatDateTime(selectedPost.createdAt)}
                                    {selectedPost.updatedAt !== selectedPost.createdAt && (
                                        <span className="ml-2">(수정됨: {formatDateTime(selectedPost.updatedAt)})</span>
                                    )}
                                </span>
                            </div>
                        </div>
                        <div className="text-base leading-relaxed text-primary whitespace-pre-wrap sm:text-lg">
                            {selectedPost.content}
                        </div>
                    </div>
                </DraggableWindow>
            )}
        </>
    );
};

export default HomeBoardPanel;
