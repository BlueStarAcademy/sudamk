/**
 * Per-game FIFO serial queue.
 * PLACE_STONE and REQUEST_SERVER_AI_MOVE must share this so clientSync + AI
 * cannot race human stone commit on the same session.
 */
const gameSerialQueues = new Map<string, Promise<unknown>>();

export async function runPerGameSerial<T>(gameId: string, task: () => Promise<T>): Promise<T> {
    const key = String(gameId ?? '');
    const previous = gameSerialQueues.get(key) ?? Promise.resolve();
    const nextTask = previous.catch(() => undefined).then(task);
    const queueTail = nextTask.finally(() => {
        if (gameSerialQueues.get(key) === queueTail) {
            gameSerialQueues.delete(key);
        }
    });
    gameSerialQueues.set(key, queueTail);
    return nextTask;
}
