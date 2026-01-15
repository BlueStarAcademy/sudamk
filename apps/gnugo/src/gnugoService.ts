/**
 * GNU Go service
 * 그누고 프로세스 관리 및 프로세스 풀링
 * 각 게임은 독립적으로 처리됨 (gameId로 격리)
 */

import { spawn, ChildProcess } from 'child_process';
import { randomUUID } from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PROJECT_ROOT = process.cwd();
const isRailway = process.env.RAILWAY_ENVIRONMENT || process.env.RAILWAY || false;
const isLinux = process.platform === 'linux';

// GNU Go 경로 설정
const defaultGnugoPath = isLinux
  ? '/usr/games/gnugo' // Debian/Ubuntu 기본 경로
  : path.resolve(PROJECT_ROOT, 'gnugo/gnugo.exe'); // Windows

const GNUGO_PATH = process.env.GNUGO_PATH || defaultGnugoPath;
const GNUGO_PATHS_TO_TRY = [
  ...(process.env.GNUGO_PATH ? [process.env.GNUGO_PATH] : []),
  '/usr/games/gnugo',
  '/usr/bin/gnugo',
];

const resolveGnugoPath = (): string => {
  for (const candidate of GNUGO_PATHS_TO_TRY) {
    if (candidate && fs.existsSync(candidate)) {
      return candidate;
    }
  }
  return GNUGO_PATH;
};

// GNU Go 레벨 범위: 1-10 (GNU Go 기본 지원 범위)
const MIN_LEVEL = 1;
const MAX_LEVEL = 10;
const DEFAULT_LEVEL = 5;

/**
 * 레벨 검증 함수
 * @param level 검증할 레벨 값
 * @returns 검증된 레벨 (1-10 범위)
 * @throws Error 레벨이 범위를 벗어난 경우
 */
function validateLevel(level: number): number {
  const levelInt = Math.floor(level);
  if (levelInt < MIN_LEVEL || levelInt > MAX_LEVEL) {
    throw new Error(`GNU Go level must be between ${MIN_LEVEL} and ${MAX_LEVEL}, got: ${levelInt}`);
  }
  return levelInt;
}

// 환경 변수에서 기본 레벨 읽기 및 검증
let GNUGO_LEVEL = DEFAULT_LEVEL;
if (process.env.GNUGO_LEVEL) {
  try {
    const envLevel = parseInt(process.env.GNUGO_LEVEL, 10);
    GNUGO_LEVEL = validateLevel(envLevel);
  } catch (error) {
    console.warn(`[GNU Go] Invalid GNUGO_LEVEL environment variable: ${process.env.GNUGO_LEVEL}. Using default level ${DEFAULT_LEVEL}.`);
    GNUGO_LEVEL = DEFAULT_LEVEL;
  }
}

const GNUGO_POOL_SIZE = parseInt(process.env.GNUGO_POOL_SIZE || '5', 10); // 프로세스 풀 크기

export interface GnugoMoveRequest {
  gameId: string; // 게임 세션 식별자
  boardState: number[][];
  boardSize: number;
  currentPlayer: 1 | 2;
  level?: number;
}

export interface GnugoMoveResult {
  gameId: string;
  move: { x: number; y: number } | null;
  error?: string;
}

/**
 * GNU Go 프로세스 풀 관리자
 * 각 게임은 독립적으로 처리됨
 */
class GnugoProcessPool {
  private processes: Array<{
    id: string;
    process: ChildProcess;
    inUse: boolean;
    gameId: string | null;
    lastUsed: number;
  }> = [];
  private maxSize: number;

  constructor(maxSize: number) {
    this.maxSize = maxSize;
  }

  /**
   * 사용 가능한 프로세스 가져오기
   */
  async acquire(gameId: string): Promise<{ id: string; process: ChildProcess } | null> {
    // 사용 가능한 프로세스 찾기
    let available = this.processes.find((p) => !p.inUse);
    
    if (!available && this.processes.length < this.maxSize) {
      // 새 프로세스 생성
      const process = await this.createProcess();
      if (process) {
        available = {
          id: randomUUID(),
          process,
          inUse: true,
          gameId,
          lastUsed: Date.now(),
        };
        this.processes.push(available);
        return { id: available.id, process: available.process };
      }
    }

    if (available) {
      available.inUse = true;
      available.gameId = gameId;
      available.lastUsed = Date.now();
      return { id: available.id, process: available.process };
    }

    return null;
  }

  /**
   * 프로세스 해제
   */
  release(processId: string): void {
    const proc = this.processes.find((p) => p.id === processId);
    if (proc) {
      proc.inUse = false;
      proc.gameId = null;
    }
  }

  /**
   * 새 GNU Go 프로세스 생성
   */
  private async createProcess(): Promise<ChildProcess | null> {
    try {
      // GNU Go는 GTP 프로토콜을 사용
      const gnugoBinary = resolveGnugoPath();
      const gnugo = spawn(gnugoBinary, [
        '--mode', 'gtp',
        '--level', GNUGO_LEVEL.toString(),
      ]);

      gnugo.on('error', (error) => {
        console.error('[GNU Go] Process error:', error);
      });

      return gnugo;
    } catch (error) {
      console.error('[GNU Go] Failed to create process:', error);
      return null;
    }
  }

