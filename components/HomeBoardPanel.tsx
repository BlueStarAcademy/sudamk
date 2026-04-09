import React, { useMemo, useState } from 'react';
import { HomeBoardPost } from '../types/entities.js';
import DraggableWindow, { SUDAMR_MODAL_CLOSE_BUTTON_CLASS } from './DraggableWindow.js';

type BoardCategory = 'notice' | 'patch';

interface HomeBoardPanelProps {
    posts: HomeBoardPost[];
    isAdmin?: boolean;
    onAction?: (action: any) => void;
    /** 네이티브 홈 한 화면: 부모 높이에 맞춤 */
    fitViewport?: boolean;
    /** 풀스크린 모달(반투명 배경): 게시판형·큰 글자 */
    modalMode?: boolean;
    /** modalMode일 때 상단 닫기 */
    onClose?: () => void;
}

const PATCH_PREFIX = '[패치]';
const UPDATE_PREFIX = '[업데이트]';

const getPostCategory = (post: HomeBoardPost): BoardCategory => {
    const title = (post.title || '').trim();
    if (title.startsWith(PATCH_PREFIX) || title.startsWith(UPDATE_PREFIX)) return 'patch';
    return 'notice';
};

const stripCategoryPrefix = (title: string): string =>
    title.replace(/^\[(패치|업데이트)\]\s*/u, '').trim();

const toStoredTitle = (rawTitle: string, category: BoardCategory): string => {
    const clean = stripCategoryPrefix(rawTitle);
    return category === 'patch' ? `${PATCH_PREFIX} ${clean}` : clean;
};

type HomeBoardDraftEditorProps = {
    editingPost: HomeBoardPost | null;
    draftTitle: string;
    setDraftTitle: (v: string) => void;
    draftContent: string;
    setDraftContent: (v: string) => void;
    draftPinned: boolean;
    setDraftPinned: (v: boolean) => void;
    draftCategory: BoardCategory;
    setDraftCategory: (v: BoardCategory) => void;
    onSave: () => void;
    onCancel: () => void;
    /** 공지 모달 상단 인라인: 터치·세로 공간 확보 */
    layout: 'manage' | 'modalInline';
};

const HomeBoardDraftEditor: React.FC<HomeBoardDraftEditorProps> = ({
    editingPost,
    draftTitle,
    setDraftTitle,
    draftContent,
    setDraftContent,
    draftPinned,
    setDraftPinned,
    draftCategory,
    setDraftCategory,
    onSave,
    onCancel,
    layout,
}) => {
    const inline = layout === 'modalInline';
    const shell = inline
        ? 'rounded-lg border border-amber-400/35 bg-black/50 p-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] sm:p-3'
        : 'shrink-0 rounded-lg border border-slate-500/35 bg-slate-900/45 p-3';
    return (
        <div className={shell}>
            <div className={`mb-2 flex items-center justify-between gap-2 ${inline ? 'flex-wrap' : ''}`}>
                <h4 className={`font-bold ${inline ? 'text-sm text-amber-100 sm:text-base' : 'text-sm'}`}>
                    {editingPost ? '게시글 수정' : '새 게시글 작성'}
                </h4>
                <button
                    type="button"
                    className={`shrink-0 rounded border border-slate-500/40 font-semibold text-slate-200 hover:bg-slate-700/35 ${inline ? 'px-2.5 py-1.5 text-xs sm:px-3 sm:text-sm' : 'px-2 py-0.5 text-xs'}`}
                    onClick={onCancel}
                >
                    취소
                </button>
            </div>
            <div className="grid grid-cols-1 gap-2">
                <select
                    value={draftCategory}
                    onChange={(e) => setDraftCategory(e.target.value as BoardCategory)}
                    className={`rounded border border-slate-600 bg-slate-800 text-slate-100 ${inline ? 'px-2 py-2 text-sm' : 'px-2 py-1 text-xs'}`}
                >
                    <option value="notice">공지사항</option>
                    <option value="patch">패치/업데이트</option>
                </select>
                <input
                    type="text"
                    value={draftTitle}
                    onChange={(e) => setDraftTitle(e.target.value)}
                    placeholder="제목"
                    className={`rounded border border-slate-600 bg-slate-800 text-slate-100 ${inline ? 'px-3 py-2.5 text-base sm:text-sm' : 'px-2 py-1.5 text-sm'}`}
                />
                <textarea
                    value={draftContent}
                    onChange={(e) => setDraftContent(e.target.value)}
                    placeholder="내용"
                    className={`resize-y rounded border border-slate-600 bg-slate-800 text-slate-100 ${inline ? 'min-h-[11rem] px-3 py-2.5 text-base leading-relaxed sm:min-h-[9rem] sm:text-sm' : 'h-28 px-2 py-1.5 text-sm'}`}
                />
                <label className={`flex items-center gap-2 text-slate-200 ${inline ? 'text-sm' : 'text-xs'}`}>
                    <input type="checkbox" checked={draftPinned} onChange={(e) => setDraftPinned(e.target.checked)} className="h-4 w-4 shrink-0" />
                    상단 고정
                </label>
                <button
                    type="button"
                    className={`rounded-md border border-emerald-400/45 bg-emerald-800/35 font-semibold text-emerald-100 hover:bg-emerald-700/40 ${inline ? 'w-full px-3 py-2.5 text-sm sm:w-auto sm:py-2' : 'px-3 py-1.5 text-xs'}`}
                    onClick={onSave}
                >
                    저장
                </button>
            </div>
        </div>
    );
};

