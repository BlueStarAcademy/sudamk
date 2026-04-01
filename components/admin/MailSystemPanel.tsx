
import React, { useState, useMemo, useRef } from 'react';
import { ServerAction, AdminProps, InventoryItemType, User } from '../../types/index.js';
import type { EquipmentSlot, ItemGrade } from '../../types/enums.js';
import { MythicStat } from '../../types/enums.js';
import DraggableWindow from '../DraggableWindow.js';
import Button from '../Button.js';
import { PortalHoverBubble } from '../PortalHoverBubble.js';
import { getApiUrl } from '../../utils/apiConfig.js';
import {
    EQUIPMENT_POOL,
    CONSUMABLE_ITEMS,
    MATERIAL_ITEMS,
    MAIN_STAT_DEFINITIONS,
    GRADE_SUB_OPTION_RULES,
    SUB_OPTION_POOLS,
    SPECIAL_STATS_DATA,
    MYTHIC_STATS_DATA,
    GRADE_LEVEL_REQUIREMENTS,
    CORE_STATS_DATA,
    gradeBackgrounds,
    gradeStyles,
} from '../../constants';

export type MailAttachedItemPayload = {
    name: string;
    quantity: number;
    type: InventoryItemType;
    /** 장비만: 강화 단계 +0 ~ +10 (주옵션 누적 보너스 적용) */
    stars?: number;
};

/** EQUIPMENT_POOL 원본 이름은 유지하고, UI에서만 괄호 접미사 제거 */
const DOUBLE_MYTHIC_NAME_SUFFIX = ' (더블신화)';

function stripDoubleMythicDisplayName(name: string): string {
    if (name.endsWith(DOUBLE_MYTHIC_NAME_SUFFIX)) {
        return name.slice(0, -DOUBLE_MYTHIC_NAME_SUFFIX.length);
    }
    return name;
}

function isDoubleMythicEquipmentName(name: string): boolean {
    return name.endsWith(DOUBLE_MYTHIC_NAME_SUFFIX);
}

function isDoubleMythicPoolItem(item: { type?: string; name: string; isDivineMythic?: boolean }): boolean {
    if (item.type !== 'equipment') return false;
    return !!item.isDivineMythic || isDoubleMythicEquipmentName(item.name);
}

function buildEquipmentAdminTooltip(slot: EquipmentSlot, grade: ItemGrade, description: string): string {
    const rules = GRADE_SUB_OPTION_RULES[grade];
    const formatCount = (count: [number, number]) => (count[0] === count[1] ? `${count[0]}` : `${count[0]}~${count[1]}`);
    const combatPool = SUB_OPTION_POOLS[slot]?.[rules.combatTier] ?? [];
    const mainStatDef = MAIN_STAT_DEFINITIONS[slot];
    const mainStatGradeDef = mainStatDef.options[grade];
    const mainStatNames = mainStatGradeDef.stats.map((s) => CORE_STATS_DATA[s]?.name ?? s).join(' 또는 ');
    const lines: string[] = [];
    lines.push(description);
    lines.push('');
    lines.push(`착용 요구: 전략·놀이 레벨 합 ${GRADE_LEVEL_REQUIREMENTS[grade]}`);
    lines.push('');
    lines.push(`[주옵션] ${mainStatNames}: +${mainStatGradeDef.value}${mainStatDef.isPercentage ? '%' : ''} (획득 시 위 중 하나 랜덤)`);
    lines.push(`[부옵션] 랜덤 ${formatCount(rules.combatCount)}개 — 후보·범위:`);
    for (const opt of combatPool) {
        const label = CORE_STATS_DATA[opt.type]?.name ?? opt.type;
        lines.push(`  · ${label} +${opt.range[0]}~${opt.range[1]}${opt.isPercentage ? '%' : ''}`);
    }
    lines.push(`[특수 옵션] 랜덤 ${formatCount(rules.specialCount)}개 — 후보·범위:`);
    for (const def of Object.values(SPECIAL_STATS_DATA)) {
        lines.push(`  · ${def.name} +${def.range[0]}~${def.range[1]}${def.isPercentage ? '%' : ''}`);
    }
    if (rules.mythicCount[0] > 0) {
        lines.push(`[신화 옵션] 랜덤 ${formatCount(rules.mythicCount)}개 — 후보:`);
        for (const stat of Object.values(MythicStat)) {
            const data = MYTHIC_STATS_DATA[stat];
            lines.push(`  · ${data.name}: ${data.description}`);
        }
    }
    lines.push('');
    lines.push('※ 실제 옵션·수치는 획득 시 랜덤입니다. 강화(+N)는 주옵션 누적 보너스만 반영됩니다.');
    return lines.join('\n');
}

