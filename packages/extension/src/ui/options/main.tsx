import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource-variable/inter';
import '@fontsource/jetbrains-mono';
import '../styles/app.css';
import { Options } from './Options';
import { applyThemeFromOS } from '../theme';

applyThemeFromOS(document.documentElement);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Options />
  </StrictMode>,
);