const HomeBoardPanel: React.FC<HomeBoardPanelProps> = ({ posts, isAdmin = false, onAction, fitViewport = false, modalMode = false, onClose }) => {
    const useCompactList = fitViewport && !modalMode;
    const [selectedPost, setSelectedPost] = useState<HomeBoardPost | null>(null);
    const [isManageOpen, setIsManageOpen] = useState(false);
    const [editingPost, setEditingPost] = useState<HomeBoardPost | null>(null);
    const [draftTitle, setDraftTitle] = useState('');
    const [draftContent, setDraftContent] = useState('');
    const [draftPinned, setDraftPinned] = useState(false);
    const [draftCategory, setDraftCategory] = useState<BoardCategory>('notice');
    /** 새 글 작성 시 draftTitle/Content가 비어 있어도 편집 폼을 표시하기 위함 */
    const [editorOpen, setEditorOpen] = useState(false);

    // 고정글을 먼저, 그 다음 최신순으로 정렬
    const sortedPosts = [...posts].sort((a, b) => {
        if (a.isPinned && !b.isPinned) return -1;
        if (!a.isPinned && b.isPinned) return 1;
        return b.createdAt - a.createdAt;
    });
    const noticePosts = useMemo(
        () => sortedPosts.filter((post) => getPostCategory(post) === 'notice'),
        [sortedPosts],
    );
    const patchPosts = useMemo(
        () => sortedPosts.filter((post) => getPostCategory(post) === 'patch'),
        [sortedPosts],
    );

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

    const openCreate = (category: BoardCategory) => {
        setEditingPost(null);
        setDraftTitle('');
        setDraftContent('');
        setDraftPinned(false);
        setDraftCategory(category);
        setEditorOpen(true);
    };

    const openEdit = (post: HomeBoardPost) => {
        setEditingPost(post);
        setDraftTitle(stripCategoryPrefix(post.title));
        setDraftContent(post.content);
        setDraftPinned(post.isPinned);
        setDraftCategory(getPostCategory(post));
        setEditorOpen(true);
    };

    const closeEditor = () => {
        setEditingPost(null);
        setDraftTitle('');
        setDraftContent('');
        setDraftPinned(false);
        setDraftCategory('notice');
        setEditorOpen(false);
    };

    const handleSave = () => {
        if (!onAction) return;
        const title = draftTitle.trim();
        const content = draftContent.trim();
        if (!title || !content) {
            window.alert('제목과 내용을 입력해주세요.');
            return;
        }
        const storedTitle = toStoredTitle(title, draftCategory);
        if (editingPost) {
            void onAction({
                type: 'ADMIN_UPDATE_HOME_BOARD_POST',
                payload: {
                    postId: editingPost.id,
                    title: storedTitle,
                    content,
                    isPinned: draftPinned,
                },
            });
        } else {
            void onAction({
                type: 'ADMIN_CREATE_HOME_BOARD_POST',
                payload: {
                    title: storedTitle,
                    content,
                    isPinned: draftPinned,
                },
            });
        }
        closeEditor();
    };

    const handleDelete = (postId: string) => {
        if (!onAction) return;
        if (!window.confirm('이 게시글을 삭제하시겠습니까?')) return;
        void onAction({ type: 'ADMIN_DELETE_HOME_BOARD_POST', payload: { postId } });
        if (selectedPost?.id === postId) setSelectedPost(null);
    };

    const formatDateCompact = (timestamp: number) => {
        const date = new Date(timestamp);
        const y = String(date.getFullYear()).slice(2);
        const m = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const h = String(date.getHours()).padStart(2, '0');
        const min = String(date.getMinutes()).padStart(2, '0');
        return `${y}-${m}-${day} ${h}:${min}`;
    };

    const renderPostList = (items: HomeBoardPost[], emptyText: string) => {
        if (items.length === 0) {
            return (
                <div
                    className={
                        useCompactList
                            ? 'flex flex-1 items-center justify-center py-2 text-center text-[10px] text-tertiary'
                            : modalMode
                              ? 'flex flex-1 items-center justify-center py-8 text-center text-base text-tertiary'
                              : 'flex flex-1 items-center justify-center py-4 text-center text-sm text-tertiary'
                    }
                >
                    {emptyText}
                </div>
            );
        }

        if (useCompactList) {
            return (
                <div
                    className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-y-contain rounded-md border border-color/50 bg-secondary/25"
                    role="list"
                >
                    <div className="flex min-w-0 flex-col">
                        {items.map((post) => (
                            <button
                                key={post.id}
                                type="button"
                                role="listitem"
                                className={`flex h-8 min-h-8 w-full min-w-0 items-center gap-1 border-b border-color/40 px-1.5 py-0 text-left transition-colors last:border-b-0 active:bg-secondary/70 ${
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
                                    {stripCategoryPrefix(post.title)}
                                </span>
                                <span className="flex-shrink-0 pl-0.5 text-[9px] tabular-nums leading-none text-tertiary sm:text-[10px]">
                                    {formatDateCompact(post.createdAt)}
                                </span>
                            </button>
                        ))}
                    </div>
                </div>
            );
        }

        const rowTitleClass = modalMode
            ? 'min-w-0 flex-1 truncate text-base font-semibold text-slate-100 sm:text-lg'
            : 'min-w-0 flex-1 truncate text-sm font-semibold text-primary';
        const rowDateDesktopClass = modalMode
            ? 'hidden w-[9.5rem] flex-shrink-0 text-right text-sm tabular-nums text-slate-400 sm:inline-block'
            : 'hidden w-[8.5rem] flex-shrink-0 text-right text-xs tabular-nums text-tertiary sm:inline-block';
        const rowDateMobileClass = modalMode
            ? 'flex w-[6rem] flex-shrink-0 flex-col items-end justify-center gap-0.5 text-right leading-tight sm:hidden'
            : 'flex w-[5.5rem] flex-shrink-0 flex-col items-end justify-center gap-0.5 text-right leading-tight sm:hidden';
        const rowDateMobileTextClass = modalMode ? 'text-sm font-medium tabular-nums text-slate-400' : 'text-xs font-medium tabular-nums text-tertiary';
        const pinClass = modalMode ? 'w-6 flex-shrink-0 text-center text-lg leading-none' : 'w-5 flex-shrink-0 text-center text-base leading-none';
        const pinEmoji = modalMode ? 'text-amber-300 drop-shadow text-xl' : 'text-amber-300 drop-shadow';
        const listBorder = modalMode ? 'border border-amber-200/15 bg-gradient-to-b from-white/[0.06] to-black/20 shadow-inner' : 'border border-color/60 bg-secondary/20';
        const rowMinH = modalMode ? 'min-h-[3.25rem]' : 'min-h-[2.5rem]';
        const rowPad = modalMode ? 'px-3 py-2.5' : 'px-2 py-1.5';

        return (
            <div className={`min-h-0 flex-1 overflow-x-hidden overflow-y-auto rounded-lg ${listBorder}`}>
                <div className="flex min-w-0 flex-col" role="list">
                    {items.map((post) => {
                        const { dateLine, timeLine } = formatDateParts(post.createdAt);
                        return (
                            <button
                                key={post.id}
                                type="button"
                                role="listitem"
                                className={`group flex w-full ${rowMinH} items-center gap-2 border-b border-color/35 ${rowPad} text-left transition-colors last:border-b-0 hover:bg-secondary/55 ${
                                    post.isPinned
                                        ? 'bg-gradient-to-r from-amber-900/25 via-amber-950/15 to-secondary/40'
                                        : 'bg-secondary/15'
                                }`}
                                onClick={() => handlePostClick(post)}
                            >
                                <span className={`${pinClass}`} aria-hidden>
                                    {post.isPinned ? <span className={pinEmoji}>📌</span> : <span className="text-tertiary/40">·</span>}
                                </span>
                                <span className={rowTitleClass}>
                                    {stripCategoryPrefix(post.title)}
                                </span>
                                <span className={rowDateDesktopClass}>
                                    {formatDateTime(post.createdAt)}
                                </span>
                                <span className={rowDateMobileClass}>
                                    <span className={rowDateMobileTextClass}>{dateLine}</span>
                                    <span className={rowDateMobileTextClass}>{timeLine}</span>
                                </span>
                            </button>
                        );
                    })}
                </div>
            </div>
        );
    };

    const shellClass = modalMode
        ? 'min-h-0 flex h-full flex-col overflow-hidden rounded-xl border-2 border-amber-800/40 bg-gradient-to-b from-amber-950/50 via-zinc-900 to-zinc-950 text-on-panel shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_24px_64px_-28px_rgba(0,0,0,0.85)] ring-1 ring-amber-200/15'
        : 'bg-panel border border-color text-on-panel rounded-lg min-h-0 flex flex-col h-full overflow-hidden';

    return (
        <>
            <div className={shellClass}>
                <div
                    className={`flex shrink-0 items-center justify-between border-b border-amber-200/15 bg-gradient-to-r from-amber-950/55 via-zinc-900/90 to-amber-950/40 ${
                        useCompactList ? 'px-1.5 py-1 sm:px-2' : modalMode ? 'px-4 py-3 sm:px-5' : 'px-3 py-2.5 sm:px-4'
                    }`}
                >
                    <h3
                        id={modalMode ? 'announcements-board-shell-title' : undefined}
                        className={
                            useCompactList
                                ? 'text-[12px] font-bold leading-tight text-primary sm:text-[13px]'
                                : modalMode
                                  ? 'text-lg font-black tracking-tight text-amber-50 sm:text-xl'
                                  : 'text-base font-bold leading-tight text-primary sm:text-lg'
                        }
                    >
                        {modalMode ? '공지 게시판' : '홈 게시판'}
                    </h3>
                    <div className="flex min-w-0 shrink-0 flex-wrap items-center justify-end gap-1 sm:gap-2">
                        {isAdmin && onAction && modalMode && (
                            <>
                                <button
                                    type="button"
                                    className="rounded-md border border-cyan-400/45 bg-cyan-950/40 px-2 py-1 text-[10px] font-semibold text-cyan-100 hover:bg-cyan-900/45 sm:px-2.5 sm:text-xs"
                                    onClick={() => {
                                        openCreate('notice');
                                        setIsManageOpen(false);
                                    }}
                                >
                                    공지 작성
                                </button>
                                <button
                                    type="button"
                                    className="rounded-md border border-amber-400/45 bg-amber-950/40 px-2 py-1 text-[10px] font-semibold text-amber-100 hover:bg-amber-900/45 sm:px-2.5 sm:text-xs"
                                    onClick={() => {
                                        openCreate('patch');
                                        setIsManageOpen(false);
                                    }}
                                >
                                    패치 작성
                                </button>
                            </>
                        )}
                        {isAdmin && onAction && (
                            <button
                                type="button"
                                className={
                                    useCompactList
                                        ? 'rounded-md border border-amber-400/50 bg-amber-900/30 px-2 py-0.5 text-[10px] font-semibold text-amber-200 hover:bg-amber-800/35'
                                        : modalMode
                                          ? 'rounded-md border border-amber-400/50 bg-amber-900/30 px-2 py-1 text-[10px] font-semibold text-amber-200 hover:bg-amber-800/35 sm:px-2.5 sm:text-xs'
                                          : 'rounded-md border border-amber-400/50 bg-amber-900/30 px-2.5 py-1 text-xs font-semibold text-amber-200 hover:bg-amber-800/35'
                                }
                                onClick={() => setIsManageOpen(true)}
                            >
                                관리
                            </button>
                        )}
                        {modalMode && onClose && (
                            <button
                                type="button"
                                className={SUDAMR_MODAL_CLOSE_BUTTON_CLASS}
                                onClick={onClose}
                                aria-label="공지 게시판 닫기"
                            >
                                닫기
                            </button>
                        )}
                    </div>
                </div>
                {editorOpen && isAdmin && onAction && modalMode && !isManageOpen && (
                    <div className="shrink-0 border-b border-amber-200/15 px-2 pb-2 pt-1 sm:px-4 sm:pb-3">
                        <HomeBoardDraftEditor
                            editingPost={editingPost}
                            draftTitle={draftTitle}
                            setDraftTitle={setDraftTitle}
                            draftContent={draftContent}
                            setDraftContent={setDraftContent}
                            draftPinned={draftPinned}
                            setDraftPinned={setDraftPinned}
                            draftCategory={draftCategory}
                            setDraftCategory={setDraftCategory}
                            onSave={handleSave}
                            onCancel={closeEditor}
                            layout="modalInline"
                        />
                    </div>
                )}
                <div
                    className={
                        useCompactList
                            ? 'flex min-h-0 flex-1 flex-col gap-1 overflow-hidden px-1 pb-1 pt-1'
                            : modalMode
                              ? 'flex min-h-0 flex-1 flex-col gap-3 overflow-hidden px-3 pb-3 pt-3 sm:px-4 sm:pb-4'
                              : 'flex min-h-0 flex-1 flex-col gap-2 overflow-hidden px-2 pb-2 pt-1 sm:px-3'
                    }
                >
                    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
                        <div
                            className={`mb-1 shrink-0 border-b border-amber-200/10 ${useCompactList ? 'px-0.5 pb-0.5' : modalMode ? 'px-1 pb-2' : 'px-1 pb-1'}`}
                        >
                            <h4
                                className={
                                    useCompactList
                                        ? 'text-[11px] font-bold text-cyan-200'
                                        : modalMode
                                          ? 'text-base font-bold text-cyan-200 sm:text-lg'
                                          : 'text-sm font-bold text-cyan-200'
                                }
                            >
                                공지사항
                            </h4>
                        </div>
                        {renderPostList(noticePosts, '공지사항이 없습니다.')}
                    </div>
                    <div className="flex min-h-0 flex-1 flex-col overflow-hidden border-t border-amber-200/10 pt-2 sm:pt-3">
                        <div
                            className={`mb-1 shrink-0 border-b border-amber-200/10 ${useCompactList ? 'px-0.5 pb-0.5' : modalMode ? 'px-1 pb-2' : 'px-1 pb-1'}`}
                        >
                            <h4
                                className={
                                    useCompactList
                                        ? 'text-[11px] font-bold text-amber-200'
                                        : modalMode
                                          ? 'text-base font-bold text-amber-200 sm:text-lg'
                                          : 'text-sm font-bold text-amber-200'
                                }
                            >
                                패치 / 업데이트
                            </h4>
                        </div>
                        {renderPostList(patchPosts, '패치/업데이트 내역이 없습니다.')}
                    </div>
                </div>
            </div>

            {selectedPost && (useCompactList || modalMode) && (
                <div
                    className={`sudamr-modal-overlay z-[280] p-3`}
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="home-board-modal-title"
                    onClick={() => setSelectedPost(null)}
                >
                    <div
                        className={`sudamr-modal-panel flex w-full flex-col overflow-hidden p-0 ring-1 ring-white/[0.06] ${
                            modalMode ? 'max-h-[min(88dvh,40rem)] max-w-lg sm:max-w-2xl' : 'max-h-[min(85dvh,28rem)] max-w-md'
                        }`}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex shrink-0 items-start justify-between gap-2 border-b border-white/10 bg-gradient-to-r from-secondary/90 to-tertiary/40 px-3 py-2.5 sm:px-4 sm:py-3">
                            <div className="min-w-0 flex-1">
                                <h2
                                    id="home-board-modal-title"
                                    className={
                                        modalMode
                                            ? 'text-lg font-bold leading-snug text-primary sm:text-xl'
                                            : 'text-sm font-bold leading-snug text-primary sm:text-base'
                                    }
                                >
                                    {selectedPost.isPinned && <span className="mr-1 text-amber-400">📌</span>}
                                    {stripCategoryPrefix(selectedPost.title)}
                                </h2>
                                <p
                                    className={
                                        modalMode
                                            ? 'mt-1.5 text-sm text-tertiary sm:text-base'
                                            : 'mt-1 text-[11px] text-tertiary sm:text-xs'
                                    }
                                >
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
                                className={`shrink-0 rounded-lg border border-color/60 bg-secondary/80 font-semibold text-primary hover:bg-secondary ${
                                    modalMode ? 'px-3 py-1.5 text-sm sm:px-4 sm:py-2' : 'px-2.5 py-1 text-xs'
                                }`}
                                onClick={() => setSelectedPost(null)}
                            >
                                닫기
                            </button>
                        </div>
                        <div
                            className={`min-h-0 flex-1 overflow-y-auto overscroll-y-contain px-3 py-3 leading-relaxed text-primary whitespace-pre-wrap sm:px-5 sm:py-4 ${
                                modalMode ? 'text-base sm:text-lg' : 'text-sm sm:text-[15px]'
                            }`}
                        >
                            {selectedPost.content}
                        </div>
                    </div>
                </div>
            )}

            {selectedPost && !useCompactList && !modalMode && (
                <DraggableWindow
                    title={stripCategoryPrefix(selectedPost.title)}
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
            {isManageOpen && isAdmin && onAction && (
                <DraggableWindow
                    title="홈 게시판 관리"
                    onClose={() => {
                        setIsManageOpen(false);
                        closeEditor();
                    }}
                    windowId="home-board-manager"
                    initialWidth={760}
                    initialHeight={680}
                    isTopmost
                    variant="store"
                    modal
                    mobileViewportFit
                    mobileViewportMaxHeightCss="92dvh"
                    hideFooter
                    bodyPaddingClassName="!p-3 sm:!p-4"
                >
                    <div className="flex h-full min-h-0 flex-col gap-3 overflow-y-auto overflow-x-hidden overscroll-y-contain text-slate-100">
                        <div className="flex shrink-0 flex-wrap gap-2">
                            <button
                                type="button"
                                className="rounded-md border border-cyan-400/40 bg-cyan-900/30 px-3 py-1.5 text-xs font-semibold text-cyan-100 hover:bg-cyan-800/35"
                                onClick={() => openCreate('notice')}
                            >
                                공지사항 작성
                            </button>
                            <button
                                type="button"
                                className="rounded-md border border-amber-400/40 bg-amber-900/30 px-3 py-1.5 text-xs font-semibold text-amber-100 hover:bg-amber-800/35"
                                onClick={() => openCreate('patch')}
                            >
                                패치/업데이트 작성
                            </button>
                        </div>

                        {editorOpen && (
                            <HomeBoardDraftEditor
                                editingPost={editingPost}
                                draftTitle={draftTitle}
                                setDraftTitle={setDraftTitle}
                                draftContent={draftContent}
                                setDraftContent={setDraftContent}
                                draftPinned={draftPinned}
                                setDraftPinned={setDraftPinned}
                                draftCategory={draftCategory}
                                setDraftCategory={setDraftCategory}
                                onSave={handleSave}
                                onCancel={closeEditor}
                                layout="manage"
                            />
                        )}

                        <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 sm:grid-cols-2">
                            <div className="min-h-0 overflow-hidden rounded-lg border border-cyan-400/25 bg-slate-900/35">
                                <div className="border-b border-cyan-400/20 px-3 py-2 text-sm font-bold text-cyan-200">
                                    공지사항 ({noticePosts.length})
                                </div>
                                <div className="min-h-0 h-[calc(100%-2.25rem)] overflow-y-auto p-2">
                                    <div className="flex flex-col gap-2">
                                        {noticePosts.map((post) => (
                                            <div key={post.id} className="rounded border border-slate-600/40 bg-slate-800/60 p-2">
                                                <div className="mb-1 flex items-center justify-between gap-2">
                                                    <div className="truncate text-xs font-semibold">
                                                        {post.isPinned && <span className="mr-1 text-amber-300">📌</span>}
                                                        {stripCategoryPrefix(post.title)}
                                                    </div>
                                                    <div className="flex gap-1">
                                                        <button
                                                            type="button"
                                                            className="rounded border border-blue-400/40 px-1.5 py-0.5 text-[10px] text-blue-100 hover:bg-blue-900/35"
                                                            onClick={() => openEdit(post)}
                                                        >
                                                            수정
                                                        </button>
                                                        <button
                                                            type="button"
                                                            className="rounded border border-rose-400/40 px-1.5 py-0.5 text-[10px] text-rose-100 hover:bg-rose-900/35"
                                                            onClick={() => handleDelete(post.id)}
                                                        >
                                                            삭제
                                                        </button>
                                                    </div>
                                                </div>
                                                <p className="line-clamp-2 text-[11px] text-slate-300">{post.content}</p>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            <div className="min-h-0 overflow-hidden rounded-lg border border-amber-400/25 bg-slate-900/35">
                                <div className="border-b border-amber-400/20 px-3 py-2 text-sm font-bold text-amber-200">
                                    패치 / 업데이트 ({patchPosts.length})
                                </div>
                                <div className="min-h-0 h-[calc(100%-2.25rem)] overflow-y-auto p-2">
                                    <div className="flex flex-col gap-2">
                                        {patchPosts.map((post) => (
                                            <div key={post.id} className="rounded border border-slate-600/40 bg-slate-800/60 p-2">
                                                <div className="mb-1 flex items-center justify-between gap-2">
                                                    <div className="truncate text-xs font-semibold">
                                                        {post.isPinned && <span className="mr-1 text-amber-300">📌</span>}
                                                        {stripCategoryPrefix(post.title)}
                                                    </div>
                                                    <div className="flex gap-1">
                                                        <button
                                                            type="button"
                                                            className="rounded border border-blue-400/40 px-1.5 py-0.5 text-[10px] text-blue-100 hover:bg-blue-900/35"
                                                            onClick={() => openEdit(post)}
                                                        >
                                                            수정
                                                        </button>
                                                        <button
                                                            type="button"
                                                            className="rounded border border-rose-400/40 px-1.5 py-0.5 text-[10px] text-rose-100 hover:bg-rose-900/35"
                                                            onClick={() => handleDelete(post.id)}
                                                        >
                                                            삭제
                                                        </button>
                                                    </div>
                                                </div>
                                                <p className="line-clamp-2 text-[11px] text-slate-300">{post.content}</p>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </DraggableWindow>
            )}
        </>
    );
};

export default HomeBoardPanel;