interface ItemSelectionModalProps {
    onAddItem: (item: MailAttachedItemPayload) => void;
    onClose: () => void;
}

const ItemSelectionModal: React.FC<ItemSelectionModalProps> = ({ onAddItem, onClose }) => {
    type ItemTab = 'equipment' | 'consumable' | 'material';
    const [activeTab, setActiveTab] = useState<ItemTab>('equipment');
    const [selectedItem, setSelectedItem] = useState<{ name: string; type: InventoryItemType } | null>(null);
    const [quantity, setQuantity] = useState(1);
    const [equipmentEnhanceStars, setEquipmentEnhanceStars] = useState(0);
    const itemTooltipAnchorRef = useRef<HTMLElement | null>(null);
    const [itemTooltipText, setItemTooltipText] = useState<string | null>(null);

    const itemsForTab = useMemo(() => {
        switch (activeTab) {
            case 'equipment': return EQUIPMENT_POOL;
            case 'consumable': return CONSUMABLE_ITEMS;
            case 'material': return Object.values(MATERIAL_ITEMS);
            default: return [];
        }
    }, [activeTab]);

    const setTab = (tab: ItemTab) => {
        setActiveTab(tab);
        setSelectedItem(null);
        setEquipmentEnhanceStars(0);
    };

    const handleAddItem = () => {
        if (selectedItem && quantity > 0) {
            const payload: MailAttachedItemPayload = { ...selectedItem, quantity };
            if (selectedItem.type === 'equipment') {
                payload.stars = Math.max(0, Math.min(10, Math.floor(equipmentEnhanceStars) || 0));
            }
            onAddItem(payload);
            setSelectedItem(null);
            setQuantity(1);
            setEquipmentEnhanceStars(0);
        }
    };

    const clearItemTooltip = () => {
        setItemTooltipText(null);
        itemTooltipAnchorRef.current = null;
    };

    return (
        <DraggableWindow title="아이템 첨부" onClose={onClose} windowId="mail-item-selection" initialWidth={600}>
            <PortalHoverBubble
                show={itemTooltipText !== null}
                anchorRef={itemTooltipAnchorRef}
                placement="top"
                className="pointer-events-none w-[min(24rem,calc(100vw-2rem))] max-h-[min(70vh,26rem)] overflow-y-auto whitespace-pre-wrap rounded-lg border border-color bg-gray-950/95 px-3 py-2 text-left text-[11px] leading-relaxed text-gray-100 shadow-xl backdrop-blur-sm"
            >
                {itemTooltipText}
            </PortalHoverBubble>
            <div className="h-[60vh] flex flex-col">
                <div className="flex bg-tertiary/70 p-1 rounded-lg mb-4 flex-shrink-0">
                    <button type="button" onClick={() => setTab('equipment')} className={`flex-1 py-2 text-sm font-semibold rounded-md ${activeTab === 'equipment' ? 'bg-accent' : 'text-tertiary'}`}>장비</button>
                    <button type="button" onClick={() => setTab('consumable')} className={`flex-1 py-2 text-sm font-semibold rounded-md ${activeTab === 'consumable' ? 'bg-accent' : 'text-tertiary'}`}>소모품</button>
                    <button type="button" onClick={() => setTab('material')} className={`flex-1 py-2 text-sm font-semibold rounded-md ${activeTab === 'material' ? 'bg-accent' : 'text-tertiary'}`}>재료</button>
                </div>
                <div className="flex-grow overflow-y-auto pr-2 grid grid-cols-4 gap-2">
                    {itemsForTab.map(item => (
                        <div
                            key={item.name}
                            onClick={() => {
                                setSelectedItem({ name: item.name, type: item.type });
                                if (item.type !== 'equipment') setEquipmentEnhanceStars(0);
                            }}
                            onMouseEnter={(e) => {
                                itemTooltipAnchorRef.current = e.currentTarget;
                                if (item.type === 'equipment' && item.slot) {
                                    setItemTooltipText(buildEquipmentAdminTooltip(item.slot, item.grade, item.description || item.name));
                                } else {
                                    setItemTooltipText(item.description || item.name);
                                }
                            }}
                            onMouseLeave={clearItemTooltip}
                            className={`p-2 rounded-lg border-2 ${selectedItem?.name === item.name ? 'border-accent ring-2 ring-accent' : 'border-color bg-secondary/50'} cursor-pointer flex flex-col items-center min-w-0`}
                        >
                            {item.type === 'equipment' ? (
                                <>
                                    <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-lg ring-1 ring-black/25 dark:ring-white/20">
                                        <img
                                            src={gradeBackgrounds[item.grade]}
                                            alt=""
                                            className="absolute inset-0 h-full w-full object-cover"
                                            aria-hidden
                                        />
                                        <img
                                            src={item.image!}
                                            alt=""
                                            className="absolute left-1/2 top-1/2 h-[85%] w-[85%] -translate-x-1/2 -translate-y-1/2 object-contain drop-shadow-md pointer-events-none"
                                            aria-hidden
                                        />
                                        {isDoubleMythicPoolItem(item as { type: string; name: string; isDivineMythic?: boolean }) ? (
                                            <span
                                                className="absolute bottom-0.5 left-0.5 z-10 flex h-[1.125rem] w-[1.125rem] items-center justify-center rounded border border-amber-300/70 bg-gradient-to-br from-amber-950/95 to-black/90 text-[9px] font-black leading-none text-amber-200 shadow-md"
                                                title="더블신화 (D)"
                                                aria-hidden
                                            >
                                                D
                                            </span>
                                        ) : null}
                                    </div>
                                    <span className={`mt-1 text-[10px] font-bold leading-none ${gradeStyles[item.grade].color}`}>
                                        {gradeStyles[item.grade].name}
                                    </span>
                                    <span className="mt-0.5 line-clamp-2 w-full text-center text-[11px] leading-tight text-primary">
                                        {stripDoubleMythicDisplayName(item.name)}
                                    </span>
                                </>
                            ) : (
                                <>
                                    <img src={item.image!} alt={item.name} className="h-16 w-16 shrink-0 object-contain" />
                                    <span className="mt-1 line-clamp-2 text-center text-xs">{item.name}</span>
                                </>
                            )}
                        </div>
                    ))}
                </div>
                <div className="flex-shrink-0 mt-4 pt-4 border-t border-color flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                    <div className="flex flex-wrap items-center gap-3">
                        <div>
                            <label className="text-xs text-gray-400">수량</label>
                            <input type="number" min={1} value={quantity} onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value, 10) || 1))} className="bg-tertiary w-20 p-1.5 rounded block mt-0.5" />
                        </div>
                        {activeTab === 'equipment' && (
                            <div>
                                <label className="text-xs text-gray-400">강화 (+0~+10)</label>
                                <input
                                    type="number"
                                    min={0}
                                    max={10}
                                    value={equipmentEnhanceStars}
                                    onChange={(e) => setEquipmentEnhanceStars(Math.max(0, Math.min(10, parseInt(e.target.value, 10) || 0)))}
                                    className="bg-tertiary w-20 p-1.5 rounded block mt-0.5"
                                />
                            </div>
                        )}
                    </div>
                    <Button onClick={handleAddItem} disabled={!selectedItem}>선택 아이템 추가</Button>
                </div>
            </div>
        </DraggableWindow>
    );
};


