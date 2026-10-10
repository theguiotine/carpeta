import React from 'react';
import ReactDOM from 'react-dom/client';
import App from '@/App.jsx';
import Stage from '@/Stage.jsx';
import Docs from '@/Docs.jsx';
import '@/index.css';

// ?stage (or /stage) opens the big-screen presentation view; the paralegal portal stays the default.
const isStage = new URLSearchParams(window.location.search).has('stage') || window.location.pathname.startsWith('/stage');

const isDocs = new URLSearchParams(window.location.search).has('docs');

ReactDOM.createRoot(document.getElementById('root')).render(isDocs ? <Docs /> : isStage ? <Stage /> : <App />);
