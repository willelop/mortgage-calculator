import React from 'react';

type Props = { children: React.ReactNode };
type State = { error: Error | null };

/**
 * Catches render exceptions and shows a recoverable card instead of a blank
 * page (roadmap #17). "Reload" re-mounts the app with state intact (autosave
 * restores the session); "Reset & reload" additionally clears the app's
 * localStorage entries for the case where the persisted state itself
 * triggers the crash.
 */
export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // keep the reason visible in the console for bug reports
    console.error('App crashed:', error, info.componentStack);
  }

  private reload = () => window.location.reload();

  private resetAndReload = () => {
    try {
      Object.keys(localStorage)
        .filter((k) => k.startsWith('buyvsrent'))
        .forEach((k) => localStorage.removeItem(k));
    } catch {
      // storage blocked — a plain reload is still the best we can do
    }
    window.location.reload();
  };

  render() {
    if (!this.state.error) return this.props.children;
    const de = (navigator.language || 'en').toLowerCase().startsWith('de');
    return (
      <div className="card error-boundary" role="alert" style={{ maxWidth: 560, margin: '18vh auto' }}>
        <h2 style={{ marginTop: 0 }}>{de ? 'Etwas ist schiefgelaufen' : 'Something went wrong'}</h2>
        <p className="muted">
          {de
            ? 'Die Oberfläche hat einen Fehler ausgelöst. Deine Eingaben bleiben lokal gespeichert.'
            : 'The interface hit an error. Your inputs are still saved locally.'}
        </p>
        <p className="muted" style={{ fontSize: '0.8rem', wordBreak: 'break-word' }}>
          {String(this.state.error.message || this.state.error)}
        </p>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button type="button" onClick={this.reload}>
            {de ? 'Neu laden' : 'Reload'}
          </button>
          <button type="button" onClick={this.resetAndReload}>
            {de ? 'Zurücksetzen & neu laden' : 'Reset parameters & reload'}
          </button>
        </div>
      </div>
    );
  }
}
