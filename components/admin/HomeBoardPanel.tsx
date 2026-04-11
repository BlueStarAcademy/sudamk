import React, { useMemo, useState } from 'react';
import { AdminProps, HomeBoardPost } from '../../types/index.js';
import Button from '../Button.js';
import AdminPageHeader from './AdminPageHeader.js';
import { adminCard, adminCardTitle, adminInput, adminPageNarrow, adminSectionGap, adminTextarea } from './adminChrome.js';

interface HomeBoardPanelProps extends AdminProps {
    homeBoardPosts: HomeBoardPost[];
}

type BoardCategory = 'notice' | 'patch';
type HomeBoardAdminTab = 'notice' | 'patch';

const PATCH_PREFIX = '[패치]';
const UPDATE_PREFIX = '[업데이트]';

const getPostCategory = (post: HomeBoardPost): BoardCategory => {
    const t = (post.title || '').trim();
    if (t.startsWith(PATCH_PREFIX) || t.startsWith(UPDATE_PREFIX)) return 'patch';
    return 'notice';
};

const stripCategoryPrefix = (raw: string): string =>
    raw.replace(/^\[(패치|업데이트)\]\s*/u, '').trim();

const toStoredTitle = (rawTitle: string, category: BoardCategory): string => {
    const clean = stripCategoryPrefix(rawTitle);
    return category === 'patch' ? `${PATCH_PREFIX} ${clean}` : clean;
};

