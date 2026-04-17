import React, { useState, useMemo, useEffect, useCallback, useRef, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
// FIX: Import missing types from the centralized types file.
import { User, ServerAction, AdminProps, LiveGameSession, GameMode, Quest, DailyQuestData, WeeklyQuestData, MonthlyQuestData, TournamentType, InventoryItem, InventoryItemType, Equipment } from '../../types/index.js';
import DraggableWindow from '../DraggableWindow.js';
import Button from '../Button.js';
import { SPECIAL_GAME_MODES, PLAYFUL_GAME_MODES, EQUIPMENT_POOL, CONSUMABLE_ITEMS, MATERIAL_ITEMS } from '../../constants';
import { useAppContext } from '../../hooks/useAppContext.js';
import { getApiUrl } from '../../utils/apiConfig.js';
import AdminPageHeader from './AdminPageHeader.js';
import { adminCard, adminCardTitle, adminInput, adminPageNarrow, adminShell } from './adminChrome.js';

interface UserManagementModalProps {
    user: User;
    currentUser: User;
    onClose: () => void;
    onAction: (action: ServerAction) => void;
    onRefreshFullUser: () => Promise<void>;
}

const EQUIPMENT_SLOTS: Array<'fan' | 'board' | 'top' | 'bottom' | 'bowl' | 'stones'> = ['fan', 'board', 'top', 'bottom', 'bowl', 'stones'];

const UserManagementModal: React.FC<UserManagementModalProps> = ({ user, currentUser, onClose, onAction, onRefreshFullUser }) => {
    const [editedUser, setEditedUser] = useState<User>(JSON.parse(JSON.stringify(user)));
    const [activeTab, setActiveTab] = useState<'general' | 'strategic' | 'playful' | 'quests' | 'rewards' | 'inventory' | 'danger'>('general');
    const [invDraft, setInvDraft] = useState<InventoryItem[]>([]);
    const [eqDraft, setEqDraft] = useState<Partial<Record<string, string>>>({});
    const [selectedInvId, setSelectedInvId] = useState<string | null>(null);
    const [optionsJsonText, setOptionsJsonText] = useState('');
    const [rewardTitle, setRewardTitle] = useState('관리자 보상');
    const [rewardMessage, setRewardMessage] = useState('보상이 지급되었습니다.');
    const [rewardGold, setRewardGold] = useState(0);
    const [rewardDiamonds, setRewardDiamonds] = useState(0);
    const [rewardAp, setRewardAp] = useState(0);
    const [rewardExpiresDays, setRewardExpiresDays] = useState(30);
    const [rewardItems, setRewardItems] = useState<{ name: string; quantity: number; type: InventoryItemType }[]>([]);
    const [mailEqPick, setMailEqPick] = useState(EQUIPMENT_POOL[0]?.name ?? '');
    const [mailStackPick, setMailStackPick] = useState('');
    const [invSaveBusy, setInvSaveBusy] = useState(false);
    const [appendBusy, setAppendBusy] = useState(false);
    const [newEqName, setNewEqName] = useState('');
    const [newEqQty, setNewEqQty] = useState(1);
    const [newStackName, setNewStackName] = useState('');
    const [newStackQty, setNewStackQty] = useState(1);
    const [newStackType, setNewStackType] = useState<InventoryItemType>('consumable');
    
    // user prop이 변경되면 editedUser도 업데이트 (서버에서 업데이트된 데이터 반영)
    useEffect(() => {
        setEditedUser(JSON.parse(JSON.stringify(user)));
    }, [user]);

    useEffect(() => {
        setInvDraft(JSON.parse(JSON.stringify(Array.isArray(user.inventory) ? user.inventory : [])));
        setEqDraft({ ...(user.equipment || {}) });
        setSelectedInvId(null);
        setOptionsJsonText('');
    }, [user]);

    useEffect(() => {
        if (!selectedInvId) {
            setOptionsJsonText('');
            return;
        }
        const it = invDraft.find((i) => i.id === selectedInvId);
        if (!it) {
            setOptionsJsonText('');
            return;
        }
        try {
            setOptionsJsonText(JSON.stringify(it.options ?? null, null, 2));
        } catch {
            setOptionsJsonText('');
        }
        // invDraft 제외: 레벨 등 수정 중 옵션 JSON 에디터가 리셋되지 않도록
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedInvId]);

    const applyOptionsJsonToSelected = () => {
        if (!selectedInvId) return;
        let parsed: unknown = undefined;
        const t = optionsJsonText.trim();
        if (t) {
            try {
                parsed = JSON.parse(t);
            } catch {
                alert('options JSON 형식이 올바르지 않습니다.');
                return;
            }
        }
        setInvDraft((prev) =>
            prev.map((it) => (it.id === selectedInvId ? { ...it, options: parsed as InventoryItem['options'] } : it))
        );
    };

    const handleSendRewardMail = (e: React.FormEvent) => {
        e.preventDefault();
        if (!rewardTitle.trim() || !rewardMessage.trim()) {
            alert('제목과 내용을 입력해주세요.');
            return;
        }
        onAction({
            type: 'ADMIN_SEND_MAIL',
            payload: {
                targetSpecifier: '',
                targetUserIds: [user.id],
                title: rewardTitle.trim(),
                message: rewardMessage.trim(),
                expiresInDays: rewardExpiresDays,
                attachments: {
                    gold: rewardGold,
                    diamonds: rewardDiamonds,
                    actionPoints: rewardAp,
                    items: rewardItems,
                },
            },
        });
        void onRefreshFullUser();
    };

    const handleAppendItems = async () => {
        const equipmentAdds: { name: string; quantity: number }[] = [];
        if (newEqName.trim()) {
            equipmentAdds.push({ name: newEqName.trim(), quantity: Math.max(1, Math.min(50, newEqQty)) });
        }
        const stackableAdds: { name: string; quantity: number; type: InventoryItemType }[] = [];
        if (newStackName.trim() && (newStackType === 'consumable' || newStackType === 'material')) {
            stackableAdds.push({
                name: newStackName.trim(),
                quantity: Math.max(1, Math.min(999999, newStackQty)),
                type: newStackType,
            });
        }
        if (equipmentAdds.length === 0 && stackableAdds.length === 0) {
            alert('추가할 장비(이름 선택) 또는 소모품/재료를 입력하세요.');
            return;
        }
        setAppendBusy(true);
        try {
            onAction({
                type: 'ADMIN_APPEND_INVENTORY_ITEMS',
                payload: {
                    targetUserId: user.id,
                    equipmentAdds: equipmentAdds.length ? equipmentAdds : undefined,
                    stackableAdds: stackableAdds.length ? stackableAdds : undefined,
                },
            });
            await onRefreshFullUser();
            setNewEqName('');
            setNewEqQty(1);
            setNewStackName('');
            setNewStackQty(1);
        } finally {
            setAppendBusy(false);
        }
    };

    const handleSaveInventoryEquipment = async () => {
        if (!window.confirm('인벤토리·장비 슬롯을 서버에 반영합니다. 계속할까요?')) return;
        setInvSaveBusy(true);
        try {
            onAction({
                type: 'ADMIN_SAVE_USER_INVENTORY_EQUIPMENT',
                payload: {
                    targetUserId: user.id,
                    inventory: invDraft,
                    equipment: eqDraft as Equipment,
                },
            });
            await onRefreshFullUser();
        } finally {
            setInvSaveBusy(false);
        }
    };

    const equipmentIdsInInv = useMemo(() => invDraft.filter((i) => i.type === 'equipment').map((i) => i.id), [invDraft]);
    const allStackableTemplates = useMemo(() => [...CONSUMABLE_ITEMS, ...Object.values(MATERIAL_ITEMS)], []);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        const numValue = value === '' ? 0 : Number(value);
        if (!isNaN(numValue)) {
            setEditedUser(prev => ({ ...prev, [name]: numValue }));
        }
    };

    const handleTextInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setEditedUser(prev => ({ ...prev, [name]: value }));
    };
    
    const handleCheckboxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, checked } = e.target;
        setEditedUser(prev => ({ ...prev, [name]: checked }));
    };

    const handleCumulativeRankingScoreChange = (key: 'standard' | 'playful', value: string) => {
        setEditedUser(prev => {
            const newCumulativeRankingScore = { ...(prev.cumulativeRankingScore || {}) };
            const numValue = value === '' ? 0 : Number(value);
            if (!isNaN(numValue)) {
                newCumulativeRankingScore[key] = numValue;
            }
            return { ...prev, cumulativeRankingScore: newCumulativeRankingScore };
        });
    };

    const handleQuestPropertyChange = (questType: 'daily' | 'weekly' | 'monthly', questId: string, field: 'progress' | 'isClaimed', value: number | boolean) => {
        setEditedUser(prev => {
            const newQuests = JSON.parse(JSON.stringify(prev.quests || {}));
            if (newQuests[questType] && newQuests[questType].quests) {
                const quest = newQuests[questType].quests.find((q: Quest) => q.id === questId);
                if (quest) {
                    (quest as any)[field] = value;
                }
            }
            return { ...prev, quests: newQuests };
        });
    };

    const handleActivityProgressChange = (questType: 'daily' | 'weekly' | 'monthly', value: number) => {
        setEditedUser(prev => {
            const newQuests = JSON.parse(JSON.stringify(prev.quests || {}));
            if (newQuests[questType]) {
                newQuests[questType].activityProgress = value;
            } else if (!newQuests[questType]) {
                newQuests[questType] = { quests: [], activityProgress: value, claimedMilestones: [false,false,false,false,false], lastReset: 0 };
            }
            return { ...prev, quests: newQuests };
        });
    };

    const handleMilestoneChange = (questType: 'daily' | 'weekly' | 'monthly', index: number, value: boolean) => {
        setEditedUser(prev => {
            const newQuests = JSON.parse(JSON.stringify(prev.quests || {}));
            if (newQuests[questType] && newQuests[questType].claimedMilestones) {
                newQuests[questType].claimedMilestones[index] = value;
            }
            return { ...prev, quests: newQuests };
        });
    };


    const handleSave = () => {
        onAction({ type: 'ADMIN_UPDATE_USER_DETAILS', payload: { targetUserId: user.id, updatedDetails: editedUser } });
        onClose();
    };

    const handleReset = (resetType: 'stats' | 'full') => {
        const message = resetType === 'full' ? `정말로 [${user.nickname}] 님의 레벨과 모든 전적을 초기화하시겠습니까?` : `정말로 [${user.nickname}] 님의 모든 전적을 초기화하시겠습니까?`;
        if (window.confirm(message)) {
            onAction({ type: 'ADMIN_RESET_USER_DATA', payload: { targetUserId: user.id, resetType } });
        }
    };

    const handleDelete = () => {
        if (window.confirm(`정말로 [${user.nickname}] 님의 계정을 삭제하시겠습니까?`)) {
            onAction({ type: 'ADMIN_DELETE_USER', payload: { targetUserId: user.id } });
            onClose();
        }
    };

    const handleForceLogout = () => {
        if (user.id === currentUser.id) {
            alert('본인 계정은 강제 로그아웃할 수 없습니다.');
            return;
        }
        if (window.confirm(`[${user.nickname}] 님을 강제로 로그아웃하시겠습니까?`)) {
            onAction({ type: 'ADMIN_FORCE_LOGOUT', payload: { targetUserId: user.id } });
            alert('강제 로그아웃 요청을 전송했습니다.');
        }
    };

    
    type QuestCategoryPanelProps = {
        title: string;
        questType: 'daily' | 'weekly' | 'monthly';
        questData: DailyQuestData | WeeklyQuestData | MonthlyQuestData | undefined;
    };
    const QuestCategoryPanel: React.FC<QuestCategoryPanelProps> = ({ title, questType, questData }) => (
        <div className="bg-tertiary/50 p-3 rounded-lg">
            <h3 className="font-bold text-lg text-highlight mb-2">{title}</h3>
            <div className="flex items-center gap-2 mb-2">
                <label className="text-sm font-medium text-secondary whitespace-nowrap">활약도:</label>
                <input type="number" value={questData?.activityProgress || 0} onChange={e => handleActivityProgressChange(questType, parseInt(e.target.value, 10) || 0)} className="bg-secondary p-1 rounded w-full" />
            </div>
            <div className="flex items-center gap-2 mb-3">
                <label className="text-sm font-medium text-secondary whitespace-nowrap">마일스톤:</label>
                <div className="flex gap-2 flex-wrap">
                    {Array.from({ length: 5 }).map((_, i) => (
                        <label key={i} className="flex items-center gap-1 text-xs">
                            <input type="checkbox" checked={questData?.claimedMilestones?.[i] || false} onChange={e => handleMilestoneChange(questType, i, e.target.checked)} className="w-4 h-4" />
                            {i+1}
                        </label>
                    ))}
                </div>
            </div>
            <div className="space-y-2 max-h-48 overflow-y-auto pr-2 border-t border-color pt-2">
                {(questData?.quests || []).map((quest: Quest) => (
                    <div key={quest.id} className="bg-primary/50 p-2 rounded-md text-xs">
                        <p className="font-semibold truncate" title={quest.title}>{quest.title}</p>
                        <div className="flex items-center justify-between gap-2 mt-1">
                            <div className="flex items-center gap-1">
                                <span>진행도:</span>
                                <input type="number" value={quest.progress} onChange={e => handleQuestPropertyChange(questType, quest.id, 'progress', parseInt(e.target.value, 10) || 0)} className="w-16 bg-secondary p-0.5 rounded text-center"/>
                                <span>/ {quest.target}</span>
                            </div>
                            <label className="flex items-center gap-1">
                                <input type="checkbox" checked={quest.isClaimed} onChange={e => handleQuestPropertyChange(questType, quest.id, 'isClaimed', e.target.checked)} className="w-4 h-4"/>
                                <span>완료</span>
                            </label>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
    
    return (
        <DraggableWindow title={`사용자 관리: ${user.nickname}`} onClose={onClose} windowId={`user-edit-${user.id}`} initialWidth={820}>
            <div className="flex flex-col min-h-[55vh] max-h-[85vh]">
                <div className="flex flex-wrap gap-1 border-b border-color mb-4">
                    <button type="button" onClick={() => setActiveTab('general')} className={`px-3 py-2 text-sm ${activeTab === 'general' ? 'border-b-2 border-accent text-primary' : 'text-tertiary'}`}>일반</button>
                    <button type="button" onClick={() => setActiveTab('strategic')} className={`px-3 py-2 text-sm ${activeTab === 'strategic' ? 'border-b-2 border-accent text-primary' : 'text-tertiary'}`}>전략 랭킹</button>
                    <button type="button" onClick={() => setActiveTab('playful')} className={`px-3 py-2 text-sm ${activeTab === 'playful' ? 'border-b-2 border-accent text-primary' : 'text-tertiary'}`}>놀이 랭킹</button>
                    <button type="button" onClick={() => setActiveTab('quests')} className={`px-3 py-2 text-sm ${activeTab === 'quests' ? 'border-b-2 border-accent text-primary' : 'text-tertiary'}`}>퀘스트</button>
                    <button type="button" onClick={() => setActiveTab('rewards')} className={`px-3 py-2 text-sm ${activeTab === 'rewards' ? 'border-b-2 border-green-500 text-green-400' : 'text-tertiary'}`}>보상 우편</button>
                    <button type="button" onClick={() => setActiveTab('inventory')} className={`px-3 py-2 text-sm ${activeTab === 'inventory' ? 'border-b-2 border-amber-500 text-amber-400' : 'text-tertiary'}`}>인벤·장비</button>
                    <button type="button" onClick={() => setActiveTab('danger')} className={`px-3 py-2 text-sm ${activeTab === 'danger' ? 'border-b-2 border-danger text-danger' : 'text-tertiary'}`}>위험 구역</button>
                </div>

                <div className="flex-grow overflow-y-auto pr-2">
                    {activeTab === 'general' && (
                        <div className="space-y-3">
                            <div className="grid grid-cols-2 gap-2"><label>닉네임</label><input type="text" name="nickname" value={editedUser.nickname} onChange={handleTextInputChange} className="bg-tertiary p-1 rounded" maxLength={6} /></div>
                            <div className="grid grid-cols-2 gap-2"><label>전략 레벨</label><input type="number" name="strategyLevel" value={editedUser.strategyLevel} onChange={handleInputChange} className="bg-tertiary p-1 rounded" /></div>
                            <div className="grid grid-cols-2 gap-2"><label>전략 XP</label><input type="number" name="strategyXp" value={editedUser.strategyXp} onChange={handleInputChange} className="bg-tertiary p-1 rounded" /></div>
                            <div className="grid grid-cols-2 gap-2"><label>놀이 레벨</label><input type="number" name="playfulLevel" value={editedUser.playfulLevel} onChange={handleInputChange} className="bg-tertiary p-1 rounded" /></div>
                            <div className="grid grid-cols-2 gap-2"><label>놀이 XP</label><input type="number" name="playfulXp" value={editedUser.playfulXp} onChange={handleInputChange} className="bg-tertiary p-1 rounded" /></div>
                            <div className="grid grid-cols-2 gap-2"><label>골드</label><input type="number" name="gold" value={editedUser.gold} onChange={handleInputChange} className="bg-tertiary p-1 rounded" /></div>
                            <div className="grid grid-cols-2 gap-2"><label>다이아</label><input type="number" name="diamonds" value={editedUser.diamonds} onChange={handleInputChange} className="bg-tertiary p-1 rounded" /></div>
                            <div className="grid grid-cols-2 gap-2"><label>행동력 현재</label><input type="number" value={editedUser.actionPoints?.current ?? 0} onChange={(e) => setEditedUser((p) => ({ ...p, actionPoints: { ...(p.actionPoints || { current: 0, max: 100 }), current: Number(e.target.value) || 0, max: p.actionPoints?.max ?? 100 } }))} className="bg-tertiary p-1 rounded" /></div>
                            <div className="grid grid-cols-2 gap-2"><label>행동력 최대</label><input type="number" value={editedUser.actionPoints?.max ?? 0} onChange={(e) => setEditedUser((p) => ({ ...p, actionPoints: { ...(p.actionPoints || { current: 0, max: 100 }), max: Number(e.target.value) || 1, current: p.actionPoints?.current ?? 0 } }))} className="bg-tertiary p-1 rounded" /></div>
                            <div className="grid grid-cols-2 gap-2"><label>매너 점수</label><input type="number" name="mannerScore" value={editedUser.mannerScore} onChange={handleInputChange} className="bg-tertiary p-1 rounded" /></div>
                            <div className="grid grid-cols-2 gap-2"><label>챔피언십 누적 점수</label><input type="number" name="cumulativeTournamentScore" value={editedUser.cumulativeTournamentScore ?? 0} onChange={handleInputChange} className="bg-tertiary p-1 rounded" /></div>
                            <div className="grid grid-cols-2 gap-2"><label>챔피언십 주간 점수</label><input type="number" name="tournamentScore" value={editedUser.tournamentScore ?? 0} onChange={handleInputChange} className="bg-tertiary p-1 rounded" /></div>
                             <div className="grid grid-cols-2 gap-2 items-center">
                                <label>관리자 권한</label>
                                <input
                                    type="checkbox"
                                    name="isAdmin"
                                    checked={!!editedUser.isAdmin}
                                    onChange={handleCheckboxChange}
                                    className="w-5 h-5"
                                    disabled={user.id === currentUser.id}
                                    title={user.id === currentUser.id ? "자신의 관리자 권한은 변경할 수 없습니다." : ""}
                                />
                            </div>
                        </div>
                    )}
                    {activeTab === 'strategic' && (
                        <div className="space-y-3">
                            <div className="grid grid-cols-2 gap-2 items-center">
                                <label className="text-secondary">전략바둑 통합 랭킹 점수</label>
                                <input 
                                    type="number" 
                                    value={editedUser.cumulativeRankingScore?.['standard'] ?? 0} 
                                    onChange={e => handleCumulativeRankingScoreChange('standard', e.target.value)} 
                                    className="bg-tertiary p-1 rounded" 
                                />
                            </div>
                            <p className="text-xs text-gray-400">
                                전략바둑의 모든 게임 모드(표준, 베이스, 히든, 스피드, 믹스)가 통합된 랭킹 점수입니다.
                            </p>
                        </div>
                    )}
                    {activeTab === 'playful' && (
                        <div className="space-y-3">
                            <div className="grid grid-cols-2 gap-2 items-center">
                                <label className="text-secondary">놀이바둑 통합 랭킹 점수</label>
                                <input 
                                    type="number" 
                                    value={editedUser.cumulativeRankingScore?.['playful'] ?? 0} 
                                    onChange={e => handleCumulativeRankingScoreChange('playful', e.target.value)} 
                                    className="bg-tertiary p-1 rounded" 
                                />
                            </div>
                            <p className="text-xs text-gray-400">
                                놀이바둑의 모든 게임 모드(주사위, 도둑, 알까기, 컬링, 오목, 땀옥)가 통합된 랭킹 점수입니다.
                            </p>
                        </div>
                    )}
                    {activeTab === 'quests' && (
                        <div className="space-y-4">
                           <QuestCategoryPanel title="일일 퀘스트" questType="daily" questData={editedUser.quests?.daily} />
                           <QuestCategoryPanel title="주간 퀘스트" questType="weekly" questData={editedUser.quests?.weekly} />
                           <QuestCategoryPanel title="월간 퀘스트" questType="monthly" questData={editedUser.quests?.monthly} />
                        </div>
                    )}
                    {activeTab === 'rewards' && (
                        <form onSubmit={handleSendRewardMail} className="space-y-3 text-sm max-w-xl">
                            <p className="text-xs text-gray-400">검색한 유저에게 골드·다이아·행동력·아이템을 우편으로 바로 보냅니다.</p>
                            <div className="grid grid-cols-2 gap-2">
                                <label>제목</label>
                                <input className="bg-tertiary p-1 rounded" value={rewardTitle} onChange={(e) => setRewardTitle(e.target.value)} />
                            </div>
                            <div className="grid grid-cols-2 gap-2 items-start">
                                <label>내용</label>
                                <textarea className="bg-tertiary p-1 rounded min-h-[60px]" value={rewardMessage} onChange={(e) => setRewardMessage(e.target.value)} />
                            </div>
                            <div className="grid grid-cols-3 gap-2">
                                <div><label className="text-xs">골드</label><input type="number" className="w-full bg-tertiary p-1 rounded" value={rewardGold} onChange={(e) => setRewardGold(Number(e.target.value) || 0)} /></div>
                                <div><label className="text-xs">다이아</label><input type="number" className="w-full bg-tertiary p-1 rounded" value={rewardDiamonds} onChange={(e) => setRewardDiamonds(Number(e.target.value) || 0)} /></div>
                                <div><label className="text-xs">행동력(우편)</label><input type="number" className="w-full bg-tertiary p-1 rounded" value={rewardAp} onChange={(e) => setRewardAp(Number(e.target.value) || 0)} /></div>
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                                <label>만료(일)</label>
                                <input type="number" className="bg-tertiary p-1 rounded" value={rewardExpiresDays} onChange={(e) => setRewardExpiresDays(Math.max(0, Number(e.target.value) || 0))} />
                            </div>
                            <div className="border border-color rounded p-2 space-y-2">
                                <div className="text-xs font-semibold text-secondary">첨부 아이템</div>
                                {rewardItems.map((it, idx) => (
                                    <div key={idx} className="flex gap-2 items-center text-xs">
                                        <span className="flex-1 truncate">{it.name} ×{it.quantity} ({it.type})</span>
                                        <button type="button" className="text-red-400" onClick={() => setRewardItems((p) => p.filter((_, i) => i !== idx))}>제거</button>
                                    </div>
                                ))}
                                <div className="flex flex-wrap gap-2 items-center">
                                    <select className="bg-tertiary text-xs p-1 rounded max-w-[160px]" value={mailEqPick} onChange={(e) => setMailEqPick(e.target.value)}>
                                        {EQUIPMENT_POOL.map((eq) => (
                                            <option key={eq.name} value={eq.name}>{eq.name}</option>
                                        ))}
                                    </select>
                                    <button
                                        type="button"
                                        className="text-xs px-2 py-1 bg-secondary rounded"
                                        onClick={() => {
                                            if (mailEqPick) setRewardItems((p) => [...p, { name: mailEqPick, quantity: 1, type: 'equipment' }]);
                                        }}
                                    >장비 추가</button>
                                    <select className="bg-tertiary text-xs p-1 rounded max-w-[140px]" value={mailStackPick} onChange={(e) => setMailStackPick(e.target.value)}>
                                        <option value="">소모/재료 선택</option>
                                        {allStackableTemplates.map((it) => (
                                            <option key={it.name} value={it.name}>{it.name}</option>
                                        ))}
                                    </select>
                                    <button
                                        type="button"
                                        className="text-xs px-2 py-1 bg-secondary rounded"
                                        onClick={() => {
                                            const tpl = allStackableTemplates.find((x) => x.name === mailStackPick);
                                            if (tpl) setRewardItems((p) => [...p, { name: tpl.name, quantity: 1, type: tpl.type as InventoryItemType }]);
                                        }}
                                    >소모/재료 추가</button>
                                </div>
                            </div>
                            <Button type="submit" colorScheme="green" className="w-full">이 유저에게 우편 발송</Button>
                        </form>
                    )}
                    {activeTab === 'inventory' && (
                        <div className="space-y-4 text-sm">
                            <div className="border border-color rounded p-3 space-y-2 bg-secondary/20">
                                <div className="font-semibold text-amber-200 text-sm">아이템 추가 (서버 생성)</div>
                                <div className="flex flex-wrap gap-2 items-end">
                                    <div>
                                        <label className="text-xs block text-gray-400">장비 템플릿</label>
                                        <select className="bg-tertiary p-1 rounded text-xs max-w-[160px]" value={newEqName} onChange={(e) => setNewEqName(e.target.value)}>
                                            <option value="">선택</option>
                                            {EQUIPMENT_POOL.map((eq) => (
                                                <option key={eq.name} value={eq.name}>{eq.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="text-xs block text-gray-400">개수</label>
                                        <input type="number" className="w-16 bg-tertiary p-1 rounded" value={newEqQty} onChange={(e) => setNewEqQty(Number(e.target.value) || 1)} />
                                    </div>
                                    <div>
                                        <label className="text-xs block text-gray-400">소모/재료</label>
                                        <select className="bg-tertiary p-1 rounded text-xs max-w-[140px]" value={newStackName} onChange={(e) => setNewStackName(e.target.value)}>
                                            <option value="">선택</option>
                                            {[...CONSUMABLE_ITEMS, ...Object.values(MATERIAL_ITEMS)].map((it) => (
                                                <option key={it.name} value={it.name}>{it.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="text-xs block text-gray-400">타입</label>
                                        <select className="bg-tertiary p-1 rounded text-xs" value={newStackType} onChange={(e) => setNewStackType(e.target.value as InventoryItemType)}>
                                            <option value="consumable">consumable</option>
                                            <option value="material">material</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="text-xs block text-gray-400">수량</label>
                                        <input type="number" className="w-20 bg-tertiary p-1 rounded" value={newStackQty} onChange={(e) => setNewStackQty(Number(e.target.value) || 1)} />
                                    </div>
                                    <Button type="button" colorScheme="purple" className="!text-xs" disabled={appendBusy} onClick={() => void handleAppendItems()}>
                                        {appendBusy ? '추가 중…' : '인벤에 추가'}
                                    </Button>
                                </div>
                            </div>

                            <div className="font-semibold text-sm">착용 슬롯</div>
                            <div className="grid grid-cols-2 gap-2">
                                {EQUIPMENT_SLOTS.map((slot) => (
                                    <div key={slot} className="flex items-center gap-2">
                                        <span className="text-xs w-16 text-gray-400">{slot}</span>
                                        <select
                                            className="flex-1 bg-tertiary p-1 rounded text-xs"
                                            value={eqDraft[slot] || ''}
                                            onChange={(e) => {
                                                const v = e.target.value;
                                                setEqDraft((d) => {
                                                    const n = { ...d };
                                                    if (v) n[slot] = v;
                                                    else delete n[slot];
                                                    return n;
                                                });
                                            }}
                                        >
                                            <option value="">(없음)</option>
                                            {equipmentIdsInInv.map((id) => {
                                                const it = invDraft.find((x) => x.id === id);
                                                return (
                                                    <option key={id} value={id}>{it?.name ?? id}</option>
                                                );
                                            })}
                                        </select>
                                    </div>
                                ))}
                            </div>

                            <div className="font-semibold text-sm">인벤토리 ({invDraft.length}개)</div>
                            <div className="max-h-52 overflow-y-auto space-y-2 pr-1 border border-color rounded p-2">
                                {invDraft.map((it) => (
                                    <div key={it.id} className={`p-2 rounded border ${selectedInvId === it.id ? 'border-accent bg-accent/10' : 'border-color bg-primary/40'}`}>
                                        <div className="flex justify-between gap-2 items-start">
                                            <button type="button" className="text-left text-xs font-medium flex-1 truncate" onClick={() => setSelectedInvId(it.id === selectedInvId ? null : it.id)}>
                                                {it.name} <span className="text-gray-500">({it.type})</span>
                                            </button>
                                            <button
                                                type="button"
                                                className="text-red-400 text-xs shrink-0"
                                                onClick={() => {
                                                    setInvDraft((p) => p.filter((x) => x.id !== it.id));
                                                    setEqDraft((d) => {
                                                        const next = { ...d };
                                                        for (const s of EQUIPMENT_SLOTS) {
                                                            if (next[s] === it.id) delete next[s];
                                                        }
                                                        return next;
                                                    });
                                                    if (selectedInvId === it.id) setSelectedInvId(null);
                                                }}
                                            >삭제</button>
                                        </div>
                                        <div className="flex flex-wrap gap-2 mt-1 text-xs">
                                            <label className="flex items-center gap-1">강화<input type="number" className="w-12 bg-tertiary rounded p-0.5" value={it.level} onChange={(e) => setInvDraft((p) => p.map((x) => (x.id === it.id ? { ...x, level: Number(e.target.value) || 0 } : x)))} /></label>
                                            <label className="flex items-center gap-1">별<input type="number" className="w-10 bg-tertiary rounded p-0.5" value={it.stars} onChange={(e) => setInvDraft((p) => p.map((x) => (x.id === it.id ? { ...x, stars: Number(e.target.value) || 0 } : x)))} /></label>
                                            {it.type !== 'equipment' && (
                                                <label className="flex items-center gap-1">수량<input type="number" className="w-14 bg-tertiary rounded p-0.5" value={it.quantity ?? 1} onChange={(e) => setInvDraft((p) => p.map((x) => (x.id === it.id ? { ...x, quantity: Math.max(1, Number(e.target.value) || 1) } : x)))} /></label>
                                            )}
                                            {it.type === 'equipment' && (
                                                <>
                                                    <label className="flex items-center gap-1">강화실패<input type="number" className="w-12 bg-tertiary rounded p-0.5" value={it.enhancementFails ?? 0} onChange={(e) => setInvDraft((p) => p.map((x) => (x.id === it.id ? { ...x, enhancementFails: Number(e.target.value) || 0 } : x)))} /></label>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {selectedInvId && (
                                <div className="space-y-1">
                                    <label className="text-xs text-gray-400">선택한 장비 options (JSON) — main / combatSubs / specialSubs / mythicSubs</label>
                                    <textarea className="w-full font-mono text-xs bg-tertiary p-2 rounded min-h-[140px]" value={optionsJsonText} onChange={(e) => setOptionsJsonText(e.target.value)} spellCheck={false} />
                                    <Button type="button" colorScheme="gray" className="!text-xs" onClick={applyOptionsJsonToSelected}>옵션 JSON 적용(로컬 초안)</Button>
                                </div>
                            )}

                            <Button type="button" colorScheme="orange" className="w-full" disabled={invSaveBusy} onClick={() => void handleSaveInventoryEquipment()}>
                                {invSaveBusy ? '저장 중…' : '인벤·장비 슬롯 서버에 반영'}
                            </Button>
                            <p className="text-xs text-gray-500">장비는 템플릿 추가 시 옵션이 랜덤 생성됩니다. 수정 후 반드시 위 버튼으로 저장하세요.</p>
                        </div>
                    )}
                     {activeTab === 'danger' && (
                        <div className="space-y-4 p-4 border border-danger/50 rounded-lg">
                            <h3 className="text-lg font-bold text-danger">주의: 되돌릴 수 없는 작업입니다.</h3>
                            <Button
                                onClick={handleForceLogout}
                                colorScheme="red"
                                className="w-full"
                                disabled={user.id === currentUser.id}
                                title={user.id === currentUser.id ? '본인 계정은 강제 로그아웃할 수 없습니다.' : ''}
                            >
                                강제 로그아웃
                            </Button>
                            <Button onClick={() => handleReset('stats')} colorScheme="yellow" className="w-full">모든 전적 초기화</Button>
                            <Button onClick={() => handleReset('full')} colorScheme="orange" className="w-full">레벨 포함 전체 초기화</Button>
                            <Button onClick={handleDelete} colorScheme="red" className="w-full">아이디 삭제</Button>
                            
                            <div className="mt-6 pt-6 border-t border-color">
                                <h3 className="text-lg font-bold text-yellow-400 mb-3">챔피언십 토너먼트 세션 초기화</h3>
                                <p className="text-sm text-gray-400 mb-4">선택한 경기장의 토너먼트 세션을 초기화하고 새로운 매칭을 생성합니다.</p>
                                <div className="space-y-2">
                                    <Button 
                                        onClick={() => {
                                            if (window.confirm(`[${user.nickname}] 님의 동네바둑리그 토너먼트를 초기화하고 새로 매칭하시겠습니까?`)) {
                                                onAction({ type: 'ADMIN_RESET_TOURNAMENT_SESSION', payload: { targetUserId: user.id, tournamentType: 'neighborhood' } });
                                            }
                                        }} 
                                        colorScheme="purple" 
                                        className="w-full"
                                    >
                                        동네바둑리그 재매칭
                                    </Button>
                                    <Button 
                                        onClick={() => {
                                            if (window.confirm(`[${user.nickname}] 님의 전국바둑대회 토너먼트를 초기화하고 새로 매칭하시겠습니까?`)) {
                                                onAction({ type: 'ADMIN_RESET_TOURNAMENT_SESSION', payload: { targetUserId: user.id, tournamentType: 'national' } });
                                            }
                                        }} 
                                        colorScheme="purple" 
                                        className="w-full"
                                    >
                                        전국바둑대회 재매칭
                                    </Button>
                                    <Button 
                                        onClick={() => {
                                            if (window.confirm(`[${user.nickname}] 님의 월드챔피언십 토너먼트를 초기화하고 새로 매칭하시겠습니까?`)) {
                                                onAction({ type: 'ADMIN_RESET_TOURNAMENT_SESSION', payload: { targetUserId: user.id, tournamentType: 'world' } });
                                            }
                                        }} 
                                        colorScheme="purple" 
                                        className="w-full"
                                    >
                                        월드챔피언십 재매칭
                                    </Button>
                                </div>
                            </div>
                            
                            <div className="mt-6 pt-6 border-t border-color">
                                <h3 className="text-lg font-bold text-yellow-400 mb-3">던전 진행 상태 초기화</h3>
                                <p className="text-sm text-gray-400 mb-4">던전 진행 상태를 초기화합니다. (단계, 언락 상태, 클리어 기록 등)</p>
                                <div className="space-y-2">
                                    <Button 
                                        onClick={() => {
                                            if (window.confirm(`[${user.nickname}] 님의 동네바둑리그 던전 진행 상태를 초기화하시겠습니까?`)) {
                                                onAction({ type: 'ADMIN_RESET_DUNGEON_PROGRESS', payload: { targetUserId: user.id, dungeonType: 'neighborhood' } });
                                            }
                                        }} 
                                        colorScheme="blue" 
                                        className="w-full"
                                    >
                                        동네바둑리그 던전 초기화
                                    </Button>
                                    <Button 
                                        onClick={() => {
                                            if (window.confirm(`[${user.nickname}] 님의 전국바둑대회 던전 진행 상태를 초기화하시겠습니까?`)) {
                                                onAction({ type: 'ADMIN_RESET_DUNGEON_PROGRESS', payload: { targetUserId: user.id, dungeonType: 'national' } });
                                            }
                                        }} 
                                        colorScheme="blue" 
                                        className="w-full"
                                    >
                                        전국바둑대회 던전 초기화
                                    </Button>
                                    <Button 
                                        onClick={() => {
                                            if (window.confirm(`[${user.nickname}] 님의 월드챔피언십 던전 진행 상태를 초기화하시겠습니까?`)) {
                                                onAction({ type: 'ADMIN_RESET_DUNGEON_PROGRESS', payload: { targetUserId: user.id, dungeonType: 'world' } });
                                            }
                                        }} 
                                        colorScheme="blue" 
                                        className="w-full"
                                    >
                                        월드챔피언십 던전 초기화
                                    </Button>
                                    <Button 
                                        onClick={() => {
                                            if (window.confirm(`[${user.nickname}] 님의 모든 던전 진행 상태를 초기화하시겠습니까?`)) {
                                                onAction({ type: 'ADMIN_RESET_DUNGEON_PROGRESS', payload: { targetUserId: user.id } });
                                            }
                                        }} 
                                        colorScheme="orange" 
                                        className="w-full"
                                    >
                                        모든 던전 초기화
                                    </Button>
                                </div>
                            </div>
                            
                            <div className="mt-6 pt-6 border-t border-color">
                                <h3 className="text-lg font-bold text-red-400 mb-3">챔피언십 전체 초기화</h3>
                                <p className="text-sm text-gray-400 mb-4">던전 진행 상태, 토너먼트 세션, 보상 수령 상태를 모두 초기화합니다.</p>
                                <Button 
                                    onClick={() => {
                                        if (window.confirm(`[${user.nickname}] 님의 챔피언십 관련 모든 데이터를 초기화하시겠습니까?\n\n- 던전 진행 상태\n- 토너먼트 세션\n- 보상 수령 상태`)) {
                                            onAction({ type: 'ADMIN_RESET_CHAMPIONSHIP_ALL', payload: { targetUserId: user.id } });
                                        }
                                    }} 
                                    colorScheme="red" 
                                    className="w-full"
                                >
                                    챔피언십 전체 초기화
                                </Button>
                            </div>
                        </div>
                    )}
                </div>

                <div className="flex justify-end gap-4 mt-4 pt-4 border-t border-color">
                    <Button onClick={onClose} colorScheme="gray">취소</Button>
                    <Button onClick={handleSave} colorScheme="green">저장</Button>
                </div>
            </div>
        </DraggableWindow>
    );
};

// FIX: The component uses `allUsers`, `onAction`, `onBack`, and `currentUser` props which were not defined in the interface.
// The extended `AdminProps` type is likely incomplete. Defining the props directly fixes the type error.
interface UserManagementPanelProps {
    allUsers: User[];
    onAction: (action: ServerAction) => void;
    onBack: () => void;
    currentUser: User;
}

const ROW_ESTIMATE_PX = 52;
const BATCH_MIN = 15;
const BATCH_MAX = 100;

type AdminCreateUserFormProps = {
    username: string;
    setUsername: (v: string) => void;
    password: string;
    setPassword: (v: string) => void;
    nickname: string;
    setNickname: (v: string) => void;
    createUserEmail: string;
    setCreateUserEmail: (v: string) => void;
    onSubmit: (e: React.FormEvent) => void;
};

const AdminCreateUserForm: React.FC<AdminCreateUserFormProps> = ({
    username,
    setUsername,
    password,
    setPassword,
    nickname,
    setNickname,
    createUserEmail,
    setCreateUserEmail,
    onSubmit,
}) => (
    <form onSubmit={onSubmit} className="space-y-4">
        <input
            type="text"
            name="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="아이디"
            className={adminInput}
        />
        <input
            type="password"
            name="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="비밀번호"
            className={adminInput}
        />
        <input
            type="email"
            name="createUserEmail"
            value={createUserEmail}
            onChange={(e) => setCreateUserEmail(e.target.value)}
            placeholder="이메일 (선택사항)"
            autoComplete="off"
            className={adminInput}
        />
        <input
            type="text"
            name="nickname"
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            placeholder="닉네임"
            className={adminInput}
            maxLength={6}
        />
        <Button type="submit" className="w-full">
            생성하기
        </Button>
    </form>
);

const UserManagementPanel: React.FC<UserManagementPanelProps> = ({ allUsers: _allUsers, onAction, onBack, currentUser }) => {
    const { handlers } = useAppContext();
    const [searchQuery, setSearchQuery] = useState('');
    const [panelManagingUser, setPanelManagingUser] = useState<User | null>(null);
    const [openingUserId, setOpeningUserId] = useState<string | null>(null);
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [nickname, setNickname] = useState('');
    const [createUserEmail, setCreateUserEmail] = useState('');
    const [isCreateUserModalOpen, setIsCreateUserModalOpen] = useState(false);
    const [isLoadingUsers, setIsLoadingUsers] = useState(false);
    const [isLoadingMore, setIsLoadingMore] = useState(false);
    const [searchError, setSearchError] = useState<string | null>(null);
    const [localUsers, setLocalUsers] = useState<User[]>([]);
    const [totalMatching, setTotalMatching] = useState(0);
    const listBatchSizeRef = useRef(30);
    const listScrollRef = useRef<HTMLDivElement>(null);
    const loadMoreSentinelRef = useRef<HTMLDivElement>(null);
    const loadingMoreRef = useRef(false);
    const totalMatchingRef = useRef(0);
    const localUsersLenRef = useRef(0);
    const loadMoreRef = useRef<() => void>(() => {});
    const fetchGenRef = useRef(0);

    useEffect(() => {
        totalMatchingRef.current = totalMatching;
    }, [totalMatching]);
    useEffect(() => {
        localUsersLenRef.current = localUsers.length;
    }, [localUsers.length]);
    const renderOnlineLabel = (user: User) => {
        const status = (user as any).status as string | undefined;
        const isConnected = Boolean((user as any).isConnected);
        if (isConnected) return <span className="text-emerald-400">접속중</span>;
        if (!status) return <span className="text-gray-500">오프라인</span>;
        const map: Record<string, string> = {
            waiting: '대기',
            resting: '휴식',
            'in-game': '대국중',
            negotiating: '협상중',
            online: '온라인',
            disconnected: '오프라인',
            spectating: '관전중',
        };
        return <span className="text-yellow-300">{map[status] ?? status}</span>;
    };

    const fetchAdminUsersPage = useCallback(
        async (trimmedQuery: string, pageOffset: number, pageLimit: number): Promise<{ users: User[]; total: number }> => {
            const adminId = String(currentUser?.id ?? '').trim();
            if (!adminId) {
                throw new Error('로그인 사용자 ID가 없어 목록을 불러올 수 없습니다.');
            }
            const candidates = [getApiUrl('/api/admin/users'), getApiUrl('/admin/users')];
            let lastError: Error | null = null;
            const limit = Math.max(BATCH_MIN, Math.min(BATCH_MAX, Math.floor(pageLimit) || 30));
            const offset = Math.max(0, Math.floor(pageOffset) || 0);

            for (const url of candidates) {
                try {
                    const response = await fetch(
                        `${url}?userId=${encodeURIComponent(adminId)}&query=${encodeURIComponent(trimmedQuery)}&limit=${limit}&offset=${offset}`,
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
                    const users = Array.isArray(data.users) ? data.users : [];
                    const total = typeof data.total === 'number' ? data.total : users.length;
                    return { users, total };
                } catch (err: unknown) {
                    lastError = err instanceof Error ? err : new Error(String(err));
                }
            }

            throw lastError ?? new Error('사용자 검색에 실패했습니다.');
        },
        [currentUser?.id]
    );

    const fetchAdminUserDetail = useCallback(async (targetUserId: string) => {
        const candidates = [getApiUrl(`/api/admin/user/${targetUserId}`), getApiUrl(`/admin/user/${targetUserId}`)];
        let lastError: Error | null = null;

        for (const url of candidates) {
            try {
                const res = await fetch(`${url}?userId=${encodeURIComponent(String(currentUser?.id ?? '').trim())}`, { credentials: 'include' });
                const raw = await res.text();
                if (raw.trim().startsWith('<!DOCTYPE') || raw.trim().startsWith('<html')) {
                    throw new Error('API 대신 HTML 응답이 반환되었습니다.');
                }
                const data = raw ? JSON.parse(raw) : {};
                if (!res.ok) throw new Error(data?.message || data?.error || '상세 조회 실패');
                return data?.user as User;
            } catch (err: any) {
                lastError = err instanceof Error ? err : new Error(String(err));
            }
        }
        throw lastError ?? new Error('유저 정보를 불러오지 못했습니다.');
    }, [currentUser?.id]);

    const loadFirstPage = useCallback(async (trimmedQuery: string) => {
        const gen = ++fetchGenRef.current;
        setIsLoadingUsers(true);
        setSearchError(null);
        loadingMoreRef.current = false;
        try {
            const batch = Math.max(BATCH_MIN, Math.min(BATCH_MAX, listBatchSizeRef.current));
            const { users, total } = await fetchAdminUsersPage(trimmedQuery, 0, batch);
            if (gen !== fetchGenRef.current) return;
            setLocalUsers(users);
            setTotalMatching(total);
        } catch (err: unknown) {
            if (gen !== fetchGenRef.current) return;
            console.error('[UserManagementPanel] Failed to load users:', err);
            setLocalUsers([]);
            setTotalMatching(0);
            setSearchError(err instanceof Error ? err.message : '목록을 불러오지 못했습니다.');
        } finally {
            if (gen === fetchGenRef.current) setIsLoadingUsers(false);
        }
    }, [fetchAdminUsersPage]);

    useLayoutEffect(() => {
        const el = listScrollRef.current;
        if (!el) return;
        const measure = () => {
            const h = el.clientHeight;
            if (h <= 0) return;
            const n = Math.ceil(h / ROW_ESTIMATE_PX) + 3;
            listBatchSizeRef.current = Math.max(BATCH_MIN, Math.min(BATCH_MAX, n));
        };
        measure();
        const ro = new ResizeObserver(measure);
        ro.observe(el);
        return () => ro.disconnect();
    }, []);

    useEffect(() => {
        if (!String(currentUser?.id ?? '').trim()) {
            setIsLoadingUsers(false);
            setLocalUsers([]);
            setTotalMatching(0);
            setSearchError('로그인 사용자 정보가 없어 목록을 불러올 수 없습니다.');
            return;
        }
        const trimmed = searchQuery.trim();
        if (trimmed.length >= 1) {
            const timer = setTimeout(() => {
                void loadFirstPage(trimmed);
            }, 250);
            return () => clearTimeout(timer);
        }
        void loadFirstPage('');
    }, [searchQuery, loadFirstPage, currentUser?.id]);

    const loadMore = useCallback(async () => {
        if (loadingMoreRef.current || isLoadingUsers) return;
        const trimmed = searchQuery.trim();
        const len = localUsersLenRef.current;
        if (len >= totalMatchingRef.current) return;
        loadingMoreRef.current = true;
        setIsLoadingMore(true);
        setSearchError(null);
        try {
            const batch = Math.max(BATCH_MIN, Math.min(BATCH_MAX, listBatchSizeRef.current));
            const { users, total } = await fetchAdminUsersPage(trimmed, len, batch);
            setTotalMatching(total);
            setLocalUsers((prev) => {
                const seen = new Set(prev.map((u) => u.id));
                const next = [...prev];
                for (const u of users) {
                    if (!seen.has(u.id)) {
                        seen.add(u.id);
                        next.push(u);
                    }
                }
                return next;
            });
        } catch (err: unknown) {
            console.error('[UserManagementPanel] loadMore failed:', err);
            setSearchError(err instanceof Error ? err.message : '추가 목록을 불러오지 못했습니다.');
        } finally {
            loadingMoreRef.current = false;
            setIsLoadingMore(false);
        }
    }, [searchQuery, fetchAdminUsersPage, isLoadingUsers]);

    useEffect(() => {
        loadMoreRef.current = () => {
            void loadMore();
        };
    }, [loadMore]);

    useEffect(() => {
        const root = listScrollRef.current;
        const sentinel = loadMoreSentinelRef.current;
        if (!root || !sentinel) return;
        const io = new IntersectionObserver(
            (entries) => {
                const hit = entries.some((e) => e.isIntersecting);
                if (!hit) return;
                if (localUsersLenRef.current >= totalMatchingRef.current) return;
                void loadMoreRef.current();
            },
            { root, rootMargin: '160px', threshold: 0 }
        );
        io.observe(sentinel);
        return () => io.disconnect();
    }, [localUsers.length, totalMatching, searchQuery, isLoadingUsers]);

    const refreshPanelUser = useCallback(async () => {
        if (!panelManagingUser?.id) return;
        try {
            const fullUser = await fetchAdminUserDetail(panelManagingUser.id);
            if (fullUser) setPanelManagingUser(fullUser);
        } catch (e) {
            console.error('[UserManagementPanel] refreshPanelUser failed:', e);
        }
    }, [panelManagingUser?.id, fetchAdminUserDetail]);

    const openUserManage = async (id: string) => {
        setOpeningUserId(id);
        try {
            const fullUser = await fetchAdminUserDetail(id);
            setPanelManagingUser(fullUser);
        } catch (err: any) {
            alert(err?.message || '유저 정보를 불러오지 못했습니다.');
        } finally {
            setOpeningUserId(null);
        }
    };

    const handleCreateUser = (e: React.FormEvent, options?: { closeModal?: boolean }) => {
        e.preventDefault();
        if (!username || !password || !nickname) {
            alert('모든 필드를 입력해주세요.');
            return;
        }
        const payload: { username: string; password: string; nickname: string; email?: string } = { username, password, nickname };
        const emailTrim = createUserEmail.trim();
        if (emailTrim) payload.email = emailTrim;
        onAction({ type: 'ADMIN_CREATE_USER', payload });
        setUsername('');
        setPassword('');
        setNickname('');
        setCreateUserEmail('');
        if (options?.closeModal) setIsCreateUserModalOpen(false);
    };

    useEffect(() => {
        if (!isCreateUserModalOpen) return;
        const onKey = (ev: KeyboardEvent) => {
            if (ev.key === 'Escape') setIsCreateUserModalOpen(false);
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [isCreateUserModalOpen]);

    const searchedUsers = useMemo(() => localUsers, [localUsers]);

    const hasMore = localUsers.length < totalMatching;
    const summaryLabel =
        searchQuery.trim().length >= 1
            ? `검색 일치 ${totalMatching.toLocaleString()}명 · 표시 ${searchedUsers.length.toLocaleString()}명`
            : `전체 ${totalMatching.toLocaleString()}명 · 표시 ${searchedUsers.length.toLocaleString()}명`;

    return (
        <div className={`${adminShell} flex h-full max-h-full min-h-0 min-w-0 flex-1 flex-col ${adminPageNarrow}`}>
            {panelManagingUser && (
                <UserManagementModal
                    user={panelManagingUser}
                    currentUser={currentUser}
                    onClose={() => setPanelManagingUser(null)}
                    onAction={onAction}
                    onRefreshFullUser={refreshPanelUser}
                />
            )}
            <AdminPageHeader
                title="사용자 관리"
                subtitle="검색·계정 수정, 인벤·장비, 권한 및 제재 등은 목록에서 사용자를 열어 처리합니다."
                onBack={onBack}
            />

            <div className="flex min-h-0 flex-1 flex-col gap-6">
                <div className={`${adminCard} flex min-h-0 min-w-0 flex-1 flex-col p-4 sm:p-6`}>
                    <div className="mb-3 flex shrink-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
                        <div className="flex min-w-0 flex-1 items-start justify-between gap-2 sm:min-w-0 sm:items-center">
                            <h2 className="min-w-0 flex-1 text-lg font-semibold sm:text-xl">
                                {summaryLabel}
                                {isLoadingUsers && <span className="ml-2 text-sm text-gray-400">(불러오는 중…)</span>}
                            </h2>
                            <button
                                type="button"
                                onClick={() => setIsCreateUserModalOpen(true)}
                                className="shrink-0 rounded-lg border border-amber-400/50 bg-amber-500/15 px-3 py-2 text-xs font-bold text-amber-200 shadow-sm transition-colors hover:bg-amber-500/25 active:scale-[0.98]"
                            >
                                신규 발급
                            </button>
                        </div>
                        <input
                            type="text"
                            placeholder="닉네임 또는 아이디 검색 (비우면 전체)"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className={`${adminInput} w-full shrink-0 sm:w-72`}
                        />
                    </div>
                    <p className="text-sm text-gray-400 mb-3 shrink-0">
                        처음에는 화면에 보이는 분량만 불러오며, 아래로 스크롤하면 그만큼씩 추가로 불러옵니다.
                    </p>
                    {searchError && (
                        <div className="mb-3 text-sm text-red-400 shrink-0">{searchError}</div>
                    )}
                    <div
                        ref={listScrollRef}
                        className="min-h-0 flex-1 overflow-y-auto overflow-x-auto rounded-md border border-color/60 [-webkit-overflow-scrolling:touch]"
                    >
                        <table className="min-w-max w-full text-left text-secondary max-lg:text-[11px] max-lg:leading-tight lg:text-base xl:text-[1.05rem]">
                            <thead className="bg-secondary text-secondary shadow-sm max-lg:text-[10px] max-lg:uppercase lg:text-sm xl:text-[0.95rem] sticky top-0 z-[1]">
                                <tr>
                                    <th scope="col" className="max-lg:w-[24%] max-lg:px-1.5 max-lg:py-2 px-4 py-3.5 sm:px-6 lg:min-w-[180px]">
                                        닉네임
                                    </th>
                                    <th scope="col" className="max-lg:w-[28%] max-lg:px-1.5 max-lg:py-2 px-4 py-3.5 sm:px-6 lg:min-w-[220px]">
                                        아이디
                                    </th>
                                    <th scope="col" className="max-lg:w-[14%] max-lg:px-1 max-lg:py-2 px-4 py-3.5 sm:px-6 lg:w-auto">
                                        <span className="lg:hidden">레벨</span>
                                        <span className="hidden lg:inline">레벨 (전략/놀이)</span>
                                    </th>
                                    <th scope="col" className="max-lg:w-[16%] max-lg:px-1 max-lg:py-2 px-4 py-3.5 sm:px-6 lg:w-auto">
                                        <span className="lg:hidden">상태</span>
                                        <span className="hidden lg:inline">접속 상태</span>
                                    </th>
                                    <th scope="col" className="max-lg:w-[24%] max-lg:px-1.5 max-lg:py-2 px-4 py-3.5 sm:px-6 lg:w-auto">
                                        <span className="lg:hidden">동작</span>
                                        <span className="hidden lg:inline">액션</span>
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {searchedUsers.map(user => (
                                    <tr
                                        key={user.id}
                                        className="border-b border-color bg-primary hover:bg-secondary/50 whitespace-nowrap"
                                    >
                                        <th
                                            scope="row"
                                            className="cursor-pointer px-4 py-4 font-medium text-primary hover:text-accent max-lg:px-1.5 max-lg:py-2 sm:px-6 sm:py-5"
                                            onClick={() => handlers.openViewingUser(user.id)}
                                            title={`${user.nickname}${user.isAdmin ? ' (관리자)' : ''} — 프로필 보기`}
                                        >
                                            <span className="block">
                                                {user.nickname}
                                                {user.isAdmin && (
                                                    <>
                                                        <span className="text-[10px] text-purple-400 lg:hidden">[관]</span>
                                                        <span className="hidden text-sm text-purple-400 lg:inline">[관리자]</span>
                                                    </>
                                                )}
                                            </span>
                                        </th>
                                        <td
                                            className="px-4 py-4 max-lg:px-1.5 max-lg:py-2 sm:px-6 sm:py-5"
                                            title={user.username}
                                        >
                                            {user.username}
                                        </td>
                                        <td className="px-4 py-4 max-lg:px-1 max-lg:py-2 sm:px-6 sm:py-5 tabular-nums">
                                            S.{user.strategyLevel}/P.{user.playfulLevel}
                                        </td>
                                        <td className="px-4 py-4 max-lg:px-1 max-lg:py-2 sm:px-6 sm:py-5">
                                            <span className="max-lg:inline-block max-lg:max-w-full max-lg:truncate">
                                                {renderOnlineLabel(user)}
                                            </span>
                                        </td>
                                        <td className="px-4 py-4 max-lg:px-1.5 max-lg:py-2 sm:px-6 sm:py-5">
                                            <div className="flex max-lg:min-w-0 max-lg:items-center max-lg:justify-end max-lg:gap-1 lg:gap-3">
                                                <button
                                                    type="button"
                                                    disabled={openingUserId === user.id}
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        void openUserManage(user.id);
                                                    }}
                                                    className="shrink-0 font-medium text-blue-500 hover:underline disabled:opacity-50 max-lg:text-[11px]"
                                                >
                                                    {openingUserId === user.id ? '열기…' : '관리'}
                                                </button>
                                                {Boolean((user as any).isConnected) && user.id !== currentUser.id && (
                                                    <button
                                                        type="button"
                                                        title="강제 로그아웃"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            if (window.confirm(`[${user.nickname}] 님을 즉시 로그아웃 처리할까요?`)) {
                                                                onAction({ type: 'ADMIN_FORCE_LOGOUT', payload: { targetUserId: user.id } });
                                                            }
                                                        }}
                                                        className="shrink-0 font-medium text-red-400 hover:underline max-lg:max-w-[3.25rem] max-lg:truncate max-lg:text-[11px] lg:max-w-none"
                                                    >
                                                        <span className="lg:hidden">강제</span>
                                                        <span className="hidden lg:inline">강제 로그아웃</span>
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                                {!isLoadingUsers && searchedUsers.length === 0 && totalMatching === 0 && (
                                    <tr>
                                        <td colSpan={5} className="px-6 py-10 text-center text-gray-400">
                                            {searchQuery.trim().length >= 1 ? '검색 결과가 없습니다.' : '등록된 사용자가 없습니다.'}
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                        {searchedUsers.length > 0 && (isLoadingMore || hasMore) && (
                            <div className="flex justify-center py-3 text-sm text-gray-400 border-t border-color/40">
                                {isLoadingMore ? '더 불러오는 중…' : '스크롤하면 다음 구간을 불러옵니다.'}
                            </div>
                        )}
                        <div ref={loadMoreSentinelRef} className="h-2 w-full shrink-0" aria-hidden />
                    </div>
                </div>
            </div>

            {typeof document !== 'undefined' &&
                isCreateUserModalOpen &&
                createPortal(
                    <div
                        className="fixed inset-0 z-[500] flex items-end justify-center px-3 pb-[max(1rem,env(safe-area-inset-bottom,0px))] pt-12 sm:items-center sm:p-4"
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="admin-create-user-modal-title"
                    >
                        <button
                            type="button"
                            className="absolute inset-0 bg-black/65 backdrop-blur-[2px]"
                            aria-label="닫기"
                            onClick={() => setIsCreateUserModalOpen(false)}
                        />
                        <div className={`relative z-[1] max-h-[min(92dvh,32rem)] w-full max-w-md overflow-y-auto ${adminCard} p-4 shadow-2xl sm:p-5`}>
                            <div className="mb-4 flex items-center justify-between gap-2 border-b border-color/50 pb-3">
                                <h2 id="admin-create-user-modal-title" className="text-lg font-semibold text-primary">
                                    신규 아이디 발급
                                </h2>
                                <button
                                    type="button"
                                    onClick={() => setIsCreateUserModalOpen(false)}
                                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-color bg-secondary text-lg leading-none text-secondary hover:bg-tertiary"
                                    aria-label="모달 닫기"
                                >
                                    ×
                                </button>
                            </div>
                            <AdminCreateUserForm
                                username={username}
                                setUsername={setUsername}
                                password={password}
                                setPassword={setPassword}
                                nickname={nickname}
                                setNickname={setNickname}
                                createUserEmail={createUserEmail}
                                setCreateUserEmail={setCreateUserEmail}
                                onSubmit={(e) => handleCreateUser(e, { closeModal: true })}
                            />
                        </div>
                    </div>,
                    document.body
                )}
        </div>
    );
};

export default UserManagementPanel;