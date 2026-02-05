/**
 * GnuGo Service
 * 
 * Provides GnuGo AI engine integration using GTP (Go Text Protocol)
 * GnuGo is used as the primary AI for game moves, with goAiBot as fallback
 */

import { spawn, ChildProcess } from 'child_process';
import { Point } from '../types/index.js';
import { fileURLToPath } from 'url';
import path from 'path';
import http from 'http';
import https from 'https';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// GTP coordinate letters (19x19 board)
const LETTERS = "ABCDEFGHJKLMNOPQRST";

// GnuGo command path (default to system 'gnugo' command, can be overridden)
const GNUGO_PATH = process.env.GNUGO_PATH || 'gnugo';
const GNUGO_LEVEL = parseInt(process.env.GNUGO_LEVEL || '10', 10); // Level 1-10 (10 is strongest)

// HTTP API URL for GnuGo service (Railway deployment)
// 주의: Railway 멀티서비스 구조에서 자동 도메인 추론은 백엔드 자기 자신을 가리킬 수 있어
// 반드시 GNUGO_API_URL을 명시적으로 설정하는 것을 권장합니다.
const IS_LOCAL = process.env.NODE_ENV !== 'production';
let GNUGO_API_URL: string | undefined = process.env.GNUGO_API_URL?.trim();