  /**
   * 모든 프로세스 정리
   */
  cleanup(): void {
    this.processes.forEach((p) => {
      if (p.process && !p.process.killed) {
        p.process.kill();
      }
    });
    this.processes = [];
  }
}

class GnugoService {
  private pool: GnugoProcessPool;
  private isInitialized = false;

  constructor() {
    this.pool = new GnugoProcessPool(GNUGO_POOL_SIZE);
  }

  /**
   * 서비스 초기화
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      // GNU Go 바이너리 확인
      const gnugoBinary = resolveGnugoPath();
      if (!fs.existsSync(gnugoBinary)) {
        console.warn(`[GNU Go] Binary not found at ${gnugoBinary}. GNU Go may not be available.`);
        console.warn('[GNU Go] Install GNU Go: apt-get install gnugo (Linux) or download from source');
      } else {
        console.log(`[GNU Go] Binary found at ${gnugoBinary}`);
      }

      this.isInitialized = true;
      console.log('[GNU Go] Service initialized');
    } catch (error) {
      console.error('[GNU Go] Initialization error:', error);
      throw error;
    }
  }

  /**
   * 서비스 준비 상태 확인
   */
  async isReady(): Promise<boolean> {
    const gnugoBinary = resolveGnugoPath();
    return this.isInitialized && fs.existsSync(gnugoBinary);
  }

  /**
   * AI 수 받기
   * 각 게임은 독립적으로 처리됨 (gameId로 격리)
   */
  async getMove(request: GnugoMoveRequest): Promise<GnugoMoveResult> {
    try {
      // 레벨 검증
      let level = request.level || GNUGO_LEVEL;
      try {
        level = validateLevel(level);
      } catch (error) {
        return {
          gameId: request.gameId,
          move: null,
          error: error instanceof Error ? error.message : 'Invalid level',
        };
      }

      // 프로세스 풀에서 프로세스 가져오기
      const procInfo = await this.pool.acquire(request.gameId);
      
      if (!procInfo) {
        return {
          gameId: request.gameId,
          move: null,
          error: 'No available GNU Go process',
        };
      }

      try {
        // SGF 형식으로 보드 상태 변환
        const sgf = this.boardStateToSGF(request.boardState, request.boardSize, request.currentPlayer);
        
        // GNU Go에 명령 전송 (검증된 레벨 사용)
        const move = await this.queryGTP(procInfo.process, sgf, level);
        
        return {
          gameId: request.gameId,
          move,
        };
      } finally {
        // 프로세스 해제
        this.pool.release(procInfo.id);
      }
    } catch (error) {
      console.error('[GNU Go] Error getting move:', error);
      return {
        gameId: request.gameId,
        move: null,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * 보드 상태를 SGF 형식으로 변환
   */
  private boardStateToSGF(boardState: number[][], boardSize: number, currentPlayer: 1 | 2): string {
    // 간단한 SGF 생성 (실제로는 더 복잡한 변환이 필요)
    let sgf = `(;SZ[${boardSize}]`;
    
    // 보드 상태를 SGF로 변환
    for (let y = 0; y < boardSize; y++) {
      for (let x = 0; x < boardSize; x++) {
        if (boardState[y][x] === 1) {
          sgf += `;B[${String.fromCharCode(97 + x)}${String.fromCharCode(97 + y)}]`;
        } else if (boardState[y][x] === 2) {
          sgf += `;W[${String.fromCharCode(97 + x)}${String.fromCharCode(97 + y)}]`;
        }
      }
    }
    
    sgf += ')';
    return sgf;
  }

  /**
   * GTP 프로토콜로 GNU Go에 쿼리
   */
  private async queryGTP(process: ChildProcess, sgf: string, level: number): Promise<{ x: number; y: number } | null> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('GTP query timeout'));
      }, 10000);

      let output = '';
      
      const onData = (data: Buffer) => {
        output += data.toString();
        if (output.includes('=')) {
          clearTimeout(timeout);
          process.stdout?.removeListener('data', onData);
          
          // GTP 응답 파싱
          const match = output.match(/=\s*([A-T])(\d+)/);
          if (match) {
            const x = match[1].charCodeAt(0) - 65; // A=0, B=1, ...
            const y = parseInt(match[2], 10) - 1;
            resolve({ x, y });
          } else if (output.includes('PASS')) {
            resolve(null); // 패스
          } else {
            reject(new Error('Invalid GTP response'));
          }
        }
      };

      process.stdout?.on('data', onData);
      
      // GTP 명령 전송
      process.stdin?.write(`genmove ${level === 1 ? 'black' : 'white'}\n`);
    });
  }

  /**
   * 서비스 상태 조회
   */
  async getStatus(): Promise<any> {
    return {
      initialized: this.isInitialized,
      poolSize: this.pool['processes'].length,
      maxPoolSize: GNUGO_POOL_SIZE,
      gnugoPath: resolveGnugoPath(),
      gnugoExists: fs.existsSync(resolveGnugoPath()),
      level: {
        current: GNUGO_LEVEL,
        min: MIN_LEVEL,
        max: MAX_LEVEL,
        default: DEFAULT_LEVEL,
      },
    };
  }
}

export const gnugoService = new GnugoService();

