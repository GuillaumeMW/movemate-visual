import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { AnimatedToaster } from '@/components/ui/animated-toaster';

createRoot(document.getElementById("root")!).render(
  <>
    <App />
    <AnimatedToaster />
  </>
);