// 프로토콜이 없으면 자동으로 https:// 추가
if (GNUGO_API_URL && !GNUGO_API_URL.match(/^https?:\/\//)) {
    GNUGO_API_URL = `https://${GNUGO_API_URL}`;
}
const USE_HTTP_API = !!GNUGO_API_URL && GNUGO_API_URL.trim() !== '';

interface GnuGoManager {
    process: ChildProcess | null;
    isStarting: boolean;
    isReady: boolean;
    lastError: Error | null;
}

interface GenerateMoveRequest {
    boardState: number[][];
    boardSize: number;
    player: 'black' | 'white' | string;
    moveHistory: Array<{ x: number; y: number; player: number }>;
}

// Singleton manager instance
let gnuGoManager: GnuGoManager = {
    process: null,
    isStarting: false,
    isReady: false,
    lastError: null
};

/**
 * Convert point to GTP coordinate format
 * GTP uses letters (A-T, skipping I) for columns and numbers (1-19) for rows
 */
function pointToGtpCoord(point: Point, boardSize: number): string {
    if (point.x === -1 || point.y === -1) {
        return 'pass';
    }
    if (point.x >= 0 && point.x < LETTERS.length && point.y >= 0 && point.y < boardSize) {
        const letter = LETTERS[point.x];
        const row = boardSize - point.y; // GTP uses 1-19 from bottom, we use 0-18 from top
        return `${letter}${row}`;
    }
    return 'pass';
}

/**
 * Convert GTP coordinate to point
 */
function gtpCoordToPoint(coord: string, boardSize: number): Point {
    const normalized = coord.trim().toUpperCase();
    if (normalized === 'PASS' || normalized === '') {
        return { x: -1, y: -1 };
    }
    
    const letter = normalized.charAt(0);
    const x = LETTERS.indexOf(letter);
    if (x === -1) {
        console.warn(`[GnuGo Service] Invalid GTP coordinate letter: ${letter}`);
        return { x: -1, y: -1 };
    }
    
    const rowStr = normalized.substring(1);
    const row = parseInt(rowStr, 10);
    if (isNaN(row) || row < 1 || row > boardSize) {
        console.warn(`[GnuGo Service] Invalid GTP coordinate row: ${rowStr}`);
        return { x: -1, y: -1 };
    }
    
    const y = boardSize - row; // Convert from GTP row (1-19 bottom-up) to our y (0-18 top-down)
    return { x, y };
}

/**
 * Convert board state and move history to GTP commands
 */
function boardStateToGtpCommands(
    boardState: number[][],
    boardSize: number,
    moveHistory: Array<{ x: number; y: number; player: number }>,
    currentPlayer: 'black' | 'white' | string
): string[] {
    const commands: string[] = [];
    
    // Clear board
    commands.push('clear_board');
    
    // Play moves from history
    for (const move of moveHistory) {
        if (move.x === -1 || move.y === -1) {
            // Pass
            const color = move.player === 1 ? 'black' : 'white'; // Assuming 1=Black, 2=White
            commands.push(`play ${color} pass`);
        } else {
            const color = move.player === 1 ? 'black' : 'white';
            const coord = pointToGtpCoord({ x: move.x, y: move.y }, boardSize);
            if (coord !== 'pass') {
                commands.push(`play ${color} ${coord}`);
            }
        }
    }
    
    return commands;
}

/**
 * Send GTP command and get response
 */
function sendGtpCommand(process: ChildProcess, command: string, timeout: number = 5000): Promise<string> {
    return new Promise((resolve, reject) => {
        if (!process.stdin || !process.stdout) {
            reject(new Error('GnuGo process stdio not available'));
            return;
        }
        
        let response = '';
        let responseComplete = false;
        
        const timeoutId = setTimeout(() => {
            if (!responseComplete) {
                responseComplete = true;
                reject(new Error(`GTP command timeout: ${command}`));
            }
        }, timeout);
        
        const dataHandler = (data: Buffer) => {
            const text = data.toString();
            response += text;
            
            // GTP responses end with empty line after the response
            if (text.includes('\n\n') || text.match(/^=\s*\n$/m)) {
                clearTimeout(timeoutId);
                if (!responseComplete) {
                    responseComplete = true;
                    process.stdout?.removeListener('data', dataHandler);
                    resolve(response);
                }
            }
        };
        
        process.stdout.once('data', dataHandler);
        
        // Send command
        process.stdin.write(command + '\n', (err) => {
            if (err) {
                clearTimeout(timeoutId);
                if (!responseComplete) {
                    responseComplete = true;
                    process.stdout?.removeListener('data', dataHandler);
                    reject(err);
                }
            }
        });
    });
}

/**
 * Initialize GnuGo process
 */
export async function initializeGnuGo(): Promise<void> {
    if (gnuGoManager.process && !gnuGoManager.process.killed) {
        console.log('[GnuGo Service] GnuGo process already running');
        return;
    }
    
    if (gnuGoManager.isStarting) {
        console.log('[GnuGo Service] GnuGo initialization already in progress');
        return;
    }
    
    gnuGoManager.isStarting = true;
    gnuGoManager.lastError = null;
    
    try {
        console.log(`[GnuGo Service] Starting GnuGo process: ${GNUGO_PATH}`);
        console.log(`[GnuGo Service] GnuGo level: ${GNUGO_LEVEL}`);
        
        // Spawn GnuGo process with GTP mode
        const process = spawn(GNUGO_PATH, ['--mode', 'gtp', '--level', GNUGO_LEVEL.toString()], {
            stdio: ['pipe', 'pipe', 'pipe']
        });
        
        gnuGoManager.process = process;
        
        // Handle process errors
        process.on('error', (error) => {
            console.error('[GnuGo Service] Process error:', error);
            gnuGoManager.lastError = error as Error;
            gnuGoManager.isReady = false;
        });
        
        process.on('exit', (code, signal) => {
            console.log(`[GnuGo Service] Process exited: code=${code}, signal=${signal}`);
            gnuGoManager.process = null;
            gnuGoManager.isReady = false;
        });
        
        // Handle stderr (GnuGo sends some info to stderr)
        process.stderr?.on('data', (data) => {
            const text = data.toString();
            if (text.includes('error') || text.includes('Error')) {
                console.warn('[GnuGo Service] stderr:', text.trim());
            }
        });
        
        // Test connection with a simple command
        try {
            // Wait a bit for process to start
            await new Promise(resolve => setTimeout(resolve, 500));
            
            // Send version command to test
            const versionResponse = await sendGtpCommand(process, 'version', 3000);
            console.log('[GnuGo Service] GnuGo version:', versionResponse.trim());
            
            gnuGoManager.isReady = true;
            gnuGoManager.isStarting = false;
            console.log('[GnuGo Service] ✅ GnuGo initialized successfully');
        } catch (error: any) {
            console.error('[GnuGo Service] Failed to initialize GnuGo:', error.message);
            gnuGoManager.lastError = error;
            gnuGoManager.isReady = false;
            gnuGoManager.isStarting = false;
            // Don't throw - allow server to continue without GnuGo
        }
        
    } catch (error: any) {
        console.error('[GnuGo Service] Failed to spawn GnuGo process:', error);
        gnuGoManager.lastError = error;
        gnuGoManager.isReady = false;
        gnuGoManager.isStarting = false;
        // Don't throw - allow server to continue without GnuGo
    }
}

/**
 * Generate move using GnuGo via HTTP API
 */
async function generateGnuGoMoveViaHttp(request: GenerateMoveRequest, apiUrl?: string): Promise<Point> {
    const urlToUse = apiUrl || GNUGO_API_URL;
    if (!urlToUse) {
        throw new Error('GNUGO_API_URL is not set');
    }
    
    const url = new URL(urlToUse);
    const httpModule = url.protocol === 'https:' ? https : http;
    
    return new Promise((resolve, reject) => {
        const requestData = JSON.stringify({
            boardState: request.boardState,
            boardSize: request.boardSize,
            player: request.player,
            moveHistory: request.moveHistory
        });
        
        const options = {
            hostname: url.hostname,
            port: url.port || (url.protocol === 'https:' ? 443 : 80),
            path: url.pathname,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(requestData)
            },
            timeout: 10000
        };
        
        const req = httpModule.request(options, (res) => {
            let data = '';
            
            res.on('data', (chunk) => {
                data += chunk;
            });
            
            res.on('end', () => {
                try {
                    if (res.statusCode !== 200) {
                        reject(new Error(`GnuGo API error: ${res.statusCode} - ${data}`));
                        return;
                    }
                    
                    const response = JSON.parse(data);
                    if (response.error) {
                        reject(new Error(response.error));
                        return;
                    }
                    
                    if (!response.move || typeof response.move.x === 'undefined' || typeof response.move.y === 'undefined') {
                        reject(new Error('Invalid GnuGo API response'));
                        return;
                    }
                    
                    resolve(response.move);
                } catch (error: any) {
                    reject(new Error(`Failed to parse GnuGo API response: ${error.message}`));
                }
            });
        });
        
        req.on('error', (error) => {
            reject(error);
        });
        
        req.on('timeout', () => {
            req.destroy();
            reject(new Error('GnuGo API request timeout'));
        });
        
        req.write(requestData);
        req.end();
    });
}

