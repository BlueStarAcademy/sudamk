


import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import DraggableWindow from './DraggableWindow.js';
import { useAppContext } from '../hooks/useAppContext.js';
import { SoundCategory, PanelEdgeStyle } from '../types.js';
import ToggleSwitch from './ui/ToggleSwitch.js';
import Slider from './ui/Slider.js';
import { getPanelEdgeImages } from '../constants/panelEdges.js';
import { markSkipGameHashLeaveInterceptOnce, navigateFromGameIfApplicable } from '../utils/appUtils.js';
import { PC_QUICK_UTILITY_EMBEDDED_BODY_CLASS } from '../shared/constants/pcShellLayout.js';
import { DEFAULT_LOCALE } from '../shared/i18n/constants.js';
import LanguageSelect from './i18n/LanguageSelect.js';

interface SettingsModalProps {
    onClose: () => void;
    isTopmost?: boolean;
    embedded?: boolean;
}

type SettingsTab = 'graphics' | 'sound' | 'features' | 'account';

const SettingsSection: React.FC<{ title: string; children: React.ReactNode; className?: string }> = ({
    title,
    children,
    className = '',
}) => (
    <section
        className={`relative overflow-hidden rounded-xl border border-amber-500/20 bg-gradient-to-b from-zinc-900/92 via-zinc-950/96 to-black/90 p-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_18px_48px_-28px_rgba(0,0,0,0.75)] ring-1 ring-white/[0.05] sm:p-3.5 ${className}`}
    >
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-amber-400/35 to-transparent" aria-hidden />
        <div className="relative mb-2 flex items-center gap-2 sm:mb-2.5 sm:gap-2.5">
            <div
                className="h-7 w-1 shrink-0 rounded-full bg-gradient-to-b from-amber-300 via-amber-500 to-amber-700 shadow-[0_0_16px_rgba(251,191,36,0.45)] sm:h-8"
                aria-hidden
            />
            <h3 className="text-[13px] font-bold tracking-tight text-amber-50/95 sm:text-sm">{title}</h3>
        </div>
        <div className="relative">{children}</div>
    </section>
);

/** 계정 탭: 아이디·비밀번호 전환 버튼 */
const accountToggleBtnClass = (active: boolean) =>
    `relative flex min-h-[2.6rem] flex-1 items-center justify-center gap-2 overflow-hidden rounded-xl border px-2.5 py-2 text-center text-xs font-semibold tracking-tight transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/45 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0e1016] sm:min-h-[3rem] sm:px-3 sm:py-2.5 sm:text-sm ${
        active
            ? 'border-amber-400/50 bg-gradient-to-b from-amber-600/30 via-amber-950/55 to-black/85 text-amber-50 shadow-[inset_0_1px_0_rgba(255,255,255,0.14),0_0_32px_-10px_rgba(251,191,36,0.4)] ring-1 ring-amber-400/30'
            : 'border-white/[0.1] bg-gradient-to-b from-zinc-800/55 to-zinc-950/75 text-slate-400 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] hover:border-amber-500/35 hover:text-amber-100/95 hover:shadow-[0_0_24px_-12px_rgba(251,191,36,0.22)]'
    }`;

const accountSubmitBtnClass =
    'relative inline-flex w-full items-center justify-center overflow-hidden rounded-xl border border-amber-400/40 bg-gradient-to-b from-amber-500/95 via-amber-600/92 to-amber-900/95 px-4 py-2.5 text-xs font-bold tracking-wide text-stone-950 shadow-[inset_0_1px_0_rgba(255,255,255,0.38),0_10px_32px_-8px_rgba(245,158,11,0.42)] transition duration-200 hover:brightness-110 hover:shadow-[0_14px_36px_-6px_rgba(251,191,36,0.45)] focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-300/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0e1016] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-55 disabled:hover:brightness-100 sm:py-3 sm:text-sm';

/** 비상·탈퇴: 붉은 계열 프리미엄 CTA */
const dangerCtaBtnClass =
    'group relative inline-flex w-full items-center justify-center overflow-hidden rounded-xl border border-red-400/45 bg-gradient-to-b from-red-600/96 via-rose-800/96 to-rose-950/98 px-4 py-3 text-xs font-bold tracking-[0.06em] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.2),0_0_0_1px_rgba(0,0,0,0.25),0_14px_40px_-10px_rgba(220,38,38,0.55)] transition duration-200 hover:border-red-300/55 hover:shadow-[0_0_44px_-8px_rgba(248,113,113,0.5)] focus:outline-none focus-visible:ring-2 focus-visible:ring-red-400/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0e1016] active:scale-[0.99] active:brightness-95 disabled:cursor-not-allowed disabled:opacity-55 sm:py-3.5 sm:text-sm';