const HomeBoardPanel: React.FC<HomeBoardPanelProps> = ({ homeBoardPosts = [], onAction, onBack }) => {
    const [listTab, setListTab] = useState<HomeBoardAdminTab>('notice');
    const [editingPost, setEditingPost] = useState<HomeBoardPost | null>(null);
    const [isCreating, setIsCreating] = useState(false);
    const [title, setTitle] = useState('');
    const [content, setContent] = useState('');
    const [isPinned, setIsPinned] = useState(false);
    const [draftCategory, setDraftCategory] = useState<BoardCategory>('notice');

    const sortedPosts = useMemo(
        () =>
            [...homeBoardPosts].sort((a, b) => {
                if (a.isPinned && !b.isPinned) return -1;
                if (!a.isPinned && b.isPinned) return 1;
                return b.createdAt - a.createdAt;
            }),
        [homeBoardPosts],
    );

    const noticePosts = useMemo(() => sortedPosts.filter((p) => getPostCategory(p) === 'notice'), [sortedPosts]);
    const patchPosts = useMemo(() => sortedPosts.filter((p) => getPostCategory(p) === 'patch'), [sortedPosts]);

    const handleCreate = () => {
        setEditingPost(null);
        setIsCreating(true);
        setTitle('');
        setContent('');
        setIsPinned(false);
        setDraftCategory(listTab === 'notice' ? 'notice' : 'patch');
    };

    const handleEdit = (post: HomeBoardPost) => {
        setEditingPost(post);
        setIsCreating(false);
        setTitle(stripCategoryPrefix(post.title));
        setContent(post.content);
        setIsPinned(post.isPinned);
        setDraftCategory(getPostCategory(post));
    };

    const handleCancel = () => {
        setEditingPost(null);
        setIsCreating(false);
        setTitle('');
        setContent('');
        setIsPinned(false);
        setDraftCategory('notice');
    };

    const handleSave = () => {
        const storedTitle = toStoredTitle(title, draftCategory);
        if (!storedTitle.trim() || !content.trim()) {
            alert('제목과 내용을 입력해주세요.');
            return;
        }

        if (isCreating) {
            onAction({
                type: 'ADMIN_CREATE_HOME_BOARD_POST',
                payload: { title: storedTitle.trim(), content: content.trim(), isPinned },
            });
        } else if (editingPost) {
            onAction({
                type: 'ADMIN_UPDATE_HOME_BOARD_POST',
                payload: { postId: editingPost.id, title: storedTitle.trim(), content: content.trim(), isPinned },
            });
        }

        handleCancel();
    };

    const handleDelete = (postId: string) => {
        if (window.confirm('이 게시글을 삭제하시겠습니까?')) {
            onAction({ type: 'ADMIN_DELETE_HOME_BOARD_POST', payload: { postId } });
        }
    };

    const formatDate = (timestamp: number) => {
        const date = new Date(timestamp);
        return date.toLocaleString('ko-KR', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
        });
    };

    const tabItems: { id: HomeBoardAdminTab; label: string; count: number; hint: string }[] = [
        { id: 'notice', label: '공지사항', count: noticePosts.length, hint: '일반 공지' },
        { id: 'patch', label: '업데이트 내역', count: patchPosts.length, hint: '[패치]·[업데이트] 글' },
    ];

    const editorCard =
        (isCreating || editingPost) && (
            <div className={adminCard}>
                <h2 className={adminCardTitle}>{isCreating ? '새 글 작성' : '게시글 수정'}</h2>
                <div className="space-y-4">
                    <div>
                        <label className="mb-2 block text-sm font-medium text-primary">글 종류</label>
                        <select
                            value={draftCategory}
                            onChange={(e) => setDraftCategory(e.target.value as BoardCategory)}
                            className={adminInput}
                        >
                            <option value="notice">공지사항</option>
                            <option value="patch">패치 / 업데이트 내역</option>
                        </select>
                        <p className="mt-1.5 text-xs text-gray-500">
                            업데이트·패치 글은 제목 앞에 <span className="font-mono text-amber-200/90">[패치]</span>가 붙어 홈 화면의
                            &quot;패치 / 업데이트&quot; 탭에 표시됩니다. 기존 <span className="font-mono">[업데이트]</span> 제목도
                            동일 구역으로 분류됩니다.
                        </p>
                    </div>
                    <div>
                        <label className="mb-2 block text-sm font-medium text-primary">
                            제목 {draftCategory === 'patch' ? '(접두사 제외)' : ''}
                        </label>
                        <input
                            type="text"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            className={adminInput}
                            placeholder={draftCategory === 'patch' ? '예: 1.2.0 변경 사항' : '게시글 제목'}
                        />
                    </div>
                    <div>
                        <label className="mb-2 block text-sm font-medium text-primary">내용</label>
                        <textarea
                            value={content}
                            onChange={(e) => setContent(e.target.value)}
                            className={`${adminTextarea} min-h-[10rem]`}
                            placeholder="본문을 입력하세요"
                        />
                    </div>
                    <div className="flex items-center">
                        <input
                            type="checkbox"
                            id="isPinned"
                            checked={isPinned}
                            onChange={(e) => setIsPinned(e.target.checked)}
                            className="h-4 w-4 rounded border-color bg-secondary text-accent focus:ring-accent"
                        />
                        <label htmlFor="isPinned" className="ml-2 text-sm text-on-panel">
                            상단 고정
                        </label>
                    </div>
                    <div className="flex gap-2">
                        <Button onClick={handleSave} colorScheme="blue" className="flex-1">
                            저장
                        </Button>
                        <Button onClick={handleCancel} colorScheme="gray" className="flex-1">
                            취소
                        </Button>
                    </div>
                </div>
            </div>
        );

    const renderPostList = (items: HomeBoardPost[], emptyLabel: string) => (
        <div className="space-y-4">
            {items.length === 0 ? (
                <div className="py-10 text-center text-sm text-tertiary">{emptyLabel}</div>
            ) : (
                items.map((post) => {
                    const cat = getPostCategory(post);
                    const rawTitle = (post.title || '').trim();
                    const prefixLabel = rawTitle.startsWith(UPDATE_PREFIX) ? '업데이트' : cat === 'patch' ? '패치' : null;
                    return (
                        <div
                            key={post.id}
                            className={`rounded-xl border border-color/50 bg-secondary/35 p-4 ${post.isPinned ? 'border-l-4 border-l-amber-500/90' : ''}`}
                        >
                            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                <div className="min-w-0 flex-1">
                                    <div className="mb-2 flex flex-wrap items-center gap-2">
                                        {post.isPinned && <span className="font-bold text-yellow-500">📌</span>}
                                        {prefixLabel && (
                                            <span className="rounded-md border border-cyan-500/35 bg-cyan-950/40 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-cyan-200/95">
                                                {prefixLabel}
                                            </span>
                                        )}
                                        {cat === 'notice' && (
                                            <span className="rounded-md border border-amber-500/30 bg-amber-950/35 px-2 py-0.5 text-[11px] font-semibold text-amber-200/90">
                                                공지
                                            </span>
                                        )}
                                        <h3 className="text-lg font-semibold text-primary">{stripCategoryPrefix(post.title) || post.title}</h3>
                                    </div>
                                    <p className="mb-2 whitespace-pre-wrap text-sm text-tertiary">{post.content}</p>
                                    <div className="text-xs text-tertiary">
                                        작성: {formatDate(post.createdAt)}
                                        {post.updatedAt !== post.createdAt && (
                                            <span className="ml-2">수정: {formatDate(post.updatedAt)}</span>
                                        )}
                                    </div>
                                </div>
                                <div className="flex shrink-0 gap-2 sm:flex-col sm:items-stretch">
                                    <Button onClick={() => handleEdit(post)} colorScheme="blue" className="px-3 py-1 text-xs">
                                        수정
                                    </Button>
                                    <Button onClick={() => handleDelete(post.id)} colorScheme="red" className="px-3 py-1 text-xs">
                                        삭제
                                    </Button>
                                </div>
                            </div>
                        </div>
                    );
                })
            )}
        </div>
    );

    const listCardForTab = (tab: HomeBoardAdminTab) => (
        <div className={adminCard}>
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <h2 className={`${adminCardTitle} mb-0 border-0 pb-0`}>
                    {tab === 'notice' ? '공지사항' : '업데이트 · 패치'} ({tab === 'notice' ? noticePosts.length : patchPosts.length})
                </h2>
                <Button onClick={() => { setListTab(tab); handleCreate(); }} colorScheme="green" className="!text-sm shrink-0">
                    {tab === 'notice' ? '새 공지' : '새 업데이트 글'}
                </Button>
            </div>
            {tab === 'notice'
                ? renderPostList(noticePosts, '등록된 공지가 없습니다.')
                : renderPostList(patchPosts, '업데이트·패치 내역이 없습니다. 위에서 새 글을 추가하거나 글 종류를 «패치 / 업데이트 내역»으로 저장하세요.')}
        </div>
    );

    return (
        <div className={`${adminPageNarrow} ${adminSectionGap}`}>
            <AdminPageHeader
                title="홈 게시판 관리"
                subtitle="공지와 업데이트 내역을 탭으로 나눠 작성합니다. 업데이트 글은 저장 시 [패치] 접두사가 붙어 홈 화면 패치 탭에 노출됩니다."
                onBack={onBack}
            />

            <div
                className="sticky top-0 z-20 -mx-1 border-b border-color/40 bg-primary/95 px-1 pb-3 pt-0 backdrop-blur-md"
                role="tablist"
                aria-label="홈 게시판 구분"
            >
                <div className="flex gap-1.5 overflow-x-auto pb-0.5 [-webkit-overflow-scrolling:touch]">
                    {tabItems.map((tab) => {
                        const active = listTab === tab.id;
                        return (
                            <button
                                key={tab.id}
                                type="button"
                                role="tab"
                                aria-selected={active}
                                onClick={() => {
                                    setListTab(tab.id);
                                    if (isCreating || editingPost) handleCancel();
                                }}
                                className={`shrink-0 rounded-xl border px-3.5 py-2.5 text-left transition-all sm:min-w-[8.5rem] ${
                                    active
                                        ? 'border-amber-400/50 bg-amber-500/15 text-amber-100 shadow-inner'
                                        : 'border-color/50 bg-secondary/40 text-gray-400 hover:border-color hover:bg-secondary/60 hover:text-primary'
                                }`}
                            >
                                <span className="block text-xs font-semibold sm:text-sm">{tab.label}</span>
                                <span className="mt-0.5 block text-[10px] opacity-80 sm:text-[11px]">{tab.count}건 · {tab.hint}</span>
                            </button>
                        );
                    })}
                </div>
            </div>

            <div className={`min-h-[12rem] ${adminSectionGap}`} role="tabpanel">
                {editorCard}
                {listTab === 'notice' && listCardForTab('notice')}
                {listTab === 'patch' && listCardForTab('patch')}
            </div>
        </div>
    );
};

export default HomeBoardPanel;
