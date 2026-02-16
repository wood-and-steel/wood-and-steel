import React from 'react';
import ReactDOM from 'react-dom/client';
import './shared/styles/index.css';
import App from './app/App';
import reportWebVitals from './config/reportWebVitals';

const root = ReactDOM.createRoot(document.getElementById('root')!);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

reportWebVitals();
