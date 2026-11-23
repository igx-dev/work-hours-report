import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Provider } from 'react-redux';
import { BrowserRouter } from 'react-router';
import { App } from './app/App';
import { AuthContext } from './app/AuthContext';
import { makeStore } from './app/store';
import { config } from './config';
import { createMockAuth, type Auth } from './lib/auth';
import './styles.css';

async function start() {
  let auth: Auth;
  if (config.mock) {
    // 見本モード: AWS につながず、ブラウザの中の見本データ(MSW)で動かす
    const { setupWorker } = await import('msw/browser');
    const { createHandlers } = await import('./mocks/handlers');
    const { sampleDb } = await import('./mocks/db');
    await setupWorker(...createHandlers(sampleDb(), config.apiBaseUrl)).start({ onUnhandledRequest: 'bypass', quiet: true });
    auth = createMockAuth();
  } else {
    const { createCognitoAuth } = await import('./lib/cognitoAuth');
    auth = createCognitoAuth();
  }

  const store = makeStore({ auth, apiBaseUrl: config.apiBaseUrl });
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <Provider store={store}>
        <AuthContext.Provider value={auth}>
          <BrowserRouter>
            <App />
          </BrowserRouter>
        </AuthContext.Provider>
      </Provider>
    </StrictMode>,
  );
}

start();
