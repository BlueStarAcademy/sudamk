
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { ServerAction, AdminProps, GameMode, Announcement, OverrideAnnouncement } from '../../types.js';
import { SPECIAL_GAME_MODES, PLAYFUL_GAME_MODES } from '../../constants';
import { ARENA_ENTRANCE_KEYS, ARENA_ENTRANCE_LABELS, type ArenaEntranceKey } from '../../constants/arenaEntrance.js';
import Button from '../Button.js';
import AdminPageHeader from './AdminPageHeader.js';
import KataServerLevelReferenceCard from './KataServerLevelReferenceCard.js';
import { adminCard, adminCardTitle, adminCheckRow, adminInput, adminPageNarrow, adminSectionGap } from './adminChrome.js';

interface KataGoStatus {
    status: 'running' | 'starting' | 'stopped';
    processRunning: boolean;
    isStarting: boolean;
    pendingQueries: number;
    config: Record<string, string | number | boolean>;
    log: {
        path: string;
        size: number;
        lastModified: string;
        recentLines?: string[];
        totalLines?: number;
    } | null;
}

// FIX: The component uses various props which were not defined in the interface.
// The extended `AdminProps` type is likely incomplete. Defining the props directly fixes the type error.
interface ServerSettingsPanelProps {
    gameModeAvailability?: Partial<Record<GameMode, boolean>>;
    arenaEntranceAvailability?: Record<ArenaEntranceKey, boolean>;
    announcements?: Announcement[];
    globalOverrideAnnouncement: OverrideAnnouncement | null;
    announcementInterval?: number;
    onAction: (action: ServerAction) => void;
    onBack: () => void;
}