// FIX: Add missing props to the interface as they are used in the component.
interface MailSystemPanelProps extends AdminProps {
    allUsers: User[];
    onAction: (action: ServerAction) => void;
    onBack: () => void;
}

const MailSystemPanel: React.FC<MailSystemPanelProps> = ({ allUsers: _allUsers, currentUser, onAction, onBack }) => {
    const [targetType, setTargetType] = useState<'all' | 'specific'>('all');
    const [targetSearchQuery, setTargetSearchQuery] = useState('');
    const [title, setTitle] = useState('');
    const [message, setMessage] = useState('');
    const [gold, setGold] = useState(0);
    const [diamonds, setDiamonds] = useState(0);
    const [actionPoints, setActionPoints] = useState(0);
    const [expiresInDays, setExpiresInDays] = useState(7);
    const [searchResults, setSearchResults] = useState<User[]>([]);
    /** 검색을 바꿔도 유지되는 수신자 목록 (id 기준 중복 없음) */
    const [selectedRecipients, setSelectedRecipients] = useState<User[]>([]);
    const [isSearchingUsers, setIsSearchingUsers] = useState(false);
    const [searchError, setSearchError] = useState<string | null>(null);
    const [isItemModalOpen, setIsItemModalOpen] = useState(false);
    const [attachedItems, setAttachedItems] = useState<MailAttachedItemPayload[]>([]);

    const fetchAdminUsers = async (trimmedQuery: string): Promise<User[]> => {
        const candidates = [getApiUrl('/api/admin/users'), getApiUrl('/admin/users')];
        let lastError: Error | null = null;

        for (const url of candidates) {
            try {
                const response = await fetch(
                    `${url}?userId=${encodeURIComponent(currentUser.id)}&query=${encodeURIComponent(trimmedQuery)}&limit=50`,
                    { credentials: 'include' }
                );
                const raw = await response.text();
                if (raw.trim().startsWith('<!DOCTYPE') || raw.trim().startsWith('<html')) {
                    throw new Error('API 대신 HTML 응답이 반환되었습니다.');
                }
                const data = raw ? JSON.parse(raw) : {};
                if (!response.ok) {
                    throw new Error(data?.message || data?.error || '사용자 검색에 실패했습니다.');
                }
                return Array.isArray(data.users) ? data.users : [];
            } catch (err: any) {
                lastError = err instanceof Error ? err : new Error(String(err));
            }
        }

        throw lastError ?? new Error('사용자 검색에 실패했습니다.');
    };

    const handleSearchChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const query = e.target.value;
        setTargetSearchQuery(query);
        setSearchError(null);

        if (query.trim().length < 1) {
            setSearchResults([]);
            return;
        }

        setIsSearchingUsers(true);
        try {
            const users = await fetchAdminUsers(query.trim());
            setSearchResults(users);
        } catch (err: any) {
            console.error('[MailSystemPanel] Failed to search users:', err);
            setSearchResults([]);
            setSearchError(err?.message || '검색 중 오류가 발생했습니다.');
        } finally {
            setIsSearchingUsers(false);
        }
    };

    const selectedRecipientIds = useMemo(() => new Set(selectedRecipients.map((u) => u.id)), [selectedRecipients]);

    const addRecipient = (u: User) => {
        setSelectedRecipients((prev) => (prev.some((x) => x.id === u.id) ? prev : [...prev, u]));
    };

    const removeRecipient = (userId: string) => {
        setSelectedRecipients((prev) => prev.filter((x) => x.id !== userId));
    };

    const addAllSearchResultsToRecipients = () => {
        setSelectedRecipients((prev) => {
            const ids = new Set(prev.map((x) => x.id));
            const merged = [...prev];
            for (const u of searchResults) {
                if (!ids.has(u.id)) {
                    ids.add(u.id);
                    merged.push(u);
                }
            }
            return merged;
        });
    };
    
    const handleSendMail = (e: React.FormEvent) => {
        e.preventDefault();
        if (!title.trim() || !message.trim()) {
            alert('제목과 메시지를 모두 입력해주세요.');
            return;
        }
        if (targetType === 'specific' && selectedRecipients.length === 0) {
            alert('특정 사용자 발송 시 수신자를 최소 1명 추가해주세요.');
            return;
        }

        onAction({
            type: 'ADMIN_SEND_MAIL',
            payload: {
                targetSpecifier: targetType === 'all' ? 'all' : '',
                targetUserIds: targetType === 'all' ? undefined : selectedRecipients.map((u) => u.id),
                title,
                message,
                expiresInDays,
                attachments: { gold, diamonds, actionPoints, items: attachedItems }
            }
        });

        setTitle('');
        setMessage('');
        setGold(0);
        setDiamonds(0);
        setActionPoints(0);
        setExpiresInDays(7);
        setTargetSearchQuery('');
        setSearchResults([]);
        setSelectedRecipients([]);
        setAttachedItems([]);
    };

    const panelShell =
        'bg-panel border border-color rounded-lg shadow-lg text-on-panel flex flex-col min-h-[min(720px,calc(100vh-10rem))] xl:h-[min(720px,calc(100vh-10rem))]';

    return (
        <div className="max-w-[1800px] mx-auto px-3 bg-primary text-primary pb-10">
            {isItemModalOpen && <ItemSelectionModal onClose={() => setIsItemModalOpen(false)} onAddItem={(item) => setAttachedItems(prev => [...prev, item])} />}
            <header className="flex justify-between items-center mb-6">
                <h1 className="text-2xl sm:text-3xl font-bold">우편 발송 시스템</h1>
                <button type="button" onClick={onBack} className="p-0 flex items-center justify-center w-10 h-10 rounded-full transition-all duration-100 active:shadow-inner active:scale-95 active:translate-y-0.5">
                    <img src="/images/button/back.png" alt="Back" className="w-10 h-10 sm:w-12 sm:h-12" />
                </button>
            </header>

            <form onSubmit={handleSendMail} className="text-sm">
                <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 xl:gap-6 items-stretch">
                {/* 받는 사람 전용 패널 — 높이·스크롤 영역 고정 */}
                <div className={`${panelShell} p-5`}>
                    <h2 className="text-lg font-semibold text-primary border-b border-color pb-2 mb-4 shrink-0">받는 사람</h2>
                    <div className="flex flex-wrap gap-x-4 gap-y-2 shrink-0">
                        <label className="flex items-center cursor-pointer">
                            <input type="radio" name="targetType" value="all" checked={targetType === 'all'} onChange={() => setTargetType('all')} className="mr-2" />
                            전체 사용자
                        </label>
                        <label className="flex items-center cursor-pointer">
                            <input type="radio" name="targetType" value="specific" checked={targetType === 'specific'} onChange={() => setTargetType('specific')} className="mr-2" />
                            특정 사용자
                        </label>
                    </div>

                    {targetType === 'all' && (
                        <p className="mt-6 text-sm text-gray-400 leading-relaxed">
                            로그인한 모든 유저에게 동일한 우편이 발송됩니다. 내용·보상은 가운데 패널, 아이템은 오른쪽 패널에서 설정하세요.
                        </p>
                    )}

                    {targetType === 'specific' && (
                        <div className="mt-4 flex flex-col gap-4 flex-1 min-h-0">
                            <div className="shrink-0 space-y-2">
                                <label className="block font-medium text-secondary">닉네임 또는 아이디 검색</label>
                                <input
                                    type="text"
                                    value={targetSearchQuery}
                                    onChange={handleSearchChange}
                                    className="bg-secondary border border-color text-primary rounded-lg block w-full p-2.5"
                                    placeholder="검색 후 「선택」으로 추가"
                                />
                                <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-gray-400">
                                    <span>{isSearchingUsers ? '검색 중...' : `검색 결과 ${searchResults.length}명`}</span>
                                    {searchResults.length > 0 && (
                                        <button type="button" onClick={addAllSearchResultsToRecipients} className="text-blue-400 hover:underline">
                                            현재 결과 전원 추가
                                        </button>
                                    )}
                                </div>
                                {searchError && <p className="text-xs text-red-400">{searchError}</p>}
                            </div>

                            <div className="shrink-0">
                                <div className="text-xs font-medium text-secondary mb-1">검색 결과</div>
                                <div className="h-44 overflow-y-auto bg-secondary/40 border border-color rounded-lg">
                                    {searchResults.length === 0 ? (
                                        <p className="px-3 py-4 text-xs text-gray-400">
                                            {targetSearchQuery.trim().length < 1 ? '검색어를 입력하세요.' : '결과 없음'}
                                        </p>
                                    ) : (
                                        <ul>
                                            {searchResults.map((user) => {
                                                const already = selectedRecipientIds.has(user.id);
                                                return (
                                                    <li key={user.id} className="px-3 py-2 border-b border-color/50 last:border-b-0 flex items-center justify-between gap-2">
                                                        <div className="min-w-0">
                                                            <span className="font-medium">{user.nickname}</span>
                                                            <span className="text-xs text-gray-400 ml-1">({user.username ?? '—'})</span>
                                                        </div>
                                                        <button
                                                            type="button"
                                                            disabled={already}
                                                            onClick={() => addRecipient(user)}
                                                            className={`shrink-0 text-xs px-2 py-1 rounded ${already ? 'bg-tertiary text-gray-500 cursor-default' : 'bg-accent text-primary hover:opacity-90'}`}
                                                        >
                                                            {already ? '추가됨' : '선택'}
                                                        </button>
                                                    </li>
                                                );
                                            })}
                                        </ul>
                                    )}
                                </div>
                            </div>

                            <div className="flex-1 flex flex-col min-h-0">
                                <div className="flex items-center justify-between gap-2 mb-1 shrink-0">
                                    <span className="text-xs font-medium text-secondary">선택된 수신자 ({selectedRecipients.length}명)</span>
                                    {selectedRecipients.length > 0 && (
                                        <button type="button" className="text-xs text-red-400 hover:underline" onClick={() => setSelectedRecipients([])}>
                                            전체 비우기
                                        </button>
                                    )}
                                </div>
                                <p className="text-[11px] text-gray-500 mb-2 shrink-0">검색어를 바꿔도 이 목록은 유지됩니다.</p>
                                <div className="flex-1 min-h-0 h-52 xl:h-56 overflow-y-auto bg-tertiary/30 border border-color rounded-lg">
                                    {selectedRecipients.length === 0 ? (
                                        <p className="px-3 py-8 text-xs text-gray-400 text-center">위 목록에서 「선택」으로 추가하세요.</p>
                                    ) : (
                                        <ul>
                                            {selectedRecipients.map((u) => (
                                                <li key={u.id} className="px-3 py-2 border-b border-color/50 last:border-b-0 flex items-center justify-between gap-2">
                                                    <div className="min-w-0">
                                                        <span className="font-medium">{u.nickname}</span>
                                                        <span className="text-xs text-gray-400 ml-1">({u.username ?? '—'})</span>
                                                    </div>
                                                    <button type="button" onClick={() => removeRecipient(u.id)} className="shrink-0 text-xs text-red-400 hover:text-red-300 px-2">
                                                        제거
                                                    </button>
                                                </li>
                                            ))}
                                        </ul>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* 우편 내용 · 보상 (텍스트·통화만) */}
                <div className={`${panelShell} p-5`}>
                    <h2 className="text-lg font-semibold text-primary border-b border-color pb-2 mb-4 shrink-0">우편 내용 · 보상</h2>
                    <div className="flex-1 min-h-0 overflow-y-auto space-y-4 pr-1">
                        <div>
                            <label className="block mb-1 font-medium text-secondary">제목</label>
                            <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} required className="bg-secondary border border-color text-primary rounded-lg block w-full p-2.5" />
                        </div>
                        <div>
                            <label className="block mb-1 font-medium text-secondary">메시지</label>
                            <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={6} required className="bg-secondary border border-color text-primary rounded-lg block w-full p-2.5 resize-y min-h-[120px]" />
                        </div>
                        <div>
                            <label className="block mb-1 font-medium text-secondary">수령 제한일 (0일 = 무제한)</label>
                            <input type="number" min="0" value={expiresInDays} onChange={(e) => setExpiresInDays(parseInt(e.target.value, 10) || 0)} className="bg-secondary border border-color text-primary rounded-lg block w-full p-2.5" />
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            <div>
                                <label className="block mb-1 font-medium text-secondary">⚡ 행동력</label>
                                <input type="number" min="0" value={actionPoints} onChange={(e) => setActionPoints(parseInt(e.target.value, 10) || 0)} className="bg-secondary border border-color text-primary rounded-lg block w-full p-2.5" />
                            </div>
                            <div>
                                <label className="flex items-center gap-1 mb-1 font-medium text-secondary">
                                    <img src="/images/icon/Gold.png" alt="골드" className="w-4 h-4 object-contain" />
                                    골드
                                </label>
                                <input type="number" min="0" value={gold} onChange={(e) => setGold(parseInt(e.target.value, 10) || 0)} className="bg-secondary border border-color text-primary rounded-lg block w-full p-2.5" />
                            </div>
                            <div>
                                <label className="flex items-center gap-1 mb-1 font-medium text-secondary">
                                    <img src="/images/icon/Zem.png" alt="다이아" className="w-4 h-4 object-contain" />
                                    다이아
                                </label>
                                <input type="number" min="0" value={diamonds} onChange={(e) => setDiamonds(parseInt(e.target.value, 10) || 0)} className="bg-secondary border border-color text-primary rounded-lg block w-full p-2.5" />
                            </div>
                        </div>
                    </div>
                </div>

                {/* 첨부 아이템 전용 패널 */}
                <div className={`${panelShell} p-5`}>
                    <h2 className="text-lg font-semibold text-primary border-b border-color pb-2 mb-4 shrink-0">첨부 아이템</h2>
                    <p className="text-xs text-gray-500 mb-3 shrink-0">모달에서 장비·소모품·재료를 고른 뒤 목록에 쌓입니다.</p>
                    <Button type="button" onClick={() => setIsItemModalOpen(true)} colorScheme="blue" className="w-full py-2.5 shrink-0 mb-3">
                        아이템 첨부 열기
                    </Button>
                    <div className="text-xs font-medium text-secondary mb-2 shrink-0">첨부 목록 ({attachedItems.length}개)</div>
                    <div className="h-56 overflow-y-auto bg-tertiary/50 border border-color rounded-lg p-2 space-y-1 xl:h-auto xl:flex-1 xl:min-h-0">
                        {attachedItems.map((item, index) => (
                            <div key={index} className="flex justify-between items-center bg-primary/50 p-2 rounded text-xs gap-2">
                                <span className="flex min-w-0 items-center gap-1.5 truncate">
                                    {item.type === 'equipment' && isDoubleMythicEquipmentName(item.name) ? (
                                        <span
                                            className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded border border-amber-400/55 bg-gradient-to-br from-amber-950/95 to-black/90 text-[8px] font-black text-amber-200"
                                            title="더블신화"
                                        >
                                            D
                                        </span>
                                    ) : null}
                                    <span className="min-w-0 truncate">
                                        {stripDoubleMythicDisplayName(item.name)} × {item.quantity}
                                        {item.type === 'equipment' && item.stars != null && item.stars > 0 ? (
                                            <span className="text-amber-400/90 font-medium"> +{item.stars}</span>
                                        ) : null}{' '}
                                        <span className="text-gray-500">({item.type})</span>
                                    </span>
                                </span>
                                <button type="button" onClick={() => setAttachedItems((prev) => prev.filter((_, i) => i !== index))} className="text-red-500 hover:text-red-400 font-bold px-2 shrink-0">
                                    X
                                </button>
                            </div>
                        ))}
                        {attachedItems.length === 0 && <p className="text-tertiary text-center text-xs py-10">첨부된 아이템이 없습니다.</p>}
                    </div>
                </div>
                </div>

                <div className="mt-8 pt-2 border-t border-color/60 max-w-2xl mx-auto xl:max-w-none">
                    <Button type="submit" className="w-full py-3.5 text-base" colorScheme="green">
                        발송하기
                    </Button>
                </div>
            </form>
        </div>
    );
};

export default MailSystemPanel;