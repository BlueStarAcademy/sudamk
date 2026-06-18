export type Theme = 'black' | 'white' | 'blue' | 'sky' | 'green';
export type SoundCategory = 'stone' | 'notification' | 'item' | 'countdown' | 'turn';
export type { AppLocale } from '../i18n/languages.js';
import type { AppLocale } from '../i18n/languages.js';

export type PanelEdgeStyle = 'none' | 'default' | 'style1' | 'style2' | 'style3' | 'style4' | 'style5';

export interface GraphicsSettings {
    theme: Theme;
    panelColor?: string;
    textColor?: string;
    panelEdgeStyle?: PanelEdgeStyle;
    /** UI 표시 언어 */
    locale?: AppLocale;
    /** 좁은 화면에서 16:9 스케일(PC 동일) 레이아웃. false면 네이티브 풀뷰포트+슬라이드 UI */
    pcLikeMobileLayout?: boolean;
}

export interface SoundSettings {
    masterVolume: number;
    masterMuted: boolean;
    categoryMuted: Record<SoundCategory, boolean>;
}

export interface FeatureSettings {
    moveConfirmButtonBox: boolean;
    mobileConfirm: boolean;
    stonePreview: boolean;
    lastMoveMarker: boolean;
    captureScoreAnimation: boolean;
    questNotifications: boolean;
    chatNotifications: boolean;
    /** 화면별 첫 진입 안내(도움말 모달) 자동 표시 */
    screenGuideModals: boolean;
}

export interface AppSettings {
    graphics: GraphicsSettings;
    sound: SoundSettings;
    features: FeatureSettings;
}