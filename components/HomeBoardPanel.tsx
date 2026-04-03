import React, { useState } from 'react';
import { HomeBoardPost } from '../types/entities.js';
import DraggableWindow from './DraggableWindow.js';

interface HomeBoardPanelProps {
    posts: HomeBoardPost[];
    isAdmin?: boolean;
    onAction?: (action: any) => void;
    /** 네이티브 홈 한 화면: 내부 스크롤 없이 상단 글만 축약 표시 */
    fitViewport?: boolean;
}

const HomeBoardPanel: React.FC<HomeBoardPanelProps> = ({ posts, isAdmin, onAction, fitViewport = false }) => {
    const [selectedPost, setSelectedPost] = useState<HomeBoardPost | null>(null);

    // 고정글을 먼저, 그 다음 최신순으로 정렬
    const sortedPosts = [...posts].sort((a, b) => {
        if (a.isPinned && !b.isPinned) return -1;
        if (!a.isPinned && b.isPinned) return 1;
        return b.createdAt - a.createdAt;
    });

    const formatDate = (timestamp: number) => {
        const date = new Date(timestamp);
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        return `${year}-${month}-${day} ${hours}:${minutes}`;
    };

    const handlePostClick = (post: HomeBoardPost) => {
        setSelectedPost(post);
    };

    const displayPosts = fitViewport ? sortedPosts.slice(0, 6) : sortedPosts;

    return (
        <>
            <div className="bg-panel border border-color text-on-panel rounded-lg min-h-0 flex flex-col h-full overflow-hidden">
                <div className={`flex-shrink-0 border-b border-color text-center ${fitViewport ? 'px-1 py-1' : 'p-2'}`}>
                    <h3 className={`font-bold ${fitViewport ? 'text-[12px] leading-tight sm:text-[13px]' : 'text-sm'}`}>공지사항</h3>
                </div>
                <div
                    className={`flex min-h-0 flex-1 flex-col ${fitViewport ? 'gap-1 overflow-hidden p-1' : 'space-y-2 overflow-y-auto p-2'}`}
                >
                    {sortedPosts.length === 0 ? (
                        <div className={`text-center text-tertiary ${fitViewport ? 'py-2 text-[10px]' : 'py-4 text-xs'}`}>
                            공지사항이 없습니다.
                        </div>
                    ) : (
                        displayPosts.map(post =>
                            fitViewport ? (
                                <div
                                    key={post.id}
                                    className={`group relative flex min-h-0 flex-1 basis-0 cursor-pointer flex-col justify-start overflow-hidden rounded-md border-2 px-1.5 py-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_4px_10px_rgba(0,0,0,0.25)] transition-all hover:-translate-y-[1px] hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.12),0_8px_14px_rgba(0,0,0,0.32)] ${post.isPinned ? 'border-amber-400/90 bg-gradient-to-b from-amber-900/35 via-amber-950/15 to-secondary/70' : 'border-slate-500/70 bg-gradient-to-b from-slate-700/35 via-slate-800/25 to-secondary/55'}`}
                                    onClick={() => handlePostClick(post)}
                                >
                                    <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-white/20" />
                                    <div className="flex min-w-0 items-start gap-1">
                                        {post.isPinned && <span className="flex-shrink-0 text-[10px] text-amber-300 drop-shadow">📌</span>}
                                        <h4 className="line-clamp-2 min-w-0 flex-1 text-[9px] font-semibold leading-snug text-primary sm:text-[10px]">
                                            {post.title}
                                        </h4>
                                    </div>
                                    <div className="mt-0.5 truncate border-t border-white/10 pt-0.5 text-[8px] leading-none text-slate-300 sm:text-[9px]">{formatDate(post.createdAt).slice(2, 16)}</div>
                                </div>
                            ) : (
                                <div
                                    key={post.id}
                                    className={`cursor-pointer rounded-md bg-secondary/50 p-2 transition-colors hover:bg-secondary ${post.isPinned ? 'border-l-4 border-yellow-500' : ''}`}
                                    onClick={() => handlePostClick(post)}
                                >
                                    <div className="flex items-center justify-between gap-2">
                                        <div className="flex min-w-0 flex-1 items-center gap-1">
                                            {post.isPinned && <span className="flex-shrink-0 text-xs font-bold text-yellow-500">📌</span>}
                                            <h4 className="truncate text-xs font-semibold text-primary">{post.title}</h4>
                                        </div>
                                        <div className="flex-shrink-0 text-[9px] text-tertiary">{formatDate(post.createdAt)}</div>
                                    </div>
                                </div>
                            ),
                        )
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
                        <div className="flex items-center justify-between mb-4 pb-2 border-b border-color">
                            <div className="flex items-center gap-2">
                                {selectedPost.isPinned && (
                                    <span className="text-yellow-500 text-sm font-bold">📌</span>
                                )}
                                <span className="text-xs text-tertiary">
                                    {formatDate(selectedPost.createdAt)}
                                    {selectedPost.updatedAt !== selectedPost.createdAt && (
                                        <span className="ml-2">(수정됨: {formatDate(selectedPost.updatedAt)})</span>
                                    )}
                                </span>
                            </div>
                        </div>
                        <div className="text-sm text-primary whitespace-pre-wrap leading-relaxed">
                            {selectedPost.content}
                        </div>
                    </div>
                </DraggableWindow>
            )}
        </>
    );
};

export default HomeBoardPanel;

