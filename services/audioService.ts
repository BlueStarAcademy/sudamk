/// <reference lib="dom" />

import { ItemGrade } from '../types.js';
import type { SoundSettings } from '../types.js';
import { defaultSettings } from '../hooks/useAppSettings.js';

class AudioService {
    private audioContext: AudioContext | null = null;
    /** 동시 initialize() 호출을 하나로 묶어, 진행 중인 초기화가 끝날 때까지 대기 */
    private initMutex: Promise<void> | null = null;
    private scanBgmSourceNode: AudioBufferSourceNode | null = null;
    private timerWarningSourceNode: AudioBufferSourceNode | null = null;
    private audioBuffers = new Map<string, AudioBuffer>();
    /** Express/Vite 정적 경로와 일치: `server.ts`의 `app.use('/sounds', ... public/sounds)` */
    private soundsPath = '/sounds/';
    private settings: SoundSettings = defaultSettings.sound;

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

    public async initialize(): Promise<void> {
        if (this.isReady()) return;
        if (this.initMutex) {
            await this.initMutex;
            return;
        }
        this.initMutex = (async () => {
            try {
                if (!this.audioContext) {
                    this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
                }
                await this.resumeContextIfNeeded(this.audioContext);
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
        try {
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const arrayBuffer = await response.arrayBuffer();
            const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
            this.audioBuffers.set(url, audioBuffer);
            return audioBuffer;
        } catch (error) {
            console.error(`Failed to load sound: ${url}`, error);
            return null;
        }
    }

    private async playSound(buffer: AudioBuffer, volume = 1, loop = false): Promise<AudioBufferSourceNode | null> {
        await this.initialize();
        if (!this.audioContext || this.audioContext.state === 'closed') return null;

        await this.resumeContextIfNeeded(this.audioContext);
        if (this.needsResume(this.audioContext)) {
            await new Promise((r) => setTimeout(r, 0));
            await this.resumeContextIfNeeded(this.audioContext);
        }

        if (this.audioContext.state !== 'running') {
            console.warn('[AudioService] context not running, skip playback:', this.audioContext.state);
            return null;
        }
        
        const source = this.audioContext.createBufferSource();
        source.buffer = buffer;
        source.loop = loop;
        const gainNode = this.audioContext.createGain();
        gainNode.gain.setValueAtTime(volume, this.audioContext.currentTime);
        source.connect(gainNode);
        gainNode.connect(this.audioContext.destination);
        source.start(0);
        return source;
    }
    
    private async play(soundName: string, category: keyof SoundSettings['categoryMuted'], volume: number, loop = false): Promise<AudioBufferSourceNode | null> {
        if (this.settings.masterMuted || this.settings.categoryMuted[category]) return null;
        try {
            const buffer = await this.loadSound(`${this.soundsPath}${soundName}.mp3`);
            if (buffer) return await this.playSound(buffer, volume * this.settings.masterVolume, loop);
        } catch (e) {
            console.error(`Could not play sound ${soundName}`, e);
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