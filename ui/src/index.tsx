import React from 'react';
import ReactDOM from 'react-dom';
import './i18n';
import * as Sentry from '@sentry/react';
import { BrowserTracing } from '@sentry/tracing';
import App from './components/App';
import { AuthProvider } from './context/AuthContext';
import { AppProvider } from './context/AppContext/AppContext';
import './index.css';
import reportWebVitals from './reportWebVitals';
import { HelmetProvider } from 'react-helmet-async';
import { ProjectProvider } from './context/ProjectContext';

Sentry.init({
  dsn: process.env.REACT_APP_SENTRY_API,
  integrations: [new BrowserTracing()],

  // Set tracesSampleRate to 1.0 to capture 100%
  // of transactions for performance monitoring.
  // We recommend adjusting this value in production
  tracesSampleRate: 1.0
});

ReactDOM.render(
  <React.StrictMode>
    <HelmetProvider>
      <AuthProvider>
        <AppProvider>
          <ProjectProvider>
            <App />
          </ProjectProvider>
        </AppProvider>
      </AuthProvider>
    </HelmetProvider>
  </React.StrictMode>,
  document.getElementById('root')
);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();
