/** テスト用: 見本の API(MSW)とログイン済みの状態を用意して、画面を描く。 */
import { render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { setupServer } from 'msw/node';
import type { ReactElement } from 'react';
import { Provider } from 'react-redux';
import { MemoryRouter } from 'react-router';
import { makeStore } from '../src/app/store';
import { AuthContext } from '../src/app/AuthContext';
import { createMockAuth } from '../src/lib/auth';
import { emptyDb, type MockDb } from '../src/mocks/db';
import { createHandlers } from '../src/mocks/handlers';

const BASE = 'http://api.test';
export const db: { current: MockDb } = { current: emptyDb() };
export const server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

export async function renderPage(
  ui: ReactElement,
  { route = '/', email = 'yamada@example.com', data }: { route?: string; email?: string | null; data?: MockDb } = {},
) {
  db.current = data ?? emptyDb();
  server.use(...createHandlers(db.current, BASE));
  const auth = createMockAuth();
  await auth.signOut();
  if (email) await auth.signIn(email, 'x');
  const store = makeStore({ auth, apiBaseUrl: BASE });
  const user = userEvent.setup();
  const view = render(
    <Provider store={store}>
      <AuthContext.Provider value={auth}>
        <MemoryRouter initialEntries={[route]}>{ui}</MemoryRouter>
      </AuthContext.Provider>
    </Provider>,
  );
  return { user, store, auth, ...view };
}
