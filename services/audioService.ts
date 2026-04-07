/// <reference lib="dom" />

import type { SoundSettings } from '../types.js';
import { defaultSettings } from '../hooks/useAppSettings.js';

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
    private audioBuffers = new Map<string, AudioBuffer>();
    /** 동일 URL 동시 디코드 방지 */
    private bufferLoads = new Map<string, Promise<AudioBuffer | null>>();
    private preloadStarted = false;
    /** Express/Vite 정적 경로와 일치: `server.ts`의 `app.use('/sounds', ... public/sounds)` */
    private soundsPath = '/sounds/';
    private settings: SoundSettings = defaultSettings.sound;
    private html5AudioUnlocked = false;

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
            void ctx.resume();
        });
    }

    /**
     * iOS Safari·모바일 WebView: `AudioContext.resume()`은 사용자 제스처의 **동기** 호출 스택에서
     * 실행되어야 합니다. `async initialize()` 안에서 `await` 뒤에 resume 하면 제스처가 끝난 것으로
     * 간주되어 컨텍스트가 계속 `suspended`인 경우가 많습니다.
     * 버튼/보드 입력 등 UI 핸들러 맨 앞에서도 호출하세요.
     */
    public unlockFromUserGesture(): void {
        if (typeof window === 'undefined') return;
        this.hookVisibilityResume();
        try {
            const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
            if (!AC) return;
            if (!this.audioContext) {
                this.audioContext = new AC();
            }
            const ctx = this.audioContext;
            if (ctx.state === 'closed') return;
            void ctx.resume();
            // 일부 WebKit: 무음 1프레임으로 디코더·출력 경로까지 열어 줌
            const buf = ctx.createBuffer(1, 1, ctx.sampleRate);
            const src = ctx.createBufferSource();
            src.buffer = buf;
            src.connect(ctx.destination);
            try {
                src.start(0);
            } catch {
                /* suspended 등 */
            }
            // Android WebView/Samsung Internet 대응:
            // WebAudio 잠금과 별개로 HTML5 Audio autoplay gate를 사용자 제스처에서 함께 해제한다.
            this.tryUnlockHtml5Audio();
            this.kickPreloadAfterUnlock();
        } catch (e) {
            console.warn('[AudioService] unlockFromUserGesture:', e);
        }
    }

    /** 제스처 직후 네트워크·디코드를 시작해, 이후 play()가 await 체인 밖에서 너무 늦지 않게 함 */
    private kickPreloadAfterUnlock(): void {
        if (this.preloadStarted) return;
        this.preloadStarted = true;
        for (const name of SOUND_BASE_NAMES) {
            const url = `${this.soundsPath}${name}.mp3`;
            void this.loadSound(url).catch(() => {});
        }
    }

    private tryUnlockHtml5Audio(): void {
        if (this.html5AudioUnlocked || typeof window === 'undefined') return;
        try {
            const probe = new Audio();
            probe.preload = 'auto';
            probe.muted = true;
            probe.volume = 0;
            probe.playsInline = true;
            probe.setAttribute('playsinline', 'true');
            probe.setAttribute('webkit-playsinline', 'true');
            // 매우 짧은 무음 wav (data URI)로 autoplay gate 해제 시도
            probe.src = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=';
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

    /** Web Audio가 잠긴 경우(iOS 등)에만 사용 — master·카테고리 반영된 최종 볼륨(0~1) */
    private playHtml5Fallback(soundName: string, category: keyof SoundSettings['categoryMuted'], effectiveVolume: number, loop: boolean): void {
        if (this.settings.masterMuted || this.settings.categoryMuted[category]) return;
        const el = new Audio(`${this.soundsPath}${soundName}.mp3`);
        el.volume = Math.max(0, Math.min(1, effectiveVolume));
        el.loop = loop;
        el.preload = 'auto';
        el.playsInline = true;
        el.setAttribute('playsinline', 'true');
        el.setAttribute('webkit-playsinline', 'true');
        void el.play().catch((e) => {
            console.warn('[AudioService] HTML5 fallback play failed:', soundName, e);
        });
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
        
        const source = ctx.createBufferSource();
        source.buffer = buffer;
        source.loop = loop;
        const gainNode = ctx.createGain();
        gainNode.gain.setValueAtTime(volume, ctx.currentTime);
        source.connect(gainNode);
        gainNode.connect(ctx.destination);
        source.start(0);
        return source;
    }
    
    private async play(soundName: string, category: keyof SoundSettings['categoryMuted'], volume: number, loop = false): Promise<AudioBufferSourceNode | null> {
        if (this.settings.masterMuted || this.settings.categoryMuted[category]) return null;
        // 일부 모바일 브라우저에서 초기 unlock이 누락돼도, 실제 재생 시도 순간에 다시 열어준다.
        this.unlockFromUserGesture();
        const effectiveVolume = volume * this.settings.masterVolume;
        try {
            const buffer = await this.loadSound(`${this.soundsPath}${soundName}.mp3`);
            if (buffer) {
                const node = await this.playSound(buffer, effectiveVolume, loop);
                if (node) return node;
            }
            this.playHtml5Fallback(soundName, category, effectiveVolume, loop);
        } catch (e) {
            console.error(`Could not play sound ${soundName}`, e);
            this.playHtml5Fallback(soundName, category, effectiveVolume, loop);
        }
        return null;
    }

    // Public methods based on user request
    public placeStone() { this.play('move', 'stone', 0.7).catch(() => {}); }
    public rollDice(count: number) { this.play('dice', 'item', 0.6).catch(() => {}); if (count > 1) { setTimeout(() => this.play('dice', 'item', 0.6).catch(() => {}), 500); } }
    public enhancementFail() { this.play('failure', 'notification', 0.7).catch(() => {}); }
    public revealHiddenStone() { this.play('hidden', 'item', 0.8).catch(() => {}); }
    public async playScanBgm() { this.stopScanBgm(); this.scanBgmSourceNode = await this.play('scanbgm', 'item', 0.4, true); }
    public stopScanBgm() { if (this.scanBgmSourceNode) { try { this.scanBgmSourceNode.stop(); } catch(e) {} this.scanBgmSourceNode = null; } }
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
            } catch(e) {
                // Ignore error, e.g. if sound has already finished
            }
            this.timerWarningSourceNode = null;
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