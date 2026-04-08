


import React, { useState } from 'react';
import DraggableWindow from './DraggableWindow.js';
import { useAppContext } from '../hooks/useAppContext.js';
import { SoundCategory, PanelEdgeStyle } from '../types.js';
import ToggleSwitch from './ui/ToggleSwitch.js';
import Slider from './ui/Slider.js';
import ColorSwatch from './ui/ColorSwatch.js';
import { getPanelEdgeImages } from '../constants/panelEdges.js';

interface SettingsModalProps {
    onClose: () => void;
    isTopmost?: boolean;
}

type SettingsTab = 'graphics' | 'sound' | 'features' | 'account';

const SettingsSection: React.FC<{ title: string; children: React.ReactNode; className?: string }> = ({
    title,
    children,
    className = '',
}) => (
    <section
        className={`relative overflow-hidden rounded-xl border border-amber-500/20 bg-gradient-to-b from-zinc-900/92 via-zinc-950/96 to-black/90 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_18px_48px_-28px_rgba(0,0,0,0.75)] ring-1 ring-white/[0.05] sm:p-5 ${className}`}
    >
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-amber-400/35 to-transparent" aria-hidden />
        <div className="relative mb-4 flex items-center gap-3">
            <div
                className="h-9 w-1 shrink-0 rounded-full bg-gradient-to-b from-amber-300 via-amber-500 to-amber-700 shadow-[0_0_16px_rgba(251,191,36,0.45)]"
                aria-hidden
            />
            <h3 className="text-base font-bold tracking-tight text-amber-50/95">{title}</h3>
        </div>
        <div className="relative">{children}</div>
    </section>
);

/** 계정 탭: 아이디·비밀번호 전환 버튼 */
const accountToggleBtnClass = (active: boolean) =>
    `relative flex min-h-[3rem] flex-1 items-center justify-center gap-2 overflow-hidden rounded-xl border px-3 py-2.5 text-center text-sm font-semibold tracking-tight transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/45 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0e1016] ${
        active
            ? 'border-amber-400/50 bg-gradient-to-b from-amber-600/30 via-amber-950/55 to-black/85 text-amber-50 shadow-[inset_0_1px_0_rgba(255,255,255,0.14),0_0_32px_-10px_rgba(251,191,36,0.4)] ring-1 ring-amber-400/30'
            : 'border-white/[0.1] bg-gradient-to-b from-zinc-800/55 to-zinc-950/75 text-slate-400 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] hover:border-amber-500/35 hover:text-amber-100/95 hover:shadow-[0_0_24px_-12px_rgba(251,191,36,0.22)]'
    }`;

const accountSubmitBtnClass =
    'relative inline-flex w-full items-center justify-center overflow-hidden rounded-xl border border-amber-400/40 bg-gradient-to-b from-amber-500/95 via-amber-600/92 to-amber-900/95 px-4 py-3 text-sm font-bold tracking-wide text-stone-950 shadow-[inset_0_1px_0_rgba(255,255,255,0.38),0_10px_32px_-8px_rgba(245,158,11,0.42)] transition duration-200 hover:brightness-110 hover:shadow-[0_14px_36px_-6px_rgba(251,191,36,0.45)] focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-300/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0e1016] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-55 disabled:hover:brightness-100';

/** 비상·탈퇴: 붉은 계열 프리미엄 CTA */
const dangerCtaBtnClass =
    'group relative inline-flex w-full items-center justify-center overflow-hidden rounded-xl border border-red-400/45 bg-gradient-to-b from-red-600/96 via-rose-800/96 to-rose-950/98 px-4 py-3.5 text-sm font-bold tracking-[0.06em] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.2),0_0_0_1px_rgba(0,0,0,0.25),0_14px_40px_-10px_rgba(220,38,38,0.55)] transition duration-200 hover:border-red-300/55 hover:shadow-[0_0_44px_-8px_rgba(248,113,113,0.5)] focus:outline-none focus-visible:ring-2 focus-visible:ring-red-400/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0e1016] active:scale-[0.99] active:brightness-95 disabled:cursor-not-allowed disabled:opacity-55';