const ServerSettingsPanel: React.FC<ServerSettingsPanelProps> = (props) => {
    const {
        gameModeAvailability = {},
        arenaEntranceAvailability = {} as Record<ArenaEntranceKey, boolean>,
        announcements = [],
        globalOverrideAnnouncement,
        announcementInterval = 10,
        onAction,
        onBack,
    } = props;
    const [newAnnouncement, setNewAnnouncement] = useState('');
    const [overrideMessage, setOverrideMessage] = useState(globalOverrideAnnouncement?.message || '');
    const [localAnnouncements, setLocalAnnouncements] = useState<Announcement[]>(announcements);
    const [localInterval, setLocalInterval] = useState(announcementInterval);
    const [kataGoStatus, setKataGoStatus] = useState<KataGoStatus | null>(null);
    const [kataGoLoading, setKataGoLoading] = useState(false);
    const [kataGoError, setKataGoError] = useState<string | null>(null);

    const dragItem = useRef<number | null>(null);
    const dragOverItem = useRef<number | null>(null);
    
    useEffect(() => { setLocalAnnouncements(Array.isArray(announcements) ? announcements : []); }, [announcements]);
    useEffect(() => { setLocalInterval(announcementInterval); }, [announcementInterval]);
    useEffect(() => { setOverrideMessage(globalOverrideAnnouncement?.message || '')}, [globalOverrideAnnouncement]);
    
    const fetchKataGoStatus = async () => {
        setKataGoLoading(true);
        setKataGoError(null);
        try {
            const response = await fetch('/api/admin/katago-status');
            if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            const data = await response.json();
            setKataGoStatus(data);
        } catch (err: any) {
            setKataGoError(err.message);
            console.error('[ServerSettings] Failed to fetch KataGo status:', err);
        } finally {
            setKataGoLoading(false);
        }
    };
    
    useEffect(() => {
        fetchKataGoStatus();
    }, []);

    const handleDragSort = () => {
        if (dragItem.current === null || dragOverItem.current === null || dragItem.current === dragOverItem.current) {
            dragItem.current = null; dragOverItem.current = null; return;
        }
        const items = [...localAnnouncements];
        const draggedItemContent = items.splice(dragItem.current, 1)[0];
        items.splice(dragOverItem.current, 0, draggedItemContent);
        dragItem.current = null; dragOverItem.current = null;
        setLocalAnnouncements(items);
        onAction({ type: 'ADMIN_REORDER_ANNOUNCEMENTS', payload: { announcements: items } });
    };

    const handleAddAnnouncement = (e: React.FormEvent) => {
        e.preventDefault();
        if (!newAnnouncement.trim()) return;
        onAction({ type: 'ADMIN_ADD_ANNOUNCEMENT', payload: { message: newAnnouncement } });
        setNewAnnouncement('');
    };
    
    const handleSetOverride = (e: React.FormEvent) => {
        e.preventDefault();
        if(!overrideMessage.trim()) return;
        onAction({ type: 'ADMIN_SET_OVERRIDE_ANNOUNCEMENT', payload: { message: overrideMessage } });
    }

    const allGameModes = useMemo(() => [...SPECIAL_GAME_MODES, ...PLAYFUL_GAME_MODES], []);
    const kataGoRecentLines = kataGoStatus?.log?.recentLines ?? [];

    type ServerSettingsMobileTab = 'modes' | 'lobby' | 'emergency' | 'katago';
    const [mobileTab, setMobileTab] = useState<ServerSettingsMobileTab>('modes');

    const mobileTabs: { id: ServerSettingsMobileTab; label: string }[] = [
        { id: 'modes', label: '모드·입장' },
        { id: 'lobby', label: '대기실 공지' },
        { id: 'emergency', label: '긴급 공지' },
        { id: 'katago', label: 'KataGo' },
    ];

    const modeEntranceCard = (
        <div className={adminCard}>
            <h2 className={adminCardTitle}>게임 모드 활성화</h2>
            <div className="grid grid-cols-2 gap-2 text-sm sm:gap-3">
                {allGameModes.map((m) => (
                    <label key={m.mode} className={adminCheckRow}>
                        <input
                            type="checkbox"
                            checked={gameModeAvailability[m.mode] ?? m.available}
                            onChange={(e) =>
                                onAction({ type: 'ADMIN_TOGGLE_GAME_MODE', payload: { mode: m.mode, isAvailable: e.target.checked } })
                            }
                            className="h-4 w-4 shrink-0 rounded border-color text-amber-500 focus:ring-amber-400/30"
                        />
                        <span className="text-primary">{m.mode}</span>
                    </label>
                ))}
            </div>
            <h3 className="mb-2 mt-6 text-base font-semibold text-secondary">경기장 입장</h3>
            <p className="mb-3 text-xs text-tertiary">로비·대기실·챔피언십·모험 등 허브 입장을 막습니다. (게임 모드 활성화와 별도)</p>
            <div className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-2 sm:gap-3">
                {ARENA_ENTRANCE_KEYS.map((key) => (
                    <label key={key} className={adminCheckRow}>
                        <input
                            type="checkbox"
                            checked={arenaEntranceAvailability[key] ?? true}
                            onChange={(e) =>
                                onAction({
                                    type: 'ADMIN_TOGGLE_ARENA_ENTRANCE',
                                    payload: { arena: key, isOpen: e.target.checked },
                                })
                            }
                            className="h-4 w-4 shrink-0 rounded border-color text-amber-500 focus:ring-amber-400/30"
                        />
                        <span>{ARENA_ENTRANCE_LABELS[key]} 입장 허용</span>
                    </label>
                ))}
            </div>
        </div>
    );

    const lobbyAnnouncementsCard = (
        <div className={adminCard}>
            <h2 className={adminCardTitle}>대기실 공지사항</h2>
            <div className="mb-4 max-h-60 space-y-2 overflow-y-auto">
                {localAnnouncements.map((ann, index) => (
                    <div
                        key={ann.id}
                        draggable
                        onDragStart={() => (dragItem.current = index)}
                        onDragEnter={() => (dragOverItem.current = index)}
                        onDragEnd={handleDragSort}
                        onDragOver={(e) => e.preventDefault()}
                        className="flex cursor-grab items-center justify-between gap-2 rounded-xl border border-color/40 bg-secondary/40 px-3 py-2.5 active:cursor-grabbing"
                    >
                        <span className="text-sm text-primary">{ann.message}</span>
                        <button
                            type="button"
                            onClick={() => onAction({ type: 'ADMIN_REMOVE_ANNOUNCEMENT', payload: { id: ann.id } })}
                            className="shrink-0 rounded-lg px-2 py-1 text-sm font-bold text-red-400 transition-colors hover:bg-red-500/15 hover:text-red-300"
                        >
                            삭제
                        </button>
                    </div>
                ))}
            </div>
            <form onSubmit={handleAddAnnouncement} className="flex flex-col gap-2 sm:flex-row">
                <input
                    type="text"
                    value={newAnnouncement}
                    onChange={(e) => setNewAnnouncement(e.target.value)}
                    placeholder="새 공지사항..."
                    className={`${adminInput} flex-1`}
                />
                <Button type="submit" colorScheme="green" className="!text-sm shrink-0">
                    추가
                </Button>
            </form>
            <div className="mt-4 flex flex-wrap items-center gap-2">
                <label className="text-sm text-gray-400">간격(초):</label>
                <input
                    type="number"
                    min={1}
                    max={60}
                    value={localInterval}
                    onChange={(e) => setLocalInterval(parseInt(e.target.value, 10))}
                    className={`${adminInput} w-24`}
                />
                <Button onClick={() => onAction({ type: 'ADMIN_SET_ANNOUNCEMENT_INTERVAL', payload: { interval: localInterval } })} className="!text-xs">
                    적용
                </Button>
            </div>
        </div>
    );

    const emergencyCard = (
        <div className={adminCard}>
            <h2 className={adminCardTitle}>긴급 전체 공지</h2>
            <form onSubmit={handleSetOverride} className="flex flex-col gap-2 sm:flex-row">
                <input
                    type="text"
                    value={overrideMessage}
                    onChange={(e) => setOverrideMessage(e.target.value)}
                    placeholder="긴급 공지 메시지..."
                    className={`${adminInput} flex-1`}
                />
                <Button type="submit" colorScheme="yellow" className="!text-sm shrink-0">
                    설정
                </Button>
            </form>
            {globalOverrideAnnouncement && (
                <Button onClick={() => onAction({ type: 'ADMIN_CLEAR_OVERRIDE_ANNOUNCEMENT' })} colorScheme="red" className="mt-3 w-full !text-sm">
                    긴급 공지 해제
                </Button>
            )}
        </div>
    );

    const kataGoCard = (
        <div className={adminCard}>
            <div className="mb-4 flex flex-col gap-2 border-b border-color/50 pb-3 sm:flex-row sm:items-center sm:justify-between">
                <h2 className="text-lg font-semibold tracking-tight text-primary">KataGo 상태</h2>
                <div className="flex flex-wrap gap-2">
                    {kataGoStatus && kataGoStatus.status === 'stopped' && !kataGoStatus.config.USE_HTTP_API && (
                        <Button
                            onClick={async () => {
                                setKataGoLoading(true);
                                setKataGoError(null);
                                try {
                                    const response = await fetch('/api/admin/katago-start', { method: 'POST' });
                                    const data = await response.json();
                                    if (!response.ok) {
                                        throw new Error(data.error || data.message || 'KataGo 시작 실패');
                                    }
                                    setTimeout(() => {
                                        fetchKataGoStatus();
                                    }, 2000);
                                } catch (err: any) {
                                    setKataGoError(err.message);
                                    console.error('[ServerSettings] Failed to start KataGo:', err);
                                } finally {
                                    setKataGoLoading(false);
                                }
                            }}
                            colorScheme="green"
                            className="!text-xs"
                            disabled={kataGoLoading}
                        >
                            {kataGoLoading ? '시작 중...' : '시작'}
                        </Button>
                    )}
                    <Button onClick={fetchKataGoStatus} className="!text-xs" disabled={kataGoLoading}>
                        {kataGoLoading ? '로딩 중...' : '새로고침'}
                    </Button>
                </div>
            </div>
            {kataGoError && (
                <div className="mb-4 rounded border border-red-500 bg-red-900/50 p-3 text-sm text-red-200">오류: {kataGoError}</div>
            )}
            {kataGoStatus && (
                <div className="space-y-4 text-sm">
                    <div>
                        <span className="font-semibold">상태: </span>
                        <span
                            className={
                                kataGoStatus.status === 'running'
                                    ? 'text-green-400'
                                    : kataGoStatus.status === 'starting'
                                      ? 'text-yellow-400'
                                      : 'text-red-400'
                            }
                        >
                            {kataGoStatus.status === 'running' ? '실행 중' : kataGoStatus.status === 'starting' ? '시작 중' : '중지됨'}
                        </span>
                        {kataGoStatus.pendingQueries > 0 && (
                            <span className="ml-2 text-yellow-400">(대기 중인 분석: {kataGoStatus.pendingQueries})</span>
                        )}
                    </div>
                    <div className="rounded bg-secondary/30 p-3">
                        <div className="mb-2 font-semibold">설정:</div>
                        <div className="space-y-1 font-mono text-xs">
                            <div>USE_HTTP_API: {kataGoStatus.config.USE_HTTP_API ? 'true' : 'false'}</div>
                            {kataGoStatus.config.USE_HTTP_API && <div>KATAGO_API_URL: {kataGoStatus.config.KATAGO_API_URL}</div>}
                            {!kataGoStatus.config.USE_HTTP_API && (
                                <>
                                    <div>KATAGO_PATH: {kataGoStatus.config.KATAGO_PATH}</div>
                                    <div>KATAGO_MODEL_PATH: {kataGoStatus.config.KATAGO_MODEL_PATH}</div>
                                    <div>KATAGO_MAX_VISITS: {kataGoStatus.config.KATAGO_MAX_VISITS}</div>
                                    <div>KATAGO_NUM_ANALYSIS_THREADS: {kataGoStatus.config.KATAGO_NUM_ANALYSIS_THREADS}</div>
                                </>
                            )}
                        </div>
                    </div>
                    {kataGoStatus.log && (
                        <div className="rounded bg-secondary/30 p-3">
                            <div className="mb-2 font-semibold">로그 파일:</div>
                            <div className="space-y-1 text-xs">
                                <div>경로: {kataGoStatus.log.path}</div>
                                <div>크기: {(kataGoStatus.log.size / 1024).toFixed(2)} KB</div>
                                <div>마지막 수정: {new Date(kataGoStatus.log.lastModified).toLocaleString()}</div>
                                <div>전체 라인 수: {kataGoStatus.log.totalLines ?? 0}</div>
                                {kataGoRecentLines.length > 0 && (
                                    <div className="mt-2 max-h-40 overflow-y-auto rounded bg-black/50 p-2 font-mono text-xs">
                                        <div className="mb-1 font-semibold">최근 로그 ({kataGoRecentLines.length}줄):</div>
                                        {kataGoRecentLines.slice(-20).map((line, idx) => (
                                            <div key={idx} className="text-gray-300">
                                                {line}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );

    return (
        <div className={`${adminPageNarrow} ${adminSectionGap}`}>
            <AdminPageHeader
                title="서버 설정"
                subtitle="대기실 공지, 경기장 입장, 게임 모드, 긴급 공지, KataGo 연동 상태를 관리합니다."
                onBack={onBack}
            />

            {/* 모바일: 탭 + 단일 패널 */}
            <div className="lg:hidden">
                <div
                    className="sticky top-0 z-20 -mx-1 mb-4 border-b border-color/40 bg-primary/95 px-1 pb-3 pt-0 backdrop-blur-md"
                    role="tablist"
                    aria-label="서버 설정 구역"
                >
                    <div className="flex gap-1.5 overflow-x-auto pb-0.5 [-webkit-overflow-scrolling:touch]">
                        {mobileTabs.map((tab) => {
                            const active = mobileTab === tab.id;
                            return (
                                <button
                                    key={tab.id}
                                    type="button"
                                    role="tab"
                                    aria-selected={active}
                                    onClick={() => setMobileTab(tab.id)}
                                    className={`shrink-0 rounded-xl border px-3.5 py-2.5 text-xs font-semibold transition-all sm:text-sm ${
                                        active
                                            ? 'border-amber-400/50 bg-amber-500/15 text-amber-100 shadow-inner'
                                            : 'border-color/50 bg-secondary/40 text-gray-400 hover:border-color hover:bg-secondary/60 hover:text-primary'
                                    }`}
                                >
                                    {tab.label}
                                </button>
                            );
                        })}
                    </div>
                </div>
                <div className="min-h-[12rem]" role="tabpanel">
                    {mobileTab === 'modes' && modeEntranceCard}
                    {mobileTab === 'lobby' && lobbyAnnouncementsCard}
                    {mobileTab === 'emergency' && emergencyCard}
                    {mobileTab === 'katago' && (
                        <div className={adminSectionGap}>
                            {kataGoCard}
                            <KataServerLevelReferenceCard />
                        </div>
                    )}
                </div>
            </div>

            {/* 데스크톱: 기존 2열 */}
            <div className="hidden grid-cols-1 gap-6 lg:grid lg:grid-cols-2 lg:gap-8">
                <div className={adminSectionGap}>{modeEntranceCard}</div>
                <div className={adminSectionGap}>
                    {lobbyAnnouncementsCard}
                    {emergencyCard}
                    {kataGoCard}
                    <KataServerLevelReferenceCard />
                </div>
            </div>
        </div>
    );
};

export default ServerSettingsPanel;
