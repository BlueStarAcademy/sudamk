
import React, { useState, useMemo, useRef } from 'react';
import { ServerAction, AdminProps, InventoryItemType, User } from '../../types/index.js';
import { ItemGrade, type MythicStat, type EquipmentSlot } from '../../types/enums.js';
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
import AdminPageHeader from './AdminPageHeader.js';
import { adminCard, adminCardTitle, adminInput, adminPageWide, adminSectionGap } from './adminChrome.js';
import {
    MYTHIC_GRADE_SPECIAL_OPTION_STATS,
    TRANSCENDENT_GRADE_SPECIAL_OPTION_STATS,
} from '../../shared/utils/specialOptionGearEffects.js';

export type MailAttachedItemPayload = {
    name: string;
    quantity: number;
    type: InventoryItemType;
    /** 장비만: 강화 단계 +0 ~ +10 (주옵션 누적 보너스 적용) */
    stars?: number;
    /** 장비: 동일 표시 이름의 신화/초월 등 구분 (EQUIPMENT_POOL 템플릿 매칭용) */
    grade?: ItemGrade;
};

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
        lines.push(`[스페셜 옵션] 랜덤 ${formatCount(rules.mythicCount)}개 — 후보:`);
        const pushPool = (label: string, pool: readonly MythicStat[]) => {
            lines.push(`  (${label})`);
            for (const stat of pool) {
                const data = MYTHIC_STATS_DATA[stat];
                lines.push(`    · ${data.name}: ${data.description}`);
            }
        };
        if (grade === ItemGrade.Mythic) {
            pushPool('신화 등급', MYTHIC_GRADE_SPECIAL_OPTION_STATS);
        } else if (grade === ItemGrade.Transcendent) {
            pushPool('초월 등급', TRANSCENDENT_GRADE_SPECIAL_OPTION_STATS);
        } else {
            pushPool('신화 등급', MYTHIC_GRADE_SPECIAL_OPTION_STATS);
            pushPool('초월 등급', TRANSCENDENT_GRADE_SPECIAL_OPTION_STATS);
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

type ModalSelectedItem = { name: string; type: InventoryItemType; grade?: ItemGrade };

function isMailModalItemSelected(
    selected: ModalSelectedItem | null,
    item: { name: string; type: InventoryItemType; grade?: ItemGrade }
): boolean {
    if (!selected || selected.name !== item.name || selected.type !== item.type) return false;
    if (item.type === 'equipment') return selected.grade === item.grade;
    return true;
}

const ItemSelectionModal: React.FC<ItemSelectionModalProps> = ({ onAddItem, onClose }) => {
    type ItemTab = 'equipment' | 'consumable' | 'material';
    const [activeTab, setActiveTab] = useState<ItemTab>('equipment');
    const [selectedItem, setSelectedItem] = useState<ModalSelectedItem | null>(null);
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
                            key={item.type === 'equipment' ? `${item.name}::${item.grade}` : item.name}
                            onClick={() => {
                                setSelectedItem({
                                    name: item.name,
                                    type: item.type,
                                    ...(item.type === 'equipment' ? { grade: item.grade } : {}),
                                });
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
                            className={`p-2 rounded-lg border-2 ${isMailModalItemSelected(selectedItem, item) ? 'border-accent ring-2 ring-accent' : 'border-color bg-secondary/50'} cursor-pointer flex flex-col items-center min-w-0`}
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
                                    </div>
                                    <span className={`mt-1 text-[10px] font-bold leading-none ${gradeStyles[item.grade].color}`}>
                                        {gradeStyles[item.grade].name}
                                    </span>
                                    <span className="mt-0.5 line-clamp-2 w-full text-center text-[11px] leading-tight text-primary">
                                        {item.name}
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
    /** 모바일·태블릿: 단계별 화면 (데스크톱 xl+ 에서는 3열 그리드) */
    const [mobileStep, setMobileStep] = useState<1 | 2 | 3>(1);

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
        setMobileStep(1);
    };

    const panelShell = `${adminCard} flex min-h-[min(720px,calc(100vh-10rem))] flex-col text-on-panel xl:h-[min(720px,calc(100vh-10rem))]`;
    const mobileStepShell = `${adminCard} flex min-h-[12rem] max-h-[calc(100dvh-12.5rem)] flex-col overflow-hidden p-5 text-on-panel sm:max-h-[calc(100dvh-11rem)]`;

    const mailFormId = 'admin-mail-send-form';

    const recipientsInner = (
        <>
            <h2 className={`${adminCardTitle} shrink-0`}>받는 사람</h2>
            <div className="flex shrink-0 flex-wrap gap-x-4 gap-y-2">
                <label className="flex cursor-pointer items-center">
                    <input type="radio" name="targetType" value="all" checked={targetType === 'all'} onChange={() => setTargetType('all')} className="mr-2" />
                    전체 사용자
                </label>
                <label className="flex cursor-pointer items-center">
                    <input type="radio" name="targetType" value="specific" checked={targetType === 'specific'} onChange={() => setTargetType('specific')} className="mr-2" />
                    특정 사용자
                </label>
            </div>

            {targetType === 'all' && (
                <p className="mt-6 text-sm leading-relaxed text-gray-400">
                    로그인한 모든 유저에게 동일한 우편이 발송됩니다. 아래 단계에서 내용·보상·첨부를 설정한 뒤 하단에서 발송하세요.
                </p>
            )}

            {targetType === 'specific' && (
                <div className="mt-4 flex min-h-0 flex-1 flex-col gap-4">
                    <div className="shrink-0 space-y-2">
                        <label className="block font-medium text-secondary">닉네임 또는 아이디 검색</label>
                        <input
                            type="text"
                            value={targetSearchQuery}
                            onChange={handleSearchChange}
                            className={adminInput}
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
                        <div className="mb-1 text-xs font-medium text-secondary">검색 결과</div>
                        <div className="h-40 overflow-y-auto rounded-lg border border-color bg-secondary/40 sm:h-44">
                            {searchResults.length === 0 ? (
                                <p className="px-3 py-4 text-xs text-gray-400">
                                    {targetSearchQuery.trim().length < 1 ? '검색어를 입력하세요.' : '결과 없음'}
                                </p>
                            ) : (
                                <ul>
                                    {searchResults.map((user) => {
                                        const already = selectedRecipientIds.has(user.id);
                                        return (
                                            <li key={user.id} className="flex items-center justify-between gap-2 border-b border-color/50 px-3 py-2 last:border-b-0">
                                                <div className="min-w-0">
                                                    <span className="font-medium">{user.nickname}</span>
                                                    <span className="ml-1 text-xs text-gray-400">({user.username ?? '—'})</span>
                                                </div>
                                                <button
                                                    type="button"
                                                    disabled={already}
                                                    onClick={() => addRecipient(user)}
                                                    className={`shrink-0 rounded px-2 py-1 text-xs ${already ? 'cursor-default bg-tertiary text-gray-500' : 'bg-accent text-primary hover:opacity-90'}`}
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

                    <div className="flex min-h-0 flex-1 flex-col">
                        <div className="mb-1 flex shrink-0 items-center justify-between gap-2">
                            <span className="text-xs font-medium text-secondary">선택된 수신자 ({selectedRecipients.length}명)</span>
                            {selectedRecipients.length > 0 && (
                                <button type="button" className="text-xs text-red-400 hover:underline" onClick={() => setSelectedRecipients([])}>
                                    전체 비우기
                                </button>
                            )}
                        </div>
                        <p className="mb-2 shrink-0 text-[11px] text-gray-500">검색어를 바꿔도 이 목록은 유지됩니다.</p>
                        <div className="min-h-[10rem] flex-1 overflow-y-auto rounded-lg border border-color bg-tertiary/30 xl:h-56">
                            {selectedRecipients.length === 0 ? (
                                <p className="px-3 py-8 text-center text-xs text-gray-400">위 목록에서 「선택」으로 추가하세요.</p>
                            ) : (
                                <ul>
                                    {selectedRecipients.map((u) => (
                                        <li key={u.id} className="flex items-center justify-between gap-2 border-b border-color/50 px-3 py-2 last:border-b-0">
                                            <div className="min-w-0">
                                                <span className="font-medium">{u.nickname}</span>
                                                <span className="ml-1 text-xs text-gray-400">({u.username ?? '—'})</span>
                                            </div>
                                            <button type="button" onClick={() => removeRecipient(u.id)} className="shrink-0 px-2 text-xs text-red-400 hover:text-red-300">
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
        </>
    );

    const contentRewardsInner = (
        <>
            <h2 className={`${adminCardTitle} shrink-0`}>우편 내용 · 보상</h2>
            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto pr-1">
                <div>
                    <label className="mb-1 block font-medium text-secondary">제목</label>
                    <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} required className={adminInput} />
                </div>
                <div>
                    <label className="mb-1 block font-medium text-secondary">메시지</label>
                    <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={6} required className={`${adminInput} min-h-[120px] resize-y`} />
                </div>
                <div>
                    <label className="mb-1 block font-medium text-secondary">수령 제한일 (0일 = 무제한)</label>
                    <input type="number" min="0" value={expiresInDays} onChange={(e) => setExpiresInDays(parseInt(e.target.value, 10) || 0)} className={adminInput} />
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <div>
                        <label className="mb-1 block font-medium text-secondary">⚡ 행동력</label>
                        <input type="number" min="0" value={actionPoints} onChange={(e) => setActionPoints(parseInt(e.target.value, 10) || 0)} className={adminInput} />
                    </div>
                    <div>
                        <label className="mb-1 flex items-center gap-1 font-medium text-secondary">
                            <img src="/images/icon/Gold.png" alt="골드" className="h-4 w-4 object-contain" />
                            골드
                        </label>
                        <input type="number" min="0" value={gold} onChange={(e) => setGold(parseInt(e.target.value, 10) || 0)} className={adminInput} />
                    </div>
                    <div>
                        <label className="mb-1 flex items-center gap-1 font-medium text-secondary">
                            <img src="/images/icon/Zem.png" alt="다이아" className="h-4 w-4 object-contain" />
                            다이아
                        </label>
                        <input type="number" min="0" value={diamonds} onChange={(e) => setDiamonds(parseInt(e.target.value, 10) || 0)} className={adminInput} />
                    </div>
                </div>
            </div>
        </>
    );

    const attachedItemsInner = (
        <>
            <h2 className={`${adminCardTitle} shrink-0`}>첨부 아이템</h2>
            <p className="mb-3 shrink-0 text-xs text-gray-500">모달에서 장비·소모품·재료를 고른 뒤 목록에 쌓입니다.</p>
            <Button type="button" onClick={() => setIsItemModalOpen(true)} colorScheme="blue" className="mb-3 w-full shrink-0 py-2.5">
                아이템 첨부 열기
            </Button>
            <div className="mb-2 shrink-0 text-xs font-medium text-secondary">첨부 목록 ({attachedItems.length}개)</div>
            <div className="min-h-0 flex-1 space-y-1 overflow-y-auto rounded-lg border border-color bg-tertiary/50 p-2 xl:h-auto">
                {attachedItems.map((item, index) => (
                    <div key={index} className="flex items-center justify-between gap-2 rounded bg-primary/50 p-2 text-xs">
                        <span className="flex min-w-0 items-center gap-1.5 truncate">
                            <span className="min-w-0 truncate">
                                {item.name} × {item.quantity}
                                {item.type === 'equipment' && item.grade ? (
                                    <span className={`font-medium ${gradeStyles[item.grade].color}`}> ({gradeStyles[item.grade].name})</span>
                                ) : null}
                                {item.type === 'equipment' && item.stars != null && item.stars > 0 ? (
                                    <span className="font-medium text-amber-400/90"> +{item.stars}</span>
                                ) : null}{' '}
                                <span className="text-gray-500">({item.type})</span>
                            </span>
                        </span>
                        <button
                            type="button"
                            onClick={() => setAttachedItems((prev) => prev.filter((_, i) => i !== index))}
                            className="shrink-0 px-2 font-bold text-red-500 hover:text-red-400"
                        >
                            X
                        </button>
                    </div>
                ))}
                {attachedItems.length === 0 && <p className="py-10 text-center text-xs text-tertiary">첨부된 아이템이 없습니다.</p>}
            </div>
        </>
    );

    const mobileStepTabs: { step: 1 | 2 | 3; label: string; short: string }[] = [
        { step: 1, label: '받는 사람', short: '수신' },
        { step: 2, label: '내용·보상', short: '내용' },
        { step: 3, label: '첨부', short: '첨부' },
    ];

    return (
        <div className={`${adminPageWide} ${adminSectionGap}`}>
            {isItemModalOpen && <ItemSelectionModal onClose={() => setIsItemModalOpen(false)} onAddItem={(item) => setAttachedItems(prev => [...prev, item])} />}
            <AdminPageHeader
                title="우편 발송"
                subtitle="전체 또는 지정 유저에게 골드·다이아·아이템 우편을 발송합니다."
                onBack={onBack}
            />

            <form id={mailFormId} onSubmit={handleSendMail} className="text-sm">
                {/* 데스크톱: 기존 3열 */}
                <div className="hidden grid-cols-1 items-stretch gap-6 xl:grid xl:grid-cols-3 xl:gap-6">
                    <div className={`${panelShell} p-5`}>{recipientsInner}</div>
                    <div className={`${panelShell} p-5`}>{contentRewardsInner}</div>
                    <div className={`${panelShell} p-5`}>{attachedItemsInner}</div>
                </div>

                {/* 모바일·태블릿: 단계별 */}
                <div className="pb-[5.75rem] xl:hidden">
                    <div
                        className="sticky top-0 z-20 -mx-1 mb-4 border-b border-color/40 bg-primary/95 px-1 pb-3 pt-0 backdrop-blur-md"
                        role="tablist"
                        aria-label="우편 작성 단계"
                    >
                        <div className="flex gap-1.5 overflow-x-auto pb-0.5 [-webkit-overflow-scrolling:touch]">
                            {mobileStepTabs.map(({ step, label, short }) => {
                                const active = mobileStep === step;
                                return (
                                    <button
                                        key={step}
                                        type="button"
                                        role="tab"
                                        aria-selected={active}
                                        onClick={() => setMobileStep(step)}
                                        className={`shrink-0 rounded-xl border px-3 py-2.5 text-left transition-all ${
                                            active
                                                ? 'border-amber-400/50 bg-amber-500/15 text-amber-100 shadow-inner'
                                                : 'border-color/50 bg-secondary/40 text-gray-400 hover:border-color hover:bg-secondary/60 hover:text-primary'
                                        }`}
                                    >
                                        <span className="block text-[11px] font-semibold text-gray-500 sm:text-xs">단계 {step}</span>
                                        <span className="block text-xs font-semibold sm:text-sm">
                                            <span className="sm:hidden">{short}</span>
                                            <span className="hidden sm:inline">{label}</span>
                                        </span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    <div className="min-h-[min(60vh,28rem)]" role="tabpanel">
                        {mobileStep === 1 && <div className={mobileStepShell}>{recipientsInner}</div>}
                        {mobileStep === 2 && <div className={mobileStepShell}>{contentRewardsInner}</div>}
                        {mobileStep === 3 && <div className={mobileStepShell}>{attachedItemsInner}</div>}
                    </div>
                </div>

                <div className="mx-auto mt-8 hidden max-w-2xl border-t border-color/60 pt-2 xl:mx-0 xl:block xl:max-w-none">
                    <Button type="submit" className="w-full py-3.5 text-base" colorScheme="green">
                        발송하기
                    </Button>
                </div>
            </form>

            {/* 모바일 하단 고정: 발송 + 단계 이동 */}
            <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 xl:hidden">
                <div className="pointer-events-auto border-t border-color/60 bg-primary/95 px-3 py-2.5 pb-[max(0.5rem,env(safe-area-inset-bottom))] shadow-[0_-10px_28px_-10px_rgba(0,0,0,0.45)] backdrop-blur-md">
                    <div className="mx-auto flex max-w-5xl flex-col gap-2">
                        <div className="flex items-center justify-center gap-2">
                            {mobileStep > 1 && (
                                <Button type="button" colorScheme="gray" className="!px-4 !py-2.5 !text-sm" onClick={() => setMobileStep((s) => (s > 1 ? ((s - 1) as 1 | 2 | 3) : s))}>
                                    이전
                                </Button>
                            )}
                            {mobileStep < 3 && (
                                <Button type="button" colorScheme="blue" className="!px-4 !py-2.5 !text-sm" onClick={() => setMobileStep((s) => (s < 3 ? ((s + 1) as 1 | 2 | 3) : s))}>
                                    다음
                                </Button>
                            )}
                        </div>
                        <Button type="submit" form={mailFormId} className="w-full py-3.5 text-base" colorScheme="green">
                            발송하기
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default MailSystemPanel;