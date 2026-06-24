/** Playwright E2E 기본 로그인 계정 (initialData 시드와 동일) */
export const E2E_TEST_USER_ID = 'user-test-1';

export const E2E_TEST_LOGIN_USERNAME = '푸른별';

export const E2E_TEST_DEFAULT_PASSWORD = '1217';

export const E2E_TEST_NICKNAME = '푸른별';

/** 두 클라이언트 PVP E2E용 상대 계정 */
export const E2E_TEST_USER2_ID = 'user-test-2';

export const E2E_TEST_LOGIN_USERNAME_2 = '노란별';

export const E2E_TEST_NICKNAME_2 = '노란별';

export const E2E_TEST_ACCOUNTS = [
    {
        userId: E2E_TEST_USER_ID,
        loginUsername: E2E_TEST_LOGIN_USERNAME,
        nickname: E2E_TEST_NICKNAME,
    },
    {
        userId: E2E_TEST_USER2_ID,
        loginUsername: E2E_TEST_LOGIN_USERNAME_2,
        nickname: E2E_TEST_NICKNAME_2,
    },
] as const;