const dangerOutlineBtnClass = (active: boolean) =>
    `relative inline-flex w-full items-center justify-center overflow-hidden rounded-xl border px-4 py-3.5 text-sm font-semibold tracking-wide transition duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-400/45 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0e1016] active:scale-[0.995] ${
        active
            ? 'border-red-400/50 bg-gradient-to-b from-red-950/70 to-black/80 text-red-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_0_28px_-12px_rgba(239,68,68,0.35)] ring-1 ring-red-500/25'
            : 'border-red-500/35 bg-gradient-to-b from-red-950/40 to-black/50 text-red-100/90 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] hover:border-red-400/45 hover:shadow-[0_0_28px_-10px_rgba(239,68,68,0.3)]'
    }`;

const SettingsModal: React.FC<SettingsModalProps> = ({ onClose, isTopmost }) => {
    const {
        settings,
        updateSoundSetting,
        updateFeatureSetting,
        updatePanelColor,
        updateTextColor,
        updatePanelEdgeStyle,
        resetGraphicsToDefault,
        handlers,
        currentUserWithStatus,
    } = useAppContext();
    const [activeTab, setActiveTab] = useState<SettingsTab>('graphics');
    const [showChangeUsername, setShowChangeUsername] = useState(false);
    const [showChangePassword, setShowChangePassword] = useState(false);
    const [showWithdraw, setShowWithdraw] = useState(false);
    const [newUsername, setNewUsername] = useState('');
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [withdrawPassword, setWithdrawPassword] = useState('');
    const [withdrawConfirm, setWithdrawConfirm] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    
    const handleEmergencyExit = async () => {
        if (!window.confirm('비상탈출을 사용하시겠습니까?\n\n모든 플레이 중인 게임이 강제 종료되며, PVP 경기장에서는 기권패 처리됩니다.')) {
            return;
        }
        
        try {
            const result = await handlers.handleAction({ type: 'EMERGENCY_EXIT' }) as any;
            // 서버에서 redirectTo를 반환하거나, 직접 홈화면으로 이동
            const redirectTo = result?.clientResponse?.redirectTo || '#/';
            window.location.hash = redirectTo;
        } catch (error) {
            console.error('Emergency exit failed:', error);
            alert('비상탈출 실행 중 오류가 발생했습니다.');
            // 오류가 발생해도 홈화면으로 이동
            window.location.hash = '#/';
        }
    };

    const handleChangeUsername = async () => {
        if (!newUsername || !currentPassword) {
            setError('새 아이디와 현재 비밀번호를 입력해주세요.');
            return;
        }
        
        setIsLoading(true);
        setError(null);
        
        try {
            const result = await handlers.handleAction({
                type: 'CHANGE_USERNAME',
                payload: { newUsername, password: currentPassword }
            }) as any;
            
            if (result?.error) {
                setError(result.error);
            } else {
                alert('아이디가 변경되었습니다.');
                setShowChangeUsername(false);
                setNewUsername('');
                setCurrentPassword('');
            }
        } catch (err: any) {
            setError(err.message || '아이디 변경 중 오류가 발생했습니다.');
        } finally {
            setIsLoading(false);
        }
    };

    const handleChangePassword = async () => {
        if (!currentPassword || !newPassword) {
            setError('현재 비밀번호와 새 비밀번호를 입력해주세요.');
            return;
        }
        
        if (newPassword.length < 6) {
            setError('새 비밀번호는 최소 6자 이상이어야 합니다.');
            return;
        }
        
        setIsLoading(true);
        setError(null);
        
        try {
            const result = await handlers.handleAction({
                type: 'CHANGE_PASSWORD',
                payload: { currentPassword, newPassword }
            }) as any;
            
            if (result?.error) {
                setError(result.error);
            } else {
                alert('비밀번호가 변경되었습니다.');
                setShowChangePassword(false);
                setCurrentPassword('');
                setNewPassword('');
            }
        } catch (err: any) {
            setError(err.message || '비밀번호 변경 중 오류가 발생했습니다.');
        } finally {
            setIsLoading(false);
        }
    };

    const handleWithdraw = async () => {
        if (!withdrawPassword || !withdrawConfirm) {
            setError('비밀번호와 확인 문구를 입력해주세요.');
            return;
        }
        
        if (withdrawConfirm !== '회원탈퇴') {
            setError('확인 문구가 올바르지 않습니다. "회원탈퇴"를 정확히 입력해주세요.');
            return;
        }
        
        if (!window.confirm('정말 회원탈퇴를 하시겠습니까?\n\n회원탈퇴 시 모든 데이터가 삭제되며, 동일한 이메일로는 1주일간 재가입이 불가능합니다.')) {
            return;
        }
        
        setIsLoading(true);
        setError(null);
        
        try {
            const result = await handlers.handleAction({
                type: 'WITHDRAW_USER',
                payload: { password: withdrawPassword, confirmText: withdrawConfirm }
            }) as any;
            
            if (result?.error) {
                setError(result.error);
            } else {
                alert('회원탈퇴가 완료되었습니다.\n동일한 이메일로는 1주일간 재가입이 불가능합니다.');
                const redirectTo = result?.clientResponse?.redirectTo || '#/login';
                window.location.hash = redirectTo;
            }
        } catch (err: any) {
            setError(err.message || '회원탈퇴 중 오류가 발생했습니다.');
        } finally {
            setIsLoading(false);
        }
    };
    
    const tabs: { id: SettingsTab; label: string }[] = [
        { id: 'graphics', label: '그래픽' },
        { id: 'sound', label: '사운드' },
        { id: 'features', label: '기능' },
        { id: 'account', label: '계정' },
    ];

    const soundCategories: { key: SoundCategory, label: string }[] = [
        { key: 'stone', label: '착수/충돌/낙하 소리' },
        { key: 'notification', label: '획득/레벨업 알림' },
        { key: 'item', label: '아이템 사용 소리' },
        { key: 'countdown', label: '초읽기/카운트다운 소리' },
        { key: 'turn', label: '내 턴 알림 소리' },
    ];

    const PANEL_EDGE_OPTIONS: { id: PanelEdgeStyle; label: string; description?: string }[] = [
        { id: 'none', label: '엣지 없음' },
        { id: 'default', label: '클래식 엣지' },
        { id: 'style1', label: '에메랄드' },
        { id: 'style2', label: '코발트' },
        { id: 'style3', label: '크림슨' },
        { id: 'style4', label: '자수정' },
        { id: 'style5', label: '황금' },
    ];

    const renderEdgePreview = (style: PanelEdgeStyle) => {
        const edges = getPanelEdgeImages(style);
        const backgroundImage = [edges.topLeft, edges.topRight, edges.bottomLeft, edges.bottomRight]
            .map(img => img ?? 'none')
            .join(', ');
        return (
            <div
                className="h-14 w-20 rounded-lg border border-white/10 bg-panel shadow-inner ring-1 ring-white/[0.04]"
                style={{
                    backgroundImage,
                    backgroundRepeat: 'no-repeat, no-repeat, no-repeat, no-repeat',
                    backgroundPosition: 'top left, top right, bottom left, bottom right',
                    backgroundSize: '28px 28px',
                }}
            />
        );
    };

    const renderContent = () => {
        switch (activeTab) {
            case 'graphics':
                return (
                    <div className="flex flex-col gap-5">
                        <SettingsSection title="패널 엣지 스타일">
                            <p className="mb-1 text-xs leading-relaxed text-slate-400">
                                대기실·프로필·모든 모달 창 등 UI 전역에 동일하게 적용됩니다. 기본값은 클래식 엣지입니다.
                            </p>
                            <div className="space-y-4">
                                <div className="flex items-center justify-center rounded-xl border border-amber-500/15 bg-black/35 p-8 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] ring-1 ring-white/[0.04]">
                                    {renderEdgePreview(settings.graphics.panelEdgeStyle ?? 'default')}
                                </div>
                                <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 sm:gap-3">
                                    {PANEL_EDGE_OPTIONS.map(option => (
                                        <label
                                            key={option.id}
                                            className="flex cursor-pointer items-center gap-2 rounded-xl border border-white/[0.08] bg-black/25 px-3 py-2.5 transition-all duration-150 has-[:checked]:border-amber-400/55 has-[:checked]:bg-amber-950/40 has-[:checked]:shadow-[0_0_20px_-8px_rgba(251,191,36,0.35)] has-[:checked]:ring-1 has-[:checked]:ring-amber-400/20"
                                        >
                                            <input
                                                type="radio"
                                                name="panelEdgeStyle"
                                                value={option.id}
                                                checked={(settings.graphics.panelEdgeStyle ?? 'default') === option.id}
                                                onChange={() => updatePanelEdgeStyle(option.id)}
                                                className="h-4 w-4 shrink-0 border-color bg-secondary text-accent focus:ring-accent"
                                            />
                                            <span className="flex-1 whitespace-nowrap text-sm font-medium text-amber-50/95">
                                                {option.label}
                                            </span>
                                        </label>
                                    ))}
                                </div>
                            </div>
                        </SettingsSection>
                    </div>
                );
            case 'sound':
                return (
                    <div className="flex flex-col gap-5">
                        <SettingsSection title="출력">
                            <div className="space-y-5">
                                <div>
                                    <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-amber-200/80">
                                        마스터 볼륨
                                    </p>
                                    <div className="flex items-center gap-4 rounded-xl border border-white/10 bg-black/30 px-3 py-3 shadow-inner ring-1 ring-white/[0.04]">
                                        <span className="w-11 text-center font-mono text-lg tabular-nums text-amber-100">
                                            {(settings.sound.masterVolume * 10).toFixed(0)}
                                        </span>
                                        <Slider
                                            min={0}
                                            max={1}
                                            step={0.1}
                                            value={settings.sound.masterVolume}
                                            onChange={(v) => updateSoundSetting('masterVolume', v)}
                                            disabled={settings.sound.masterMuted}
                                        />
                                    </div>
                                </div>
                                <div className="flex items-center justify-between gap-3 rounded-xl border border-color/40 bg-secondary/20 px-4 py-3">
                                    <span className="text-sm font-medium text-text-primary">효과음 전체</span>
                                    <ToggleSwitch
                                        checked={!settings.sound.masterMuted}
                                        onChange={(checked) => updateSoundSetting('masterMuted', !checked)}
                                    />
                                </div>
                            </div>
                        </SettingsSection>
                        <SettingsSection title="효과음 세부 조절">
                            <div className="flex flex-col gap-1">
                                {soundCategories.map(({ key, label }) => (
                                    <div
                                        key={key}
                                        className="flex items-center justify-between gap-3 rounded-lg border border-transparent px-2 py-2.5 transition-colors hover:border-amber-500/15 hover:bg-white/[0.04]"
                                    >
                                        <span className="text-sm text-slate-300">{label}</span>
                                        <ToggleSwitch
                                            checked={!settings.sound.categoryMuted[key]}
                                            onChange={(checked) =>
                                                updateSoundSetting('categoryMuted', {
                                                    ...settings.sound.categoryMuted,
                                                    [key]: !checked,
                                                })
                                            }
                                            disabled={settings.sound.masterMuted}
                                        />
                                    </div>
                                ))}
                            </div>
                        </SettingsSection>
                    </div>
                );
            case 'features':
                return (
                    <div className="flex flex-col gap-5">
                        <SettingsSection title="게임 플레이">
                            <div className="flex flex-col gap-1">
                                <div className="flex items-center justify-between gap-3 rounded-lg border border-transparent px-2 py-2.5 hover:border-amber-500/15 hover:bg-white/[0.04]">
                                    <span className="text-sm text-slate-300">착수 버튼 사용</span>
                                    <ToggleSwitch
                                        checked={settings.features.moveConfirmButtonBox}
                                        onChange={(checked) => updateFeatureSetting('moveConfirmButtonBox', checked)}
                                    />
                                </div>
                                <div className="flex items-center justify-between gap-3 rounded-lg border border-transparent px-2 py-2.5 hover:border-amber-500/15 hover:bg-white/[0.04]">
                                    <span className="text-sm text-slate-300">돌 미리보기 (마우스 호버)</span>
                                    <ToggleSwitch
                                        checked={settings.features.stonePreview}
                                        onChange={(checked) => updateFeatureSetting('stonePreview', checked)}
                                    />
                                </div>
                                <div className="flex items-center justify-between gap-3 rounded-lg border border-transparent px-2 py-2.5 hover:border-amber-500/15 hover:bg-white/[0.04]">
                                    <span className="text-sm text-slate-300">마지막 놓은 자리 표시</span>
                                    <ToggleSwitch
                                        checked={settings.features.lastMoveMarker}
                                        onChange={(checked) => updateFeatureSetting('lastMoveMarker', checked)}
                                    />
                                </div>
                                <div className="flex items-center justify-between gap-3 rounded-lg border border-transparent px-2 py-2.5 hover:border-amber-500/15 hover:bg-white/[0.04]">
                                    <span className="text-sm text-slate-300">따낸점수 애니메이션</span>
                                    <ToggleSwitch
                                        checked={settings.features.captureScoreAnimation}
                                        onChange={(checked) => updateFeatureSetting('captureScoreAnimation', checked)}
                                    />
                                </div>
                            </div>
                        </SettingsSection>
                        <SettingsSection title="알림">
                            <div className="flex flex-col gap-1">
                                <div className="flex items-center justify-between gap-3 rounded-lg border border-transparent px-2 py-2.5 hover:border-amber-500/15 hover:bg-white/[0.04]">
                                    <span className="text-sm text-slate-300">퀘스트 완료 알림</span>
                                    <ToggleSwitch
                                        checked={settings.features.questNotifications}
                                        onChange={(checked) => updateFeatureSetting('questNotifications', checked)}
                                    />
                                </div>
                                <div className="flex items-center justify-between gap-3 rounded-lg border border-transparent px-2 py-2.5 hover:border-amber-500/15 hover:bg-white/[0.04]">
                                    <span className="text-sm text-slate-300">채팅 내용 알림 (빨간 점)</span>
                                    <ToggleSwitch
                                        checked={settings.features.chatNotifications}
                                        onChange={(checked) => updateFeatureSetting('chatNotifications', checked)}
                                    />
                                </div>
                            </div>
                        </SettingsSection>
                        <SettingsSection title="비상 기능">
                            <div className="relative overflow-hidden rounded-2xl border border-red-500/30 bg-gradient-to-br from-[#1c080c] via-[#12060a] to-[#0a0406] p-[1px] shadow-[0_0_52px_-18px_rgba(220,38,38,0.45)]">
                                <div
                                    className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-red-400/50 to-transparent"
                                    aria-hidden
                                />
                                <div className="relative rounded-[0.95rem] bg-gradient-to-b from-red-950/35 via-black/40 to-black/55 p-4 ring-1 ring-inset ring-red-500/15">
                                    <p className="mb-4 text-sm leading-relaxed text-red-100/88">
                                        비상탈출 버튼을 사용하면 모든 플레이 중인 게임이 강제 종료되며, PVP 경기장에서는 기권패 처리됩니다.
                                    </p>
                                    <button type="button" onClick={handleEmergencyExit} className={dangerCtaBtnClass}>
                                        <span
                                            className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/25 to-transparent opacity-80"
                                            aria-hidden
                                        />
                                        <span className="relative flex items-center justify-center gap-2.5">
                                            <span
                                                className="inline-block h-2 w-2 shrink-0 rounded-full bg-red-100 shadow-[0_0_14px_rgba(254,202,202,0.95)]"
                                                aria-hidden
                                            />
                                            비상탈출
                                        </span>
                                    </button>
                                </div>
                            </div>
                        </SettingsSection>
                    </div>
                );
            case 'account':
                return (
                    <div className="flex flex-col gap-5">
                        <SettingsSection title="계정 관리">
                            <div className="mb-4 flex flex-col gap-2.5 sm:flex-row">
                                <button
                                    type="button"
                                    className={accountToggleBtnClass(showChangeUsername)}
                                    onClick={() => {
                                        setShowChangeUsername(!showChangeUsername);
                                        setShowChangePassword(false);
                                        setShowWithdraw(false);
                                        setError(null);
                                    }}
                                >
                                    <span
                                        className={`h-1.5 w-1.5 shrink-0 rounded-full ${showChangeUsername ? 'bg-amber-300 shadow-[0_0_10px_rgba(251,191,36,0.8)]' : 'bg-slate-600'}`}
                                        aria-hidden
                                    />
                                    {showChangeUsername ? '아이디 변경 취소' : '아이디 변경'}
                                </button>
                                <button
                                    type="button"
                                    className={accountToggleBtnClass(showChangePassword)}
                                    onClick={() => {
                                        setShowChangePassword(!showChangePassword);
                                        setShowChangeUsername(false);
                                        setShowWithdraw(false);
                                        setError(null);
                                    }}
                                >
                                    <span
                                        className={`h-1.5 w-1.5 shrink-0 rounded-full ${showChangePassword ? 'bg-amber-300 shadow-[0_0_10px_rgba(251,191,36,0.8)]' : 'bg-slate-600'}`}
                                        aria-hidden
                                    />
                                    {showChangePassword ? '비밀번호 변경 취소' : '비밀번호 변경'}
                                </button>
                            </div>
                            {showChangeUsername && (
                                <div className="mb-4 rounded-xl border border-amber-500/20 bg-black/35 p-4 ring-1 ring-inset ring-white/[0.05]">
                                    <div className="space-y-3">
                                        <div>
                                            <label className="mb-1 block text-sm text-slate-400">새 아이디</label>
                                            <input
                                                type="text"
                                                value={newUsername}
                                                onChange={(e) => setNewUsername(e.target.value)}
                                                className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2.5 text-amber-50 outline-none focus:ring-2 focus:ring-amber-400/35"
                                                placeholder="3-20자"
                                                disabled={isLoading}
                                            />
                                        </div>
                                        <div>
                                            <label className="mb-1 block text-sm text-slate-400">현재 비밀번호</label>
                                            <input
                                                type="password"
                                                value={currentPassword}
                                                onChange={(e) => setCurrentPassword(e.target.value)}
                                                className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2.5 text-amber-50 outline-none focus:ring-2 focus:ring-amber-400/35"
                                                disabled={isLoading}
                                            />
                                        </div>
                                        {error && <p className="text-sm text-red-400">{error}</p>}
                                        <button
                                            type="button"
                                            className={accountSubmitBtnClass}
                                            onClick={handleChangeUsername}
                                            disabled={isLoading}
                                        >
                                            {isLoading ? '처리 중...' : '변경하기'}
                                        </button>
                                    </div>
                                </div>
                            )}
                            {showChangePassword && (
                                <div className="mb-4 rounded-xl border border-amber-500/20 bg-black/35 p-4 ring-1 ring-inset ring-white/[0.05]">
                                    <div className="space-y-3">
                                        <div>
                                            <label className="mb-1 block text-sm text-slate-400">현재 비밀번호</label>
                                            <input
                                                type="password"
                                                value={currentPassword}
                                                onChange={(e) => setCurrentPassword(e.target.value)}
                                                className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2.5 text-amber-50 outline-none focus:ring-2 focus:ring-amber-400/35"
                                                disabled={isLoading}
                                            />
                                        </div>
                                        <div>
                                            <label className="mb-1 block text-sm text-slate-400">새 비밀번호</label>
                                            <input
                                                type="password"
                                                value={newPassword}
                                                onChange={(e) => setNewPassword(e.target.value)}
                                                className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2.5 text-amber-50 outline-none focus:ring-2 focus:ring-amber-400/35"
                                                placeholder="최소 6자"
                                                disabled={isLoading}
                                            />
                                        </div>
                                        {error && <p className="text-sm text-red-400">{error}</p>}
                                        <button
                                            type="button"
                                            className={accountSubmitBtnClass}
                                            onClick={handleChangePassword}
                                            disabled={isLoading}
                                        >
                                            {isLoading ? '처리 중...' : '변경하기'}
                                        </button>
                                    </div>
                                </div>
                            )}
                        </SettingsSection>
                        <SettingsSection title="회원탈퇴">
                            <div className="relative overflow-hidden rounded-2xl border border-red-500/28 bg-gradient-to-br from-[#1a0608] via-[#100407] to-[#0a0305] p-[1px] shadow-[0_0_48px_-20px_rgba(185,28,28,0.4)]">
                                <div
                                    className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-red-400/40 to-transparent"
                                    aria-hidden
                                />
                                <div className="relative rounded-[0.95rem] bg-gradient-to-b from-red-950/40 via-black/45 to-black/60 p-4 ring-1 ring-inset ring-red-500/12">
                                    <p className="mb-4 text-sm leading-relaxed text-red-100/88">
                                        회원탈퇴 시 모든 데이터가 삭제되며 복구할 수 없습니다. 동일한 이메일로는 1주일간 재가입이 불가능합니다.
                                    </p>
                                    <button
                                        type="button"
                                        className={dangerOutlineBtnClass(showWithdraw)}
                                        onClick={() => {
                                            setShowWithdraw(!showWithdraw);
                                            setShowChangeUsername(false);
                                            setShowChangePassword(false);
                                            setError(null);
                                        }}
                                    >
                                        {showWithdraw ? '취소' : '회원탈퇴'}
                                    </button>
                                    {showWithdraw && (
                                        <div className="mt-4 space-y-3 border-t border-red-500/20 pt-4">
                                            <div>
                                                <label className="mb-1 block text-sm font-medium text-red-100/85">비밀번호 확인</label>
                                                <input
                                                    type="password"
                                                    value={withdrawPassword}
                                                    onChange={(e) => setWithdrawPassword(e.target.value)}
                                                    className="w-full rounded-xl border border-red-500/35 bg-black/45 px-3 py-2.5 text-red-50/95 outline-none ring-1 ring-inset ring-white/[0.04] placeholder:text-red-200/30 focus:border-red-400/50 focus:ring-2 focus:ring-red-500/30"
                                                    disabled={isLoading}
                                                />
                                            </div>
                                            <div>
                                                <label className="mb-1 block text-sm font-medium text-red-100/85">
                                                    확인 문구 입력: &quot;회원탈퇴&quot;
                                                </label>
                                                <input
                                                    type="text"
                                                    value={withdrawConfirm}
                                                    onChange={(e) => setWithdrawConfirm(e.target.value)}
                                                    className="w-full rounded-xl border border-red-500/35 bg-black/45 px-3 py-2.5 text-red-50/95 outline-none ring-1 ring-inset ring-white/[0.04] placeholder:text-red-200/35 focus:border-red-400/50 focus:ring-2 focus:ring-red-500/30"
                                                    placeholder="회원탈퇴"
                                                    disabled={isLoading}
                                                />
                                            </div>
                                            {error && <p className="text-sm text-red-400">{error}</p>}
                                            <button
                                                type="button"
                                                className={dangerCtaBtnClass}
                                                onClick={handleWithdraw}
                                                disabled={isLoading}
                                            >
                                                <span
                                                    className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/25 to-transparent opacity-80"
                                                    aria-hidden
                                                />
                                                <span className="relative">{isLoading ? '처리 중...' : '탈퇴하기'}</span>
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </SettingsSection>
                    </div>
                );
        }
    };
    
    return (
        <DraggableWindow title="설정" onClose={onClose} windowId="settings" initialWidth={720} initialHeight={780} isTopmost={isTopmost}>
            <div className="flex h-full min-h-0 flex-1 flex-col rounded-2xl border border-amber-900/25 bg-gradient-to-b from-[#12141c] via-[#0e1016] to-[#08090e] p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
                <div className="mb-3 flex shrink-0 gap-1 rounded-xl border border-white/[0.08] bg-black/40 p-1 shadow-inner backdrop-blur-md">
                    {tabs.map(tab => (
                        <button
                            key={tab.id}
                            type="button"
                            onClick={() => setActiveTab(tab.id)}
                            className={`relative flex-1 overflow-hidden rounded-lg py-2.5 text-sm font-semibold transition-all duration-200 ${
                                activeTab === tab.id
                                    ? 'text-amber-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.12),0_0_24px_-4px_rgba(251,191,36,0.35)]'
                                    : 'text-slate-400 hover:bg-white/[0.06] hover:text-amber-100/90'
                            }`}
                        >
                            {activeTab === tab.id && (
                                <span
                                    className="pointer-events-none absolute inset-0 bg-gradient-to-b from-amber-600/35 via-amber-700/25 to-amber-900/35"
                                    aria-hidden
                                />
                            )}
                            <span className="relative z-[1]">{tab.label}</span>
                        </button>
                    ))}
                </div>
                <div className="min-h-0 flex-1 overflow-y-auto px-1 py-1 pr-2 sm:px-2">
                    {renderContent()}
                </div>
            </div>
        </DraggableWindow>
    );
};

export default SettingsModal;