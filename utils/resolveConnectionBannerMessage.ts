import type { TFunction } from 'i18next';

const CONNECTION_MESSAGE_KEYS: Record<string, string> = {
    '서버 연결이 복구되었습니다.': 'connection.restored',
    '게임 정보를 다시 동기화하는 중입니다.': 'connection.resyncingGame',
    '서버 응답이 지연되고 있습니다. 연결이 복구되면 데이터가 자동으로 동기화됩니다.': 'connection.serverDelayed',
    '요청을 완료하지 못했습니다. 연결 상태를 확인한 뒤 다시 시도해주세요.': 'connection.requestFailed',
    '서버와 다시 연결하는 중입니다. 잠시만 기다려주세요.': 'connection.reconnectingWait',
    '서버 연결을 다시 확인하는 중입니다.': 'connection.verifyingConnection',
    '게임 정보를 불러오지 못했습니다. 연결 상태를 확인한 뒤 다시 시도해주세요.': 'connection.gameLoadFailed',
    '관리자에 의해 접속이 종료되었습니다.': 'connection.adminDisconnected',
    '서버에 다시 연결하는 중…': 'connection.reconnecting',
    '서버에 연결되었습니다.': 'connection.connected',
    '서버 연결이 끊어졌습니다.': 'connection.disconnected',
    '오프라인 상태입니다.': 'connection.offline',
};

export function resolveConnectionBannerMessage(message: string | null | undefined, t: TFunction<'common'>): string | null {
    if (!message) return null;
    const key = CONNECTION_MESSAGE_KEYS[message];
    if (key) return t(key);
    return message;
}
