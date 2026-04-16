/// <reference lib="dom" />

import type { SoundSettings } from '../types.js';
import { defaultSettings } from '../hooks/useAppSettings.js';
import { API_BASE_URL, getApiUrl } from '../utils/apiConfig.js';

/** HTML5 autoplay 잠금 해제·풀 워밍업용 초단무음 WAV (data URI) */
const SILENT_WAV_DATA_URI =
    'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=';

/** `public/sound`에 있는 파일명과 일치 (첫 사용자 제스처 직후 백그라운드 프리로드) */
const SOUND_BASE_NAMES = [
    'move', 'dice', 'failure', 'hidden', 'scanbgm', 'find', 'hit', 'rocket', 'lose', 'win',
    'levelup', 'jackpot2', 'jackpot', 'gamestart', 'myturn', 'scanfail', 'timer10', 'bip',
    'success', 'fall', 'reward',
] as const;

class AudioService {
    private audioContext: AudioContext | null = null;
    /** 동시 initialize() 호출을 하나로 묶어, 진행 중인 초기화가 끝날 때까지 대기 */
    private initMutex: Promise<void> | null = null;
    private visibilityResumeHooked = false;
    private scanBgmSourceNode: AudioBufferSourceNode | null = null;
    private timerWarningSourceNode: AudioBufferSourceNode | null = null;
    /** WebAudio 대신 HTML5로 재생 중일 때 정지용(scanbgm 루프 등) */
    private scanBgmHtml5: HTMLAudioElement | null = null;
    private timerWarningHtml5: HTMLAudioElement | null = null;
    private audioBuffers = new Map<string, AudioBuffer>();
    /** 동일 URL 동시 디코드 방지 */
    private bufferLoads = new Map<string, Promise<AudioBuffer | null>>();
    private preloadStarted = false;
    /** Express/Vite 정적 경로와 일치: `server.ts`의 `app.use('/sounds', ... public/sounds)` */
    private soundsPath = '/sounds/';
    private settings: SoundSettings = defaultSettings.sound;
    private html5AudioUnlocked = false;
    /** Android WebView·앱플레이어: 매번 `new Audio()`는 재생 거절되는 경우가 많아, 제스처 직후 워밍업한 풀에서 꺼내 씀 */
    private html5SfxPool: HTMLAudioElement[] = [];
    private html5PoolWarmed = false;
    /** iOS Safari: 문서에 연결되지 않은 Audio는 재생이 거절되는 경우가 많음 */
    private html5SinkParent: HTMLElement | null = null;
    /** soundName별 성공 URL 캐시 */
    private resolvedSoundUrlByName = new Map<string, string>();

    public isReady(): boolean {
        return !!this.audioContext && this.audioContext.state === 'running';
    }

    private needsResume(ctx: AudioContext): boolean {
        const s = ctx.state as string;
        return s === 'suspended' || s === 'interrupted';
    }

    private async resumeContextIfNeeded(ctx: AudioContext): Promise<void> {
        if (ctx.state === 'closed') return;
        if (!this.needsResume(ctx)) return;
        try {
            await ctx.resume();
        } catch (e) {
            console.warn('[AudioService] resume():', e);
        }
    }

