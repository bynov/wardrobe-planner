import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import { useStore } from './store/store';
import { applyStartupUrl } from './store/startup';
import './styles.css';

const render = () =>
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  );

// The URL the app was opened with may pick the project to show — a design shared in the hash
// (`#p=`/`#j=`), or a `?template=` example — so it is acted on before the first render, and the app
// is rendered either way if that goes wrong.
applyStartupUrl(useStore, window.location, (url) => history.replaceState(null, '', url)).then(render, (e) => {
  console.error('startup URL', e);
  render();
});
