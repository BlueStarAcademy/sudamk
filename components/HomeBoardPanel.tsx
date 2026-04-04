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
    const displayPosts = sortedPosts;

    const formatDateCompact = (timestamp: number) => {
        const date = new Date(timestamp);
        const y = String(date.getFullYear()).slice(2);
        const m = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const h = String(date.getHours()).padStart(2, '0');
        const min = String(date.getMinutes()).padStart(2, '0');
        return `${y}-${m}-${day} ${h}:${min}`;
    };

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
                        <div
                            className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-y-contain rounded-md border border-color/50 bg-secondary/25"
                            role="list"
                        >
                            <div className="flex min-w-0 flex-col">
                                {displayPosts.map((post) => (
                                    <button
                                        key={post.id}
                                        type="button"
                                        role="listitem"
                                        className={`flex h-9 min-h-9 w-full min-w-0 items-center gap-1 border-b border-color/40 px-1.5 py-0 text-left transition-colors last:border-b-0 active:bg-secondary/70 ${
                                            post.isPinned
                                                ? 'bg-gradient-to-r from-amber-900/20 via-amber-950/10 to-transparent'
                                                : 'bg-transparent hover:bg-secondary/45'
                                        }`}
                                        onClick={() => handlePostClick(post)}
                                    >
                                        <span className="w-4 flex-shrink-0 text-center text-[11px] leading-none" aria-hidden>
                                            {post.isPinned ? <span className="text-amber-300">📌</span> : <span className="text-tertiary/35">·</span>}
                                        </span>
                                        <span className="min-w-0 flex-1 truncate text-[10px] font-semibold leading-tight text-primary sm:text-[11px]">
                                            {post.title}
                                        </span>
                                        <span className="flex-shrink-0 pl-0.5 text-[9px] tabular-nums leading-none text-tertiary sm:text-[10px]">
                                            {formatDateCompact(post.createdAt)}
                                        </span>
                                    </button>
                                ))}
                            </div>
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

            {selectedPost && fitViewport && (
                <div
                    className="fixed inset-0 z-[280] flex items-center justify-center bg-black/55 p-3 backdrop-blur-[2px]"
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="home-board-modal-title"
                    onClick={() => setSelectedPost(null)}
                >
                    <div
                        className="flex max-h-[min(85dvh,28rem)] w-full max-w-md flex-col overflow-hidden rounded-xl border border-color bg-panel shadow-2xl"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex shrink-0 items-start justify-between gap-2 border-b border-color bg-secondary/40 px-3 py-2.5">
                            <div className="min-w-0 flex-1">
                                <h2 id="home-board-modal-title" className="text-sm font-bold leading-snug text-primary sm:text-base">
                                    {selectedPost.isPinned && <span className="mr-1 text-amber-400">📌</span>}
                                    {selectedPost.title}
                                </h2>
                                <p className="mt-1 text-[11px] text-tertiary sm:text-xs">
                                    {formatDateTime(selectedPost.createdAt)}
                                    {selectedPost.updatedAt !== selectedPost.createdAt && (
                                        <span className="ml-1.5 block sm:inline">
                                            (수정: {formatDateTime(selectedPost.updatedAt)})
                                        </span>
                                    )}
                                </p>
                            </div>
                            <button
                                type="button"
                                className="shrink-0 rounded-lg border border-color/60 bg-secondary/80 px-2.5 py-1 text-xs font-semibold text-primary hover:bg-secondary"
                                onClick={() => setSelectedPost(null)}
                            >
                                닫기
                            </button>
                        </div>
                        <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain px-3 py-3 text-sm leading-relaxed text-primary whitespace-pre-wrap sm:text-[15px]">
                            {selectedPost.content}
                        </div>
                    </div>
                </div>
            )}

            {selectedPost && !fitViewport && (
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
