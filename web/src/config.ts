/** ビルドの時に決まる設定(.env や CI の変数から入る)。 */
export const config = {
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL ?? '/api',
  userPoolId: import.meta.env.VITE_COGNITO_USER_POOL_ID ?? '',
  userPoolClientId: import.meta.env.VITE_COGNITO_CLIENT_ID ?? '',
  /** true なら AWS につながず、ブラウザの中の見本データで動かす */
  mock: import.meta.env.MODE === 'mock',
};
