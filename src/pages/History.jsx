import React from 'react';

function History() {
  return (
    <>
      <header className="app-header">
        <h1>Storico</h1>
        <p className="subtitle">I tuoi allenamenti passati</p>
      </header>
      
      <main className="app-main">
        <div className="card">
          <p style={{ color: 'var(--text-muted)' }}>Nessun allenamento registrato ancora.</p>
        </div>
      </main>
    </>
  );
}

export default History;
