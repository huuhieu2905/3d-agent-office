import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import './styles.css';
import { socket } from './api/ws';
import { useConnection } from './state/connection';
import { useEmployees } from './state/employees';

// Route server messages into stores once, outside React.
socket.on((m) => {
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
    case 'employees.patch':
      useEmployees.getState().patch(m.payload.upserted, m.payload.removed, m.payload.overflow);
      break;
    default:
      break;
  }
});
socket.onOpenChange((open) => useConnection.getState().setServerOnline(open));
socket.connect();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
