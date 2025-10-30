import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import { client } from './api/client';
import { ensureFirebase, observeAuthState } from './firebase/auth';

ensureFirebase();

let latestIdToken: string | null = null;

client.configureAuthTokenProvider(async () => {
  return latestIdToken;
});

observeAuthState(({ idToken }) => {
  latestIdToken = idToken;
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
