/**
 * 구글 로그인 인증 서비스
 */

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const GOOGLE_REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI || 'http://localhost:5173/auth/google/callback';

/**
 * 구글 로그인 URL을 생성합니다.
 */
export const getGoogleAuthUrl = (): string => {
    if (!GOOGLE_CLIENT_ID) {
        throw new Error('GOOGLE_CLIENT_ID is not configured');
    }

    const params = new URLSearchParams({
        client_id: GOOGLE_CLIENT_ID,
        redirect_uri: GOOGLE_REDIRECT_URI,
        response_type: 'code',
        scope: 'openid email profile',
        access_type: 'offline',
        prompt: 'consent',
    });

    return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
};

/**
 * 구글 인증 코드로 액세스 토큰을 받아옵니다.
 */
export const getGoogleAccessToken = async (code: string): Promise<string> => {
    if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
        throw new Error('Google credentials are not configured');
    }

    const response = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
            grant_type: 'authorization_code',
            client_id: GOOGLE_CLIENT_ID,
            client_secret: GOOGLE_CLIENT_SECRET,
            redirect_uri: GOOGLE_REDIRECT_URI,
            code,
        }),
    });

    if (!response.ok) {
        const error = await response.text();
        throw new Error(`Failed to get Google access token: ${error}`);
    }

    const data = await response.json();
    return data.access_token;
};

/**
 * 구글 액세스 토큰으로 사용자 정보를 받아옵니다.
 */
export const getGoogleUserInfo = async (accessToken: string): Promise<{
    id: string;
    email?: string;
    name?: string;
    picture?: string;
}> => {
    const response = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: {
            Authorization: `Bearer ${accessToken}`,
        },
    });

    if (!response.ok) {
        const error = await response.text();
        throw new Error(`Failed to get Google user info: ${error}`);
    }

    const data = await response.json();
    return {
        id: String(data.id),
        email: data.email,
        name: data.name,
        picture: data.picture,
    };
};