/**
 * Generate move using GnuGo (supports both local process and HTTP API)
 */
export async function generateGnuGoMove(request: GenerateMoveRequest): Promise<Point> {
    const { boardState, boardSize, player, moveHistory } = request;
    
    // Try HTTP API first if available
    if (USE_HTTP_API && GNUGO_API_URL) {
        try {
            console.log(`[GnuGo Service] Using HTTP API: ${GNUGO_API_URL}`);
            return await generateGnuGoMoveViaHttp(request);
        } catch (error: any) {
            console.warn('[GnuGo Service] HTTP API failed, falling back to local process:', error.message);
            // Fall through to local process
        }
    }
    
    // Use local process
    if (!gnuGoManager.process || gnuGoManager.process.killed) {
        throw new Error('GnuGo process is not running and HTTP API is not available');
    }
    
    if (!gnuGoManager.isReady) {
        throw new Error('GnuGo is not ready');
    }
    
    try {
        const process = gnuGoManager.process;
        
        // Convert player string to GTP color
        const color = player.toLowerCase() === 'white' ? 'white' : 'black';
        
        // Set up board state
        const setupCommands = boardStateToGtpCommands(boardState, boardSize, moveHistory, color);
        for (const cmd of setupCommands) {
            await sendGtpCommand(process, cmd, 2000);
        }
        
        // Generate move
        const genMoveResponse = await sendGtpCommand(process, `genmove ${color}`, 10000);
        
        // Parse response (format: "= A1\n" or "= pass\n")
        const match = genMoveResponse.match(/^=\s*([A-T]\d+|pass)/i);
        if (!match) {
            throw new Error(`Invalid genmove response: ${genMoveResponse}`);
        }
        
        const moveCoord = match[1];
        const point = gtpCoordToPoint(moveCoord, boardSize);
        
        return point;
        
    } catch (error: any) {
        console.error('[GnuGo Service] Error generating move:', error);
        gnuGoManager.lastError = error;
        throw error;
    }
}

/**
 * Get GnuGo manager instance
 */
export function getGnuGoManager(): GnuGoManager {
    return gnuGoManager;
}

/**
 * Check if GnuGo is available
 */
export function isGnuGoAvailable(): boolean {
    return gnuGoManager.isReady && gnuGoManager.process !== null && !gnuGoManager.process.killed;
}