    private hookVisibilityResume(): void {
        if (this.visibilityResumeHooked || typeof document === 'undefined') return;
        this.visibilityResumeHooked = true;
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState !== 'visible') return;
            const ctx = this.audioContext;
            if (!ctx || ctx.state === 'closed') return;
            void ctx.resume().then(() => this.playSilentBufferWakeup(ctx)).catch(() => {});
        });
    }

    /** `resume()` 직후에만 효과가 있는 경우가 많음 (앱플레이어·Android Chromium) */
    private playSilentBufferWakeup(ctx: AudioContext): void {
        if (ctx.state === 'closed') return;
        try {
            const buf = ctx.createBuffer(1, 1, ctx.sampleRate);
            const src = ctx.createBufferSource();
            src.buffer = buf;
            src.connect(ctx.destination);
            src.start(0);
        } catch {
            /* suspended 등 */
        }
    }

    /**
     * 제스처 스택 안에서만 호출. Android WebView는 `new Audio()`마다 잠금이 걸리는 경우가 있어
     * 미리 여러 요소에 무음 재생을 걸어 둔다.
     */
    private warmHtml5PoolInGesture(): void {
        if (this.html5PoolWarmed || typeof window === 'undefined') return;
        this.html5PoolWarmed = true;
        const poolSize = 4;
        for (let i = 0; i < poolSize; i++) {
            const el = new Audio();
            el.preload = 'auto';
            el.setAttribute('playsinline', 'true');
            el.setAttribute('webkit-playsinline', 'true');
            this.ensureAudioElementInDom(el);
            el.muted = true;
            el.volume = 0;
            el.src = SILENT_WAV_DATA_URI;
            void el.play().then(() => {
                try {
                    el.pause();
                    el.currentTime = 0;
                } catch {
                    /* ignore */
                }
            }).catch(() => {});
            el.muted = false;
            el.volume = 1;
            this.html5SfxPool.push(el);
        }
    }

    private pickPooledHtml5Audio(): HTMLAudioElement | null {
        for (const el of this.html5SfxPool) {
            if (el.paused || el.ended) return el;
        }
        return this.html5SfxPool[0] ?? null;
    }

    private ensureAudioElementInDom(el: HTMLAudioElement): void {
        if (typeof document === 'undefined' || el.isConnected) return;
        if (!document.body) {
            queueMicrotask(() => this.ensureAudioElementInDom(el));
            return;
        }
        if (!this.html5SinkParent) {
            const p = document.createElement('div');
            p.id = 'audio-sink-hidden';
            p.setAttribute('aria-hidden', 'true');
            p.style.cssText =
                'position:fixed;left:0;top:0;width:0;height:0;overflow:hidden;clip:rect(0,0,0,0);pointer-events:none;opacity:0;';
            document.body.appendChild(p);
            this.html5SinkParent = p;
        }
        this.html5SinkParent.appendChild(el);
    }

    /**
     * iOS Safari·모바일 WebView: `AudioContext.resume()`은 사용자 제스처의 **동기** 호출 스택에서
     * 시작되어야 합니다. 다만 Android·앱플레이어는 `resume()` 완료 후에야 `running`으로 바뀌는 경우가
     * 많아, `resume().then`에서 무음 버퍼로 한 번 더 깨웁니다.
     * 버튼/보드 입력 등 UI 핸들러 맨 앞에서도 호출하세요.
     * @param opts.warmHtml5Pool `pageshow` 등 비제스처 경로에서는 false (잠긴 풀이 고정되는 것 방지).
     */
    public unlockFromUserGesture(opts?: { warmHtml5Pool?: boolean }): void {
        if (typeof window === 'undefined') return;
        const warmHtml5Pool = opts?.warmHtml5Pool !== false;
        this.hookVisibilityResume();
        try {
            const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
            if (!AC) return;
            if (!this.audioContext) {
                this.audioContext = new AC();
            }
            const ctx = this.audioContext;
            if (ctx.state === 'closed') return;
            void ctx.resume().then(() => this.playSilentBufferWakeup(ctx)).catch(() => {});
            this.playSilentBufferWakeup(ctx);
            // Android WebView/Samsung Internet 대응:
            // WebAudio 잠금과 별개로 HTML5 Audio autoplay gate를 사용자 제스처에서 함께 해제한다.
            this.tryUnlockHtml5Audio();
            this.kickPreloadAfterUnlock();
            if (warmHtml5Pool) this.warmHtml5PoolInGesture();
        } catch (e) {
            console.warn('[AudioService] unlockFromUserGesture:', e);
        }
    }

    /** 제스처 직후 네트워크·디코드를 시작해, 이후 play()가 await 체인 밖에서 너무 늦지 않게 함 */
    private kickPreloadAfterUnlock(): void {
        if (this.preloadStarted) return;
        this.preloadStarted = true;
        for (const name of SOUND_BASE_NAMES) {
            void this.loadSoundByName(name).catch(() => {});
        }
    }

    private tryUnlockHtml5Audio(): void {
        if (this.html5AudioUnlocked || typeof window === 'undefined') return;
        try {
            const probe = new Audio();
            probe.preload = 'auto';
            probe.muted = true;
            probe.volume = 0;
            probe.setAttribute('playsinline', 'true');
            probe.setAttribute('webkit-playsinline', 'true');
            this.ensureAudioElementInDom(probe);
            // 매우 짧은 무음 wav (data URI)로 autoplay gate 해제 시도
            probe.src = SILENT_WAV_DATA_URI;
            void probe.play().then(() => {
                probe.pause();
                try { probe.currentTime = 0; } catch {}
                this.html5AudioUnlocked = true;
            }).catch(() => {
                // 사용자 제스처 타이밍이 아닐 수 있으므로 무시
            });
        } catch {
            // ignore
        }
    }

    public async initialize(): Promise<void> {
        if (this.isReady()) return;
        if (this.initMutex) {
            await this.initMutex;
            return;
        }
        this.initMutex = (async () => {
            try {
                this.hookVisibilityResume();
                if (!this.audioContext) {
                    this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
                }
                // await resume()는 대부분 제스처 스택 밖에서 호출되므로 iOS에서 무의미·지연만 유발.
                // unlockFromUserGesture()에서 이미 void resume() + 무음 버퍼로 잠금 해제함.
                void this.resumeContextIfNeeded(this.audioContext);
            } catch (error) {
                console.error('Audio context initialization failed:', error);
            }
        })();
        try {
            await this.initMutex;
        } finally {
            this.initMutex = null;
        }
    }

    public updateSettings(newSettings: SoundSettings) {
        this.settings = {
            ...defaultSettings.sound,
            ...newSettings,
            categoryMuted: {
                ...defaultSettings.sound.categoryMuted,
                ...(newSettings.categoryMuted ?? {}),
            },
        };
    }

    /**
     * 통합 배포·PWA·Capacitor: `/sounds/*.mp3` 가 페이지와 같은 출처에 있으면 절대 URL로 고정해 fetch·Audio 가 동일 키를 쓴다.
     * API 전용 호스트에만 사운드가 있으면 getApiUrl 유지.
     */
    private getSameOriginSoundUrl(soundName: string): string {
        const path = `${this.soundsPath}${soundName}.mp3`.replace(/\/{2,}/g, '/');
        if (typeof window === 'undefined') return path;
        return new URL(path, window.location.origin).href;
    }

    private getSoundUrl(soundName: string): string {
        const path = `${this.soundsPath}${soundName}.mp3`.replace(/\/{2,}/g, '/');
        const viaApi = getApiUrl(path);
        if (typeof window === 'undefined') return viaApi;
        const sameOrigin = new URL(path, window.location.origin).href;
        const resolved = this.resolvedSoundUrlByName.get(soundName);
        if (resolved) return resolved;

        // 기본은 same-origin 사용. API 호스트를 강제하려면 VITE_SOUNDS_FROM_API=true.
        const forceApiSounds = import.meta.env.VITE_SOUNDS_FROM_API === 'true';
        if (!forceApiSounds || !API_BASE_URL) return sameOrigin;
        try {
            if (new URL(viaApi).origin === window.location.origin) {
                return sameOrigin;
            }
        } catch {
            /* ignore */
        }
        return viaApi;
    }

    private async loadSoundByName(soundName: string): Promise<AudioBuffer | null> {
        const primaryUrl = this.getSoundUrl(soundName);
        const primary = await this.loadSound(primaryUrl);
        if (primary) {
            this.resolvedSoundUrlByName.set(soundName, primaryUrl);
            return primary;
        }

        const fallbackUrl = this.getSameOriginSoundUrl(soundName);
        if (fallbackUrl !== primaryUrl) {
            const fallback = await this.loadSound(fallbackUrl);
            if (fallback) {
                this.resolvedSoundUrlByName.set(soundName, fallbackUrl);
                return fallback;
            }
        }
        return null;
    }

    /** 터치·모바일: WebAudio 는 useEffect 등 비제스처 타이밍에서 재생이 막히는 경우가 많아 HTML5 를 우선한다. */
    private prefersTouchOrHtml5Sfx(): boolean {
        if (typeof navigator === 'undefined') return false;
        if (navigator.maxTouchPoints > 0) return true;
        if (/Android|iPhone|iPad|iPod|Mobile|webOS|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)) {
            return true;
        }
        try {
            return !!window.matchMedia?.('(pointer: coarse)')?.matches;
        } catch {
            return false;
        }
    }

    private async loadSound(url: string): Promise<AudioBuffer | null> {
        await this.initialize();
        if (!this.audioContext) return null;
        if (this.audioBuffers.has(url)) {
            return this.audioBuffers.get(url)!;
        }
        const inflight = this.bufferLoads.get(url);
        if (inflight) return inflight;

        const p = (async (): Promise<AudioBuffer | null> => {
            try {
                const response = await fetch(url);
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                const arrayBuffer = await response.arrayBuffer();
                const ctx = this.audioContext;
                if (!ctx || ctx.state === 'closed') return null;
                // 일부 WebKit에서 전달된 ArrayBuffer가 detach 되는 경우 방지
                const audioBuffer = await ctx.decodeAudioData(arrayBuffer.slice(0));
                this.audioBuffers.set(url, audioBuffer);
                return audioBuffer;
            } catch (error) {
                console.error(`Failed to load sound: ${url}`, error);
                return null;
            } finally {
                this.bufferLoads.delete(url);
            }
        })();
        this.bufferLoads.set(url, p);
        return p;
    }

    /**
     * HTML5 재생. 반환 요소는 scanbgm·timer 전용 정지에 사용.
     * master·카테고리 반영된 최종 볼륨(0~1).
     */
    private startHtml5Playback(
        soundName: string,
        category: keyof SoundSettings['categoryMuted'],
        effectiveVolume: number,
        loop: boolean,
    ): HTMLAudioElement | null {
        if (this.settings.masterMuted || this.settings.categoryMuted[category]) return null;
        try {
            const url = this.getSoundUrl(soundName);
            const pooled = this.pickPooledHtml5Audio();
            const el = pooled ?? new Audio();
            if (pooled) {
                try {
                    el.pause();
                    el.currentTime = 0;
                } catch {
                    /* ignore */
                }
            }
            el.preload = 'auto';
            el.setAttribute('playsinline', 'true');
            el.setAttribute('webkit-playsinline', 'true');
            this.ensureAudioElementInDom(el);
            el.src = url;
            el.volume = Math.max(0, Math.min(1, effectiveVolume));
            el.loop = loop;
            try {
                el.load();
            } catch {
                /* 일부 WebView */
            }
            void el.play().catch((e) => {
                console.warn('[AudioService] HTML5 play failed:', soundName, e);
            });
            return el;
        } catch {
            return null;
        }
    }

    private trackLongRunningHtml5(soundName: string, el: HTMLAudioElement | null, loop: boolean): void {
        if (!el) return;
        if (soundName === 'scanbgm' && loop) {
            this.scanBgmHtml5 = el;
        } else if (soundName === 'timer10' && !loop) {
            this.timerWarningHtml5 = el;
        }
    }

    /** Web Audio가 잠긴 경우(iOS 등)에만 사용 */
    private playHtml5Fallback(soundName: string, category: keyof SoundSettings['categoryMuted'], effectiveVolume: number, loop: boolean): void {
        const el = this.startHtml5Playback(soundName, category, effectiveVolume, loop);
        this.trackLongRunningHtml5(soundName, el, loop);
    }

    /**
     * await 없이 한 틱 안에서 끝냄. 앱플레이어·Android WebView는 제스처 스택이 끊기면 WebAudio/HTML5 재생이 막히는 경우가 많음.
     */
    private playSoundIfRunning(buffer: AudioBuffer, volume: number, loop: boolean): AudioBufferSourceNode | null {
        if (!this.audioContext || this.audioContext.state === 'closed') return null;
        const ctx = this.audioContext;
        if (ctx.state !== 'running') return null;
        try {
            const source = ctx.createBufferSource();
            source.buffer = buffer;
            source.loop = loop;
            const gainNode = ctx.createGain();
            gainNode.gain.setValueAtTime(volume, ctx.currentTime);
            source.connect(gainNode);
            gainNode.connect(ctx.destination);
            source.start(0);
            return source;
        } catch {
            return null;
        }
    }

    private async playSound(buffer: AudioBuffer, volume = 1, loop = false): Promise<AudioBufferSourceNode | null> {
        await this.initialize();
        if (!this.audioContext || this.audioContext.state === 'closed') return null;

        const ctx = this.audioContext;
        void ctx.resume();
        await this.resumeContextIfNeeded(ctx);
        if (this.needsResume(ctx)) {
            await new Promise((r) => setTimeout(r, 0));
            void ctx.resume();
            await this.resumeContextIfNeeded(ctx);
        }
        // 모바일 WebKit: resume 직후 state 갱신이 한 프레임 미뤄지는 경우
        if (ctx.state !== 'running' && this.needsResume(ctx)) {
            await new Promise<void>((resolve) => {
                requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
            });
            void ctx.resume();
            await this.resumeContextIfNeeded(ctx);
        }

        if (ctx.state !== 'running') {
            console.warn('[AudioService] context not running, skip WebAudio playback:', ctx.state);
            return null;
        }

        return this.playSoundIfRunning(buffer, volume, loop);
    }
    
    private async play(soundName: string, category: keyof SoundSettings['categoryMuted'], volume: number, loop = false): Promise<AudioBufferSourceNode | null> {
        if (this.settings.masterMuted || this.settings.categoryMuted[category]) return null;
        // 일부 모바일 브라우저에서 초기 unlock이 누락돼도, 실제 재생 시도 순간에 다시 열어준다.
        // 비제스처 경로이므로 HTML5 풀 워밍업은 하지 않음(잠긴 풀 고정 방지).
        this.unlockFromUserGesture({ warmHtml5Pool: false });
        const effectiveVolume = volume * this.settings.masterVolume;
        const url = this.getSoundUrl(soundName);

        if (this.prefersTouchOrHtml5Sfx()) {
            this.playHtml5Fallback(soundName, category, effectiveVolume, loop);
            void this.loadSoundByName(soundName).catch(() => {});
            return null;
        }

        const cached = this.audioBuffers.get(url);
        if (cached) {
            try {
                // 모바일: resume() 직후에도 한 틱 동안 suspended로 남는 경우가 많아 playSound로 대기 후 재생
                const node = await this.playSound(cached, effectiveVolume, loop);
                if (node) return node;
            } catch (e) {
                console.error(`Could not play sound ${soundName}`, e);
            }
            this.playHtml5Fallback(soundName, category, effectiveVolume, loop);
            return null;
        }

        /**
         * 앱 플레이어·iOS WebView 등: await fetch/decode 후에는 사용자 제스처가 끊겨 WebAudio·HTML5 play가 거절되는 경우가 많다.
         * 버퍼가 아직 없을 때(첫 재생·프리로드 진행 중)는 같은 동기 스택에서 HTML5 play를 먼저 건다. 디코드는 백그라운드만.
         */
        const html5El = this.startHtml5Playback(soundName, category, effectiveVolume, loop);
        this.trackLongRunningHtml5(soundName, html5El, loop);
        void this.loadSoundByName(soundName).catch(() => {});
        return null;
    }

    // Public methods based on user request
    public placeStone() { this.play('move', 'stone', 0.7).catch(() => {}); }
    public rollDice(count: number) { this.play('dice', 'item', 0.6).catch(() => {}); if (count > 1) { setTimeout(() => this.play('dice', 'item', 0.6).catch(() => {}), 500); } }
    public enhancementFail() { this.play('failure', 'notification', 0.7).catch(() => {}); }
    public revealHiddenStone() { this.play('hidden', 'item', 0.8).catch(() => {}); }
    public async playScanBgm() { this.stopScanBgm(); this.scanBgmSourceNode = await this.play('scanbgm', 'item', 0.4, true); }
    public stopScanBgm() {
        if (this.scanBgmSourceNode) {
            try {
                this.scanBgmSourceNode.stop();
            } catch (e) {
                /* ignore */
            }
            this.scanBgmSourceNode = null;
        }
        if (this.scanBgmHtml5) {
            try {
                this.scanBgmHtml5.pause();
                this.scanBgmHtml5.currentTime = 0;
                this.scanBgmHtml5.src = '';
            } catch {
                /* ignore */
            }
            this.scanBgmHtml5 = null;
        }
    }
    public scanSuccess() { this.play('find', 'item', 0.7).catch(() => {}); }
    public stoneCollision() { this.play('hit', 'stone', 0.4).catch(() => {}); }
    public launchMissile() { this.play('rocket', 'item', 0.7).catch(() => {}); }
    public gameLose() { this.play('lose', 'notification', 0.6).catch(() => {}); }
    public gameWin() { this.play('win', 'notification', 0.6).catch(() => {}); }
    public levelUp() { this.play('levelup', 'notification', 0.7).catch(() => {}); }
    public disassemblyJackpot() { this.play('jackpot2', 'notification', 0.8).catch(() => {}); }
    public gachaEpicOrHigher() { this.play('jackpot', 'notification', 0.7).catch(() => {}); }
    public gameStart() { this.play('gamestart', 'notification', 0.6).catch(() => {}); }
    public myTurn() { this.play('myturn', 'turn', 0.7).catch(() => {}); }
    public scanFail() { this.play('scanfail', 'item', 0.6).catch(() => {}); }

    public async timerWarning() {
        this.stopTimerWarning();
        this.timerWarningSourceNode = await this.play('timer10', 'countdown', 0.7);
    }
    
    public stopTimerWarning() {
        if (this.timerWarningSourceNode) {
            try {
                this.timerWarningSourceNode.stop();
            } catch (e) {
                // Ignore error, e.g. if sound has already finished
            }
            this.timerWarningSourceNode = null;
        }
        if (this.timerWarningHtml5) {
            try {
                this.timerWarningHtml5.pause();
                this.timerWarningHtml5.currentTime = 0;
            } catch {
                /* ignore */
            }
            this.timerWarningHtml5 = null;
        }
    }

    public timeoutFoul() { this.play('bip', 'notification', 0.8).catch(() => {}); }
    public enhancementSuccess() { this.play('success', 'notification', 0.7).catch(() => {}); }
    public combinationGreatSuccess() { this.play('jackpot', 'notification', 0.7).catch(() => {}); }
    public combinationSuccess() { this.play('success', 'notification', 0.7).catch(() => {}); }
    public stoneFallOff() { this.play('fall', 'stone', 0.5).catch(() => {}); }
    public claimReward() { this.play('reward', 'notification', 0.7).catch(() => {}); }
}

export const audioService = new AudioService();