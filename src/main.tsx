import React from 'react';
import ReactDOM from 'react-dom/client';
import { MantineProvider } from '@mantine/core';
import '@mantine/core/styles.css';
import App from './App';
import { mantineTheme } from './ui/mantine-theme';
import './styles.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <MantineProvider theme={mantineTheme} defaultColorScheme="light">
      <App />
    </MantineProvider>
  </React.StrictMode>,
);
