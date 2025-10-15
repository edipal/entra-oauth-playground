"use client";
import {useState} from 'react';
import {Button} from 'primereact/button';

export default function ClientBugPage() {
  const [explode, setExplode] = useState(false);
  if (explode) {
    // Throwing in render will be caught by the error boundary
    throw new Error('Intentional client render error from /[locale]/client-bug');
  }
  return (
    <div style={{padding: 16}}>
      <h2>Client Bug Test</h2>
      <p>Click to trigger a render error.</p>
      <Button label="Trigger client error" icon="pi pi-bolt" severity="danger" onClick={() => setExplode(true)} />
    </div>
  );
}