const dangerOutlineBtnClass = (active: boolean) =>
    `relative inline-flex w-full items-center justify-center overflow-hidden rounded-xl border px-4 py-3 text-xs font-semibold tracking-wide transition duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-400/45 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0e1016] active:scale-[0.995] sm:py-3.5 sm:text-sm ${
        active
            ? 'border-red-400/50 bg-gradient-to-b from-red-950/70 to-black/80 text-red-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_0_28px_-12px_rgba(239,68,68,0.35)] ring-1 ring-red-500/25'
            : 'border-red-500/35 bg-gradient-to-b from-red-950/40 to-black/50 text-red-100/90 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] hover:border-red-400/45 hover:shadow-[0_0_28px_-10px_rgba(239,68,68,0.3)]'
    }`;

const SettingsModal: React.FC<SettingsModalProps> = ({ onClose, isTopmost, embedded = false }) => {
    const { t } = useTranslation('settings');
    const {
        settings,
        updateSoundSetting,
        updateFeatureSetting,
        updatePanelEdgeStyle,
        updateLocale,
        handlers,
    } = useAppContext();
    const [activeTab, setActiveTab] = useState<SettingsTab>('features');
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
        try {
            const result = await handlers.handleAction({ type: 'EMERGENCY_EXIT' }) as any;
            const raw = result?.clientResponse?.redirectTo || '#/';
            const redirectTo = raw.startsWith('#') ? raw : `#${raw}`;
            markSkipGameHashLeaveInterceptOnce();
            navigateFromGameIfApplicable(redirectTo);
        } catch (error) {
            console.error('Emergency exit failed:', error);
            markSkipGameHashLeaveInterceptOnce();
            navigateFromGameIfApplicable('#/');
        }
    };

    const handleChangeUsername = async () => {
        if (!newUsername || !currentPassword) {
            setError(t('account.errors.usernameRequired'));
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
                alert(t('account.alerts.usernameChanged'));
                setShowChangeUsername(false);
                setNewUsername('');
                setCurrentPassword('');
            }
        } catch (err: any) {
            setError(err.message || t('account.errors.usernameChangeFailed'));
        } finally {
            setIsLoading(false);
        }
    };

    const handleChangePassword = async () => {
        if (!currentPassword || !newPassword) {
            setError(t('account.errors.passwordRequired'));
            return;
        }
        
        if (newPassword.length < 6) {
            setError(t('account.errors.passwordTooShort'));
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
                alert(t('account.alerts.passwordChanged'));
                setShowChangePassword(false);
                setCurrentPassword('');
                setNewPassword('');
            }
        } catch (err: any) {
            setError(err.message || t('account.errors.passwordChangeFailed'));
        } finally {
            setIsLoading(false);
        }
    };

    const handleWithdraw = async () => {
        if (!withdrawPassword || !withdrawConfirm) {
            setError(t('account.errors.withdrawRequired'));
            return;
        }
        
        if (withdrawConfirm !== '회원탈퇴') {
            setError(t('account.errors.withdrawConfirmMismatch'));
            return;
        }
        
        if (!window.confirm(t('account.alerts.withdrawConfirm'))) {
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
                alert(t('account.alerts.withdrawComplete'));
                const redirectTo = result?.clientResponse?.redirectTo || '#/login';
                window.location.hash = redirectTo;
            }
        } catch (err: any) {
            setError(err.message || t('account.errors.withdrawFailed'));
        } finally {
            setIsLoading(false);
        }
    };
    
    const tabs: { id: SettingsTab; labelKey: string }[] = [
        { id: 'features', labelKey: 'tabs.features' },
        { id: 'graphics', labelKey: 'tabs.display' },
        { id: 'sound', labelKey: 'tabs.sound' },
        { id: 'account', labelKey: 'tabs.account' },
    ];

    const soundCategories: { key: SoundCategory; labelKey: string }[] = [
        { key: 'stone', labelKey: 'sound.categoriesList.stone' },
        { key: 'notification', labelKey: 'sound.categoriesList.notification' },
        { key: 'item', labelKey: 'sound.categoriesList.item' },
        { key: 'countdown', labelKey: 'sound.categoriesList.countdown' },
        { key: 'turn', labelKey: 'sound.categoriesList.turn' },
    ];

    const PANEL_EDGE_OPTIONS: PanelEdgeStyle[] = ['none', 'default', 'style1', 'style2', 'style3', 'style4', 'style5'];

    const activeLocale = settings.graphics.locale ?? DEFAULT_LOCALE;

    const renderEdgePreview = (style: PanelEdgeStyle) => {
        const edges = getPanelEdgeImages(style);
        const backgroundImage = [edges.topLeft, edges.topRight, edges.bottomLeft, edges.bottomRight]
            .map(img => img ?? 'none')
            .join(', ');
        return (
            <div
                className="h-12 w-[4.5rem] rounded-lg border border-white/10 bg-panel shadow-inner ring-1 ring-white/[0.04] sm:h-[3.25rem] sm:w-20"
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
                    <div className="flex flex-col gap-2.5 sm:gap-3">
                        <SettingsSection title={t('display.language')}>
                            <LanguageSelect value={activeLocale} onChange={(locale) => updateLocale(locale)} />
                        </SettingsSection>
                        <SettingsSection title={t('display.panelStyle')}>
                            <div className="space-y-2 sm:space-y-2.5">
                                <div className="flex items-center justify-center rounded-xl border border-amber-500/15 bg-black/35 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] ring-1 ring-white/[0.04] sm:p-5">
                                    {renderEdgePreview(settings.graphics.panelEdgeStyle ?? 'default')}
                                </div>
                                <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3 sm:gap-2">
                                    {PANEL_EDGE_OPTIONS.map(optionId => (
                                        <label
                                            key={optionId}
                                            className="flex min-w-0 cursor-pointer items-center gap-1.5 rounded-lg border border-white/[0.08] bg-black/25 px-2 py-1.5 transition-all duration-150 has-[:checked]:border-amber-400/55 has-[:checked]:bg-amber-950/40 has-[:checked]:shadow-[0_0_20px_-8px_rgba(251,191,36,0.35)] has-[:checked]:ring-1 has-[:checked]:ring-amber-400/20 sm:px-2.5 sm:py-2"
                                        >
                                            <input
                                                type="radio"
                                                name="panelEdgeStyle"
                                                value={optionId}
                                                checked={(settings.graphics.panelEdgeStyle ?? 'default') === optionId}
                                                onChange={() => updatePanelEdgeStyle(optionId)}
                                                className="h-4 w-4 shrink-0 border-color bg-secondary text-accent focus:ring-accent"
                                            />
                                            <span className="min-w-0 flex-1 break-words text-[11px] leading-tight font-medium text-amber-50/95 sm:text-sm">
                                                {t(`display.panelEdge.${optionId}`)}
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
                    <div className="flex flex-col gap-2.5 sm:gap-3">
                        <SettingsSection title={t('sound.output')}>
                            <div className="space-y-3 sm:space-y-3.5">
                                <div>
                                    <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-amber-200/80 sm:mb-1.5 sm:text-[11px]">
                                        {t('sound.masterVolume')}
                                    </p>
                                    <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-black/30 px-2.5 py-2 shadow-inner ring-1 ring-white/[0.04] sm:gap-4 sm:px-3 sm:py-2.5">
                                        <span className="w-10 text-center font-mono text-base tabular-nums text-amber-100 sm:w-11 sm:text-lg">
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
                                <div className="flex items-center justify-between gap-2 rounded-xl border border-color/40 bg-secondary/20 px-3 py-2 sm:gap-3 sm:px-3.5 sm:py-2.5">
                                    <span className="text-[11px] font-medium text-text-primary sm:text-sm">{t('sound.masterEffects')}</span>
                                    <ToggleSwitch
                                        checked={!settings.sound.masterMuted}
                                        onChange={(checked) => updateSoundSetting('masterMuted', !checked)}
                                    />
                                </div>
                            </div>
                        </SettingsSection>
                        <SettingsSection title={t('sound.categories')}>
                            <div className="flex flex-col gap-0">
                                {soundCategories.map(({ key, labelKey }) => (
                                    <div
                                        key={key}
                                        className="flex items-center justify-between gap-2 rounded-lg border border-transparent px-1.5 py-1.5 transition-colors hover:border-amber-500/15 hover:bg-white/[0.04] sm:px-2 sm:py-2"
                                    >
                                        <span className="text-[11px] text-slate-300 sm:text-sm">{t(labelKey)}</span>
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
                    <div className="flex flex-col gap-2.5 sm:gap-3">
                        <SettingsSection title={t('features.gameplay')}>
                            <div className="flex flex-col gap-0">
                                <div className="flex items-center justify-between gap-2 rounded-lg border border-transparent px-1.5 py-1.5 hover:border-amber-500/15 hover:bg-white/[0.04] sm:px-2 sm:py-2">
                                    <span className="text-[11px] text-slate-300 sm:text-sm">{t('features.moveConfirmButton')}</span>
                                    <ToggleSwitch
                                        checked={settings.features.moveConfirmButtonBox}
                                        onChange={(checked) => updateFeatureSetting('moveConfirmButtonBox', checked)}
                                    />
                                </div>
                                <div className="flex items-center justify-between gap-2 rounded-lg border border-transparent px-1.5 py-1.5 hover:border-amber-500/15 hover:bg-white/[0.04] sm:px-2 sm:py-2">
                                    <span className="text-[11px] text-slate-300 sm:text-sm">{t('features.stonePreview')}</span>
                                    <ToggleSwitch
                                        checked={settings.features.stonePreview}
                                        onChange={(checked) => updateFeatureSetting('stonePreview', checked)}
                                    />
                                </div>
                                <div className="flex items-center justify-between gap-2 rounded-lg border border-transparent px-1.5 py-1.5 hover:border-amber-500/15 hover:bg-white/[0.04] sm:px-2 sm:py-2">
                                    <span className="text-[11px] text-slate-300 sm:text-sm">{t('features.lastMoveMarker')}</span>
                                    <ToggleSwitch
                                        checked={settings.features.lastMoveMarker}
                                        onChange={(checked) => updateFeatureSetting('lastMoveMarker', checked)}
                                    />
                                </div>
                                <div className="flex items-center justify-between gap-2 rounded-lg border border-transparent px-1.5 py-1.5 hover:border-amber-500/15 hover:bg-white/[0.04] sm:px-2 sm:py-2">
                                    <span className="text-[11px] text-slate-300 sm:text-sm">{t('features.captureScoreAnimation')}</span>
                                    <ToggleSwitch
                                        checked={settings.features.captureScoreAnimation}
                                        onChange={(checked) => updateFeatureSetting('captureScoreAnimation', checked)}
                                    />
                                </div>
                                <div className="flex items-center justify-between gap-2 rounded-lg border border-transparent px-1.5 py-1.5 hover:border-amber-500/15 hover:bg-white/[0.04] sm:px-2 sm:py-2">
                                    <div className="min-w-0 flex-1">
                                        <span className="block text-[11px] text-slate-300 sm:text-sm">{t('features.screenGuideModals')}</span>
                                        <span className="mt-0.5 block text-[10px] leading-snug text-slate-500">
                                            {t('features.screenGuideModalsHint')}
                                        </span>
                                    </div>
                                    <ToggleSwitch
                                        checked={settings.features.screenGuideModals !== false}
                                        onChange={(checked) => updateFeatureSetting('screenGuideModals', checked)}
                                    />
                                </div>
                            </div>
                        </SettingsSection>
                        <SettingsSection title={t('features.notifications')}>
                            <div className="flex flex-col gap-0">
                                <div className="flex items-center justify-between gap-2 rounded-lg border border-transparent px-1.5 py-1.5 hover:border-amber-500/15 hover:bg-white/[0.04] sm:px-2 sm:py-2">
                                    <span className="text-[11px] text-slate-300 sm:text-sm">{t('features.questNotifications')}</span>
                                    <ToggleSwitch
                                        checked={settings.features.questNotifications}
                                        onChange={(checked) => updateFeatureSetting('questNotifications', checked)}
                                    />
                                </div>
                                <div className="flex items-center justify-between gap-2 rounded-lg border border-transparent px-1.5 py-1.5 hover:border-amber-500/15 hover:bg-white/[0.04] sm:px-2 sm:py-2">
                                    <span className="text-[11px] text-slate-300 sm:text-sm">{t('features.chatNotifications')}</span>
                                    <ToggleSwitch
                                        checked={settings.features.chatNotifications}
                                        onChange={(checked) => updateFeatureSetting('chatNotifications', checked)}
                                    />
                                </div>
                            </div>
                        </SettingsSection>
                        <SettingsSection title={t('features.emergency')}>
                            <div className="relative overflow-hidden rounded-2xl border border-red-500/30 bg-gradient-to-br from-[#1c080c] via-[#12060a] to-[#0a0406] p-[1px] shadow-[0_0_52px_-18px_rgba(220,38,38,0.45)]">
                                <div
                                    className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-red-400/50 to-transparent"
                                    aria-hidden
                                />
                                <div className="relative rounded-[0.95rem] bg-gradient-to-b from-red-950/35 via-black/40 to-black/55 p-3 ring-1 ring-inset ring-red-500/15 sm:p-3.5">
                                    <div className="mb-2 space-y-0.5 text-[10px] leading-snug text-red-100/88 sm:mb-2.5 sm:text-xs">
                                        <p className="whitespace-nowrap">{t('features.emergencyLine1')}</p>
                                        <p className="whitespace-nowrap">{t('features.emergencyLine2')}</p>
                                    </div>
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
                                            {t('features.emergencyExit')}
                                        </span>
                                    </button>
                                </div>
                            </div>
                        </SettingsSection>
                    </div>
                );
            case 'account':
                return (
                    <div className="flex flex-col gap-2.5 sm:gap-3">
                        <SettingsSection title={t('account.management')}>
                            <div className="mb-2 flex flex-col gap-2 sm:mb-3 sm:flex-row sm:gap-2">
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
                                    {showChangeUsername ? t('account.cancelChangeUsername') : t('account.changeUsername')}
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
                                    {showChangePassword ? t('account.cancelChangePassword') : t('account.changePassword')}
                                </button>
                            </div>
                            {showChangeUsername && (
                                <div className="mb-2 rounded-xl border border-amber-500/20 bg-black/35 p-3 ring-1 ring-inset ring-white/[0.05] sm:mb-3 sm:p-3.5">
                                    <div className="space-y-2 sm:space-y-2.5">
                                        <div>
                                            <label className="mb-1 block text-[11px] text-slate-400 sm:text-sm">{t('account.newUsername')}</label>
                                            <input
                                                type="text"
                                                value={newUsername}
                                                onChange={(e) => setNewUsername(e.target.value)}
                                                className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2.5 text-amber-50 outline-none focus:ring-2 focus:ring-amber-400/35"
                                                placeholder={t('account.usernamePlaceholder')}
                                                disabled={isLoading}
                                            />
                                        </div>
                                        <div>
                                            <label className="mb-1 block text-[11px] text-slate-400 sm:text-sm">{t('account.currentPassword')}</label>
                                            <input
                                                type="password"
                                                value={currentPassword}
                                                onChange={(e) => setCurrentPassword(e.target.value)}
                                                className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2.5 text-amber-50 outline-none focus:ring-2 focus:ring-amber-400/35"
                                                disabled={isLoading}
                                            />
                                        </div>
                                        {error && <p className="text-xs text-red-400 sm:text-sm">{error}</p>}
                                        <button
                                            type="button"
                                            className={accountSubmitBtnClass}
                                            onClick={handleChangeUsername}
                                            disabled={isLoading}
                                        >
                                            {isLoading ? t('account.processing') : t('account.submitChange')}
                                        </button>
                                    </div>
                                </div>
                            )}
                            {showChangePassword && (
                                <div className="mb-2 rounded-xl border border-amber-500/20 bg-black/35 p-3 ring-1 ring-inset ring-white/[0.05] sm:mb-3 sm:p-3.5">
                                    <div className="space-y-2 sm:space-y-2.5">
                                        <div>
                                            <label className="mb-1 block text-[11px] text-slate-400 sm:text-sm">{t('account.currentPassword')}</label>
                                            <input
                                                type="password"
                                                value={currentPassword}
                                                onChange={(e) => setCurrentPassword(e.target.value)}
                                                className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2.5 text-amber-50 outline-none focus:ring-2 focus:ring-amber-400/35"
                                                disabled={isLoading}
                                            />
                                        </div>
                                        <div>
                                            <label className="mb-1 block text-[11px] text-slate-400 sm:text-sm">{t('account.newPassword')}</label>
                                            <input
                                                type="password"
                                                value={newPassword}
                                                onChange={(e) => setNewPassword(e.target.value)}
                                                className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2.5 text-amber-50 outline-none focus:ring-2 focus:ring-amber-400/35"
                                                placeholder={t('account.passwordMinPlaceholder')}
                                                disabled={isLoading}
                                            />
                                        </div>
                                        {error && <p className="text-xs text-red-400 sm:text-sm">{error}</p>}
                                        <button
                                            type="button"
                                            className={accountSubmitBtnClass}
                                            onClick={handleChangePassword}
                                            disabled={isLoading}
                                        >
                                            {isLoading ? t('account.processing') : t('account.submitChange')}
                                        </button>
                                    </div>
                                </div>
                            )}
                        </SettingsSection>
                        <SettingsSection title={t('account.withdrawTitle')}>
                            <div className="relative overflow-hidden rounded-2xl border border-red-500/28 bg-gradient-to-br from-[#1a0608] via-[#100407] to-[#0a0305] p-[1px] shadow-[0_0_48px_-20px_rgba(185,28,28,0.4)]">
                                <div
                                    className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-red-400/40 to-transparent"
                                    aria-hidden
                                />
                                <div className="relative rounded-[0.95rem] bg-gradient-to-b from-red-950/40 via-black/45 to-black/60 p-3 ring-1 ring-inset ring-red-500/12 sm:p-3.5">
                                    <div className="mb-2 space-y-0.5 text-[10px] leading-snug text-red-100/88 sm:mb-2.5 sm:text-xs">
                                        <p className="whitespace-nowrap">{t('account.withdrawLine1')}</p>
                                        <p className="whitespace-nowrap">{t('account.withdrawLine2')}</p>
                                    </div>
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
                                        {showWithdraw ? t('account.cancel') : t('account.withdraw')}
                                    </button>
                                    {showWithdraw && (
                                        <div className="mt-3 space-y-2 border-t border-red-500/20 pt-3 sm:mt-3.5 sm:space-y-2.5 sm:pt-3.5">
                                            <div>
                                                <label className="mb-1 block text-[11px] font-medium text-red-100/85 sm:text-sm">{t('account.withdrawPasswordConfirm')}</label>
                                                <input
                                                    type="password"
                                                    value={withdrawPassword}
                                                    onChange={(e) => setWithdrawPassword(e.target.value)}
                                                    className="w-full rounded-xl border border-red-500/35 bg-black/45 px-3 py-2.5 text-red-50/95 outline-none ring-1 ring-inset ring-white/[0.04] placeholder:text-red-200/30 focus:border-red-400/50 focus:ring-2 focus:ring-red-500/30"
                                                    disabled={isLoading}
                                                />
                                            </div>
                                            <div>
                                                <label className="mb-1 block text-[11px] font-medium text-red-100/85 sm:text-sm">
                                                    {t('account.withdrawTextConfirm')}
                                                </label>
                                                <input
                                                    type="text"
                                                    value={withdrawConfirm}
                                                    onChange={(e) => setWithdrawConfirm(e.target.value)}
                                                    className="w-full rounded-xl border border-red-500/35 bg-black/45 px-3 py-2.5 text-red-50/95 outline-none ring-1 ring-inset ring-white/[0.04] placeholder:text-red-200/35 focus:border-red-400/50 focus:ring-2 focus:ring-red-500/30"
                                                    placeholder={t('account.withdrawPlaceholder')}
                                                    disabled={isLoading}
                                                />
                                            </div>
                                            {error && <p className="text-xs text-red-400 sm:text-sm">{error}</p>}
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
                                                <span className="relative">{isLoading ? t('account.processing') : t('account.withdrawSubmit')}</span>
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
    
    const settingsBody = (
        <div className="flex h-full min-h-0 flex-1 flex-col rounded-2xl border border-amber-900/25 bg-gradient-to-b from-[#12141c] via-[#0e1016] to-[#08090e] p-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] sm:p-2.5">
            <div className="mb-2 flex shrink-0 gap-0.5 rounded-xl border border-white/[0.08] bg-black/40 p-0.5 shadow-inner backdrop-blur-md sm:mb-2 sm:gap-1 sm:p-1">
                {tabs.map(tab => (
                    <button
                        key={tab.id}
                        type="button"
                        onClick={() => setActiveTab(tab.id)}
                        className={`relative flex-1 overflow-hidden rounded-lg py-1.5 text-[11px] font-semibold transition-all duration-200 sm:py-2 sm:text-xs ${
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
                        <span className="relative z-[1]">{t(tab.labelKey)}</span>
                    </button>
                ))}
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-0.5 py-0.5 pr-1.5 sm:px-1">
                {renderContent()}
            </div>
        </div>
    );

    if (embedded) {
        return <div className={PC_QUICK_UTILITY_EMBEDDED_BODY_CLASS}>{settingsBody}</div>;
    }

    return (
        <DraggableWindow title={t('title')} onClose={onClose} windowId="settings" initialWidth={600} initialHeight={860} isTopmost={isTopmost}>
            {settingsBody}
        </DraggableWindow>
    );
};

export default SettingsModal;