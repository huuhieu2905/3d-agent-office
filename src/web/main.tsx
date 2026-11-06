import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { Bench } from './bench/Bench';
import './styles.css';
import { socket } from './api/ws';
import { useConnection } from './state/connection';
import { useEmployees } from './state/employees';
import { useSteps } from './state/steps';
import { useQuota } from './state/quota';

// Route server messages into stores once, outside React.
const isBench = location.pathname === '/bench';

if (!isBench) socket.on((m) => {
  switch (m.type) {
    case 'connection':
      useConnection.getState().setApp(m.payload);
      break;
    case 'warning':
      useConnection.getState().addWarning(m.payload);
      break;
    case 'employees.snapshot':
      useEmployees.getState().snapshot(m.payload.employees, m.payload.overflow);
      break;
    case 'quota':
      useQuota.getState().set(m.payload);
      break;
    case 'steps.append':
      useSteps.getState().merge(m.payload.conversationId, m.payload.steps);
      break;
    case 'employees.patch':
      useEmployees.getState().patch(m.payload.upserted, m.payload.removed, m.payload.overflow);
      break;
    default:
      break;
  }
});
if (!isBench) {
  socket.onOpenChange((open) => useConnection.getState().setServerOnline(open));
  socket.connect();
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {isBench ? <Bench /> : <App />}
  </StrictMode>,
);
