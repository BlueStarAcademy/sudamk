/**
 * 로컬 GnuGo GTP 실행 (Electron 전용, 서버 의존 없음)
 * GnuGo가 PATH에 있거나 GNUGO_PATH 환경 변수로 지정 필요
 */
const { spawn } = require('child_process');
const path = require('path');

const LETTERS = 'ABCDEFGHJKLMNOPQRST';
const GNUGO_PATH = process.env.GNUGO_PATH || 'gnugo';
const GNUGO_LEVEL = parseInt(process.env.GNUGO_LEVEL || '10', 10);

let gnuGoProcess = null;
let isReady = false;

function pointToGtpCoord(point, boardSize) {
    if (point.x === -1 || point.y === -1) return 'pass';
    if (point.x >= 0 && point.x < LETTERS.length && point.y >= 0 && point.y < boardSize) {
        return `${LETTERS[point.x]}${boardSize - point.y}`;
    }
    return 'pass';
}

function gtpCoordToPoint(coord, boardSize) {
    const normalized = (coord || '').trim().toUpperCase();
    if (normalized === 'PASS' || normalized === '') return { x: -1, y: -1 };
    const letter = normalized.charAt(0);
    const x = LETTERS.indexOf(letter);
    if (x === -1) return { x: -1, y: -1 };
    const row = parseInt(normalized.substring(1), 10);
    if (isNaN(row) || row < 1 || row > boardSize) return { x: -1, y: -1 };
    return { x, y: boardSize - row };
}

function boardStateToGtpCommands(boardState, boardSize, moveHistory, currentPlayer) {
    const commands = ['clear_board'];
    for (const move of moveHistory || []) {
        if (move.x === -1 || move.y === -1) {
            const color = move.player === 1 ? 'black' : 'white';
            commands.push(`play ${color} pass`);
        } else {
            const color = move.player === 1 ? 'black' : 'white';
            const coord = pointToGtpCoord({ x: move.x, y: move.y }, boardSize);
            if (coord !== 'pass') commands.push(`play ${color} ${coord}`);
        }
    }
    return commands;
}

function sendGtpCommand(proc, command, timeoutMs = 5000) {
    return new Promise((resolve, reject) => {
        if (!proc.stdin || !proc.stdout) return reject(new Error('GnuGo stdio not available'));
        let response = '';
        let done = false;
        const timeoutId = setTimeout(() => {
            if (!done) {
                done = true;
                proc.stdout.removeListener('data', onData);
                reject(new Error(`GTP timeout: ${command}`));
            }
        }, timeoutMs);
        const onData = (data) => {
            response += data.toString();
            if (response.includes('\n\n') || /^=\s*\n$/m.test(response)) {
                if (!done) {
                    done = true;
                    clearTimeout(timeoutId);
                    proc.stdout.removeListener('data', onData);
                    resolve(response);
                }
            }
        };
        proc.stdout.on('data', onData);
        proc.stdin.write(command + '\n', (err) => {
            if (err && !done) {
                done = true;
                clearTimeout(timeoutId);
                proc.stdout.removeListener('data', onData);
                reject(err);
            }
        });
    });
}

function ensureGnuGo() {
    if (gnuGoProcess && !gnuGoProcess.killed) return Promise.resolve();
    return new Promise((resolve, reject) => {
        try {
            gnuGoProcess = spawn(GNUGO_PATH, ['--mode', 'gtp', '--level', String(GNUGO_LEVEL)], {
                stdio: ['pipe', 'pipe', 'pipe']
            });
            gnuGoProcess.on('error', (e) => {
                isReady = false;
                reject(e);
            });
            gnuGoProcess.on('exit', (code) => {
                gnuGoProcess = null;
                isReady = false;
            });
            gnuGoProcess.stderr?.on('data', () => {});
            setTimeout(() => {
                sendGtpCommand(gnuGoProcess, 'version', 3000)
                    .then(() => {
                        isReady = true;
                        resolve();
                    })
                    .catch(reject);
            }, 300);
        } catch (e) {
            reject(e);
        }
    });
}

/**
 * @param {{ boardState: number[][], boardSize: number, player: string, moveHistory: Array<{x,y,player}>, level?: number }} request
 * @returns {Promise<{x: number, y: number}>}
 */
async function getGnuGoMove(request) {
    const { boardState, boardSize, player, moveHistory = [], level } = request;
    await ensureGnuGo();
    const color = (player || 'black').toLowerCase() === 'white' ? 'white' : 'black';
    const commands = boardStateToGtpCommands(boardState, boardSize, moveHistory, color);
    for (const cmd of commands) {
        await sendGtpCommand(gnuGoProcess, cmd, 2000);
    }
    const levelNum = level >= 1 && level <= 10 ? level : GNUGO_LEVEL;
    await sendGtpCommand(gnuGoProcess, `level ${levelNum}`, 2000);
    const genMoveResponse = await sendGtpCommand(gnuGoProcess, `genmove ${color}`, 10000);
    const match = genMoveResponse.match(/^=\s*([A-T]\d+|pass)/im);
    if (!match) throw new Error('Invalid genmove response: ' + genMoveResponse);
    const point = gtpCoordToPoint(match[1].trim(), boardSize);
    return point;
}

function isGnuGoAvailable() {
    return isReady && gnuGoProcess && !gnuGoProcess.killed;
}

module.exports = { getGnuGoMove, isGnuGoAvailable };
