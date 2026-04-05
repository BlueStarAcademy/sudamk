


import React, { useState } from 'react';
import DraggableWindow from './DraggableWindow.js';
import Button from './Button.js';
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
        className={`rounded-2xl border border-color/45 bg-gradient-to-br from-tertiary/40 via-tertiary/18 to-tertiary/5 p-4 sm:p-5 shadow-sm ring-1 ring-inset ring-white/[0.06] ${className}`}
    >
        <div className="mb-4 flex items-center gap-3">
            <div
                className="h-9 w-1 shrink-0 rounded-full bg-accent shadow-[0_0_14px] shadow-accent/30"
                aria-hidden
            />
            <h3 className="text-base font-semibold tracking-tight text-text-primary">{title}</h3>
        </div>
        {children}
    </section>
);

const SettingsModal: React.FC<SettingsModalProps> = ({ onClose, isTopmost }) => {
    const {
        settings,
        updateSoundSetting,
        updateFeatureSetting,
        updatePanelColor,
        updateTextColor,
        updatePanelEdgeStyle,
        updatePcLikeMobileLayout,
        resetGraphicsToDefault,
        handlers,
        currentUserWithStatus,
        showPcLikeMobileLayoutSetting,
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
                className="w-20 h-14 rounded-lg border border-color bg-panel"
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
                        {showPcLikeMobileLayoutSetting && (
                            <SettingsSection title="화면">
                                <div className="flex items-center justify-between gap-4 rounded-xl border border-color/50 bg-secondary/25 px-4 py-3.5">
                                    <span className="text-sm font-medium text-text-primary sm:text-[15px]">
                                        PC 화면 보기
                                    </span>
                                    <ToggleSwitch
                                        checked={settings.graphics.pcLikeMobileLayout === true}
                                        onChange={(checked) => updatePcLikeMobileLayout(checked)}
                                    />
                                </div>
                            </SettingsSection>
                        )}
                        <SettingsSection title="패널 엣지 스타일">
                            <p className="mb-1 text-xs leading-relaxed text-text-secondary">
                                대기실·프로필·모든 모달 창 등 UI 전역에 동일하게 적용됩니다. 기본값은 클래식 엣지입니다.
                            </p>
                            <div className="space-y-4">
                                <div className="flex items-center justify-center rounded-xl border border-color/50 bg-panel/80 p-8 shadow-inner">
                                    {renderEdgePreview(settings.graphics.panelEdgeStyle ?? 'default')}
                                </div>
                                <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 sm:gap-3">
                                    {PANEL_EDGE_OPTIONS.map(option => (
                                        <label
                                            key={option.id}
                                            className="flex cursor-pointer items-center gap-2 rounded-xl border border-color/35 bg-secondary/15 px-3 py-2.5 transition-all duration-150 has-[:checked]:border-accent has-[:checked]:bg-accent/10 has-[:checked]:shadow-sm has-[:checked]:ring-1 has-[:checked]:ring-accent/30"
                                        >
                                            <input
                                                type="radio"
                                                name="panelEdgeStyle"
                                                value={option.id}
                                                checked={(settings.graphics.panelEdgeStyle ?? 'default') === option.id}
                                                onChange={() => updatePanelEdgeStyle(option.id)}
                                                className="h-4 w-4 shrink-0 border-color bg-secondary text-accent focus:ring-accent"
                                            />
                                            <span className="flex-1 whitespace-nowrap text-sm font-medium text-text-primary">
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
                                    <p className="mb-2 text-xs font-medium uppercase tracking-wider text-text-secondary/90">
                                        마스터 볼륨
                                    </p>
                                    <div className="flex items-center gap-4 rounded-xl border border-color/40 bg-secondary/20 px-3 py-3">
                                        <span className="w-11 text-center font-mono text-lg tabular-nums text-text-primary">
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
                                        className="flex items-center justify-between gap-3 rounded-lg border border-transparent px-2 py-2.5 transition-colors hover:border-color/30 hover:bg-secondary/15"
                                    >
                                        <span className="text-sm text-text-secondary">{label}</span>
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
                                <div className="flex items-center justify-between gap-3 rounded-lg border border-transparent px-2 py-2.5 hover:border-color/30 hover:bg-secondary/15">
                                    <span className="text-sm text-text-secondary">돌 미리보기 (마우스 호버)</span>
                                    <ToggleSwitch
                                        checked={settings.features.stonePreview}
                                        onChange={(checked) => updateFeatureSetting('stonePreview', checked)}
                                    />
                                </div>
                                <div className="flex items-center justify-between gap-3 rounded-lg border border-transparent px-2 py-2.5 hover:border-color/30 hover:bg-secondary/15">
                                    <span className="text-sm text-text-secondary">마지막 놓은 자리 표시</span>
                                    <ToggleSwitch
                                        checked={settings.features.lastMoveMarker}
                                        onChange={(checked) => updateFeatureSetting('lastMoveMarker', checked)}
                                    />
                                </div>
                                <div className="flex items-center justify-between gap-3 rounded-lg border border-transparent px-2 py-2.5 hover:border-color/30 hover:bg-secondary/15">
                                    <span className="text-sm text-text-secondary">따낸점수 애니메이션</span>
                                    <ToggleSwitch
                                        checked={settings.features.captureScoreAnimation}
                                        onChange={(checked) => updateFeatureSetting('captureScoreAnimation', checked)}
                                    />
                                </div>
                            </div>
                        </SettingsSection>
                        <SettingsSection title="알림">
                            <div className="flex flex-col gap-1">
                                <div className="flex items-center justify-between gap-3 rounded-lg border border-transparent px-2 py-2.5 hover:border-color/30 hover:bg-secondary/15">
                                    <span className="text-sm text-text-secondary">퀘스트 완료 알림</span>
                                    <ToggleSwitch
                                        checked={settings.features.questNotifications}
                                        onChange={(checked) => updateFeatureSetting('questNotifications', checked)}
                                    />
                                </div>
                                <div className="flex items-center justify-between gap-3 rounded-lg border border-transparent px-2 py-2.5 hover:border-color/30 hover:bg-secondary/15">
                                    <span className="text-sm text-text-secondary">채팅 내용 알림 (빨간 점)</span>
                                    <ToggleSwitch
                                        checked={settings.features.chatNotifications}
                                        onChange={(checked) => updateFeatureSetting('chatNotifications', checked)}
                                    />
                                </div>
                            </div>
                        </SettingsSection>
                        <SettingsSection title="비상 기능">
                            <div className="rounded-xl border border-red-600/40 bg-gradient-to-br from-red-950/50 to-red-950/20 p-4 ring-1 ring-inset ring-red-500/15">
                                <p className="mb-4 text-sm leading-relaxed text-red-100/90">
                                    비상탈출 버튼을 사용하면 모든 플레이 중인 게임이 강제 종료되며, PVP 경기장에서는 기권패 처리됩니다.
                                </p>
                                <Button onClick={handleEmergencyExit} colorScheme="red" className="w-full shadow-md shadow-red-900/30">
                                    비상탈출
                                </Button>
                            </div>
                        </SettingsSection>
                    </div>
                );
            case 'account':
                return (
                    <div className="flex flex-col gap-5">
                        <SettingsSection title="계정 관리">
                            <div className="mb-4 flex flex-col gap-2.5 sm:flex-row">
                                <Button
                                    onClick={() => {
                                        setShowChangeUsername(!showChangeUsername);
                                        setShowChangePassword(false);
                                        setShowWithdraw(false);
                                        setError(null);
                                    }}
                                    colorScheme="blue"
                                    className="flex-1"
                                >
                                    {showChangeUsername ? '아이디 변경 취소' : '아이디 변경'}
                                </Button>
                                <Button
                                    onClick={() => {
                                        setShowChangePassword(!showChangePassword);
                                        setShowChangeUsername(false);
                                        setShowWithdraw(false);
                                        setError(null);
                                    }}
                                    colorScheme="blue"
                                    className="flex-1"
                                >
                                    {showChangePassword ? '비밀번호 변경 취소' : '비밀번호 변경'}
                                </Button>
                            </div>
                            {showChangeUsername && (
                                <div className="mb-4 rounded-xl border border-color/50 bg-secondary/20 p-4 ring-1 ring-inset ring-white/[0.04]">
                                    <div className="space-y-3">
                                        <div>
                                            <label className="mb-1 block text-sm text-text-secondary">새 아이디</label>
                                            <input
                                                type="text"
                                                value={newUsername}
                                                onChange={(e) => setNewUsername(e.target.value)}
                                                className="w-full rounded-lg border border-color bg-secondary px-3 py-2.5 text-text-primary outline-none focus:ring-2 focus:ring-accent/40"
                                                placeholder="3-20자"
                                                disabled={isLoading}
                                            />
                                        </div>
                                        <div>
                                            <label className="mb-1 block text-sm text-text-secondary">현재 비밀번호</label>
                                            <input
                                                type="password"
                                                value={currentPassword}
                                                onChange={(e) => setCurrentPassword(e.target.value)}
                                                className="w-full rounded-lg border border-color bg-secondary px-3 py-2.5 text-text-primary outline-none focus:ring-2 focus:ring-accent/40"
                                                disabled={isLoading}
                                            />
                                        </div>
                                        {error && <p className="text-sm text-red-400">{error}</p>}
                                        <Button
                                            onClick={handleChangeUsername}
                                            colorScheme="blue"
                                            className="w-full"
                                            disabled={isLoading}
                                        >
                                            {isLoading ? '처리 중...' : '변경하기'}
                                        </Button>
                                    </div>
                                </div>
                            )}
                            {showChangePassword && (
                                <div className="mb-4 rounded-xl border border-color/50 bg-secondary/20 p-4 ring-1 ring-inset ring-white/[0.04]">
                                    <div className="space-y-3">
                                        <div>
                                            <label className="mb-1 block text-sm text-text-secondary">현재 비밀번호</label>
                                            <input
                                                type="password"
                                                value={currentPassword}
                                                onChange={(e) => setCurrentPassword(e.target.value)}
                                                className="w-full rounded-lg border border-color bg-secondary px-3 py-2.5 text-text-primary outline-none focus:ring-2 focus:ring-accent/40"
                                                disabled={isLoading}
                                            />
                                        </div>
                                        <div>
                                            <label className="mb-1 block text-sm text-text-secondary">새 비밀번호</label>
                                            <input
                                                type="password"
                                                value={newPassword}
                                                onChange={(e) => setNewPassword(e.target.value)}
                                                className="w-full rounded-lg border border-color bg-secondary px-3 py-2.5 text-text-primary outline-none focus:ring-2 focus:ring-accent/40"
                                                placeholder="최소 6자"
                                                disabled={isLoading}
                                            />
                                        </div>
                                        {error && <p className="text-sm text-red-400">{error}</p>}
                                        <Button
                                            onClick={handleChangePassword}
                                            colorScheme="blue"
                                            className="w-full"
                                            disabled={isLoading}
                                        >
                                            {isLoading ? '처리 중...' : '변경하기'}
                                        </Button>
                                    </div>
                                </div>
                            )}
                        </SettingsSection>
                        <SettingsSection title="회원탈퇴">
                            <div className="rounded-xl border border-red-600/40 bg-gradient-to-br from-red-950/45 to-red-950/15 p-4 ring-1 ring-inset ring-red-500/15">
                                <p className="mb-4 text-sm leading-relaxed text-red-100/90">
                                    회원탈퇴 시 모든 데이터가 삭제되며 복구할 수 없습니다. 동일한 이메일로는 1주일간 재가입이 불가능합니다.
                                </p>
                                <Button
                                    onClick={() => {
                                        setShowWithdraw(!showWithdraw);
                                        setShowChangeUsername(false);
                                        setShowChangePassword(false);
                                        setError(null);
                                    }}
                                    colorScheme="red"
                                    className="w-full shadow-md shadow-red-900/25"
                                >
                                    {showWithdraw ? '취소' : '회원탈퇴'}
                                </Button>
                                {showWithdraw && (
                                    <div className="mt-4 space-y-3 border-t border-red-500/25 pt-4">
                                        <div>
                                            <label className="mb-1 block text-sm text-red-100/90">비밀번호 확인</label>
                                            <input
                                                type="password"
                                                value={withdrawPassword}
                                                onChange={(e) => setWithdrawPassword(e.target.value)}
                                                className="w-full rounded-lg border border-red-700/40 bg-secondary px-3 py-2.5 text-text-primary focus:ring-2 focus:ring-red-500/35"
                                                disabled={isLoading}
                                            />
                                        </div>
                                        <div>
                                            <label className="mb-1 block text-sm text-red-100/90">
                                                확인 문구 입력: &quot;회원탈퇴&quot;
                                            </label>
                                            <input
                                                type="text"
                                                value={withdrawConfirm}
                                                onChange={(e) => setWithdrawConfirm(e.target.value)}
                                                className="w-full rounded-lg border border-red-700/40 bg-secondary px-3 py-2.5 text-text-primary focus:ring-2 focus:ring-red-500/35"
                                                placeholder="회원탈퇴"
                                                disabled={isLoading}
                                            />
                                        </div>
                                        {error && <p className="text-sm text-red-400">{error}</p>}
                                        <Button
                                            onClick={handleWithdraw}
                                            colorScheme="red"
                                            className="w-full"
                                            disabled={isLoading}
                                        >
                                            {isLoading ? '처리 중...' : '탈퇴하기'}
                                        </Button>
                                    </div>
                                )}
                            </div>
                        </SettingsSection>
                    </div>
                );
        }
    };
    
    return (
        <DraggableWindow title="설정" onClose={onClose} windowId="settings" initialWidth={640} initialHeight={740} isTopmost={isTopmost}>
            <div className="flex h-[640px] flex-col bg-gradient-to-b from-tertiary/8 via-transparent to-tertiary/15 px-1 pb-1 sm:px-2">
                <div className="mb-4 flex shrink-0 gap-1 rounded-xl border border-color/40 bg-tertiary/30 p-1 shadow-inner ring-1 ring-inset ring-white/[0.05]">
                    {tabs.map(tab => (
                        <button
                            key={tab.id}
                            type="button"
                            onClick={() => setActiveTab(tab.id)}
                            className={`flex-1 rounded-lg py-2.5 text-sm font-medium transition-all duration-200 ${
                                activeTab === tab.id
                                    ? 'bg-accent font-semibold text-primary shadow-md shadow-accent/25 ring-1 ring-inset ring-white/15'
                                    : 'text-text-secondary hover:bg-secondary/45 hover:text-text-primary'
                            }`}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>
                <div className="min-h-0 flex-1 overflow-y-auto px-2 py-1 pr-3 sm:px-3">
                    {renderContent()}
                </div>
                <div className="mt-auto flex shrink-0 justify-end border-t border-color/50 bg-gradient-to-t from-tertiary/20 to-transparent px-2 pb-1 pt-4 sm:px-3">
                    <Button onClick={onClose} colorScheme="gray" className="min-w-[5.5rem] shadow-sm">
                        닫기
                    </Button>
                </div>
            </div>
        </DraggableWindow>
    );
};

export default SettingsModal;