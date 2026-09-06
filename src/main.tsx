import React, { Component, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.tsx';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Uncaught React Error:', error, errorInfo);
    this.setState({ errorInfo });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          padding: '2rem',
          color: '#ff6b6b',
          background: '#1a1816',
          fontFamily: 'monospace',
          height: '100vh',
          overflowY: 'auto'
        }}>
          <h2>React Runtime Render Error</h2>
          <pre style={{ background: '#26221f', padding: '1rem', borderRadius: '8px', color: '#f5f3ec', whiteSpace: 'pre-wrap' }}>
            {this.state.error?.toString()}
          </pre>
          <details style={{ marginTop: '1rem', color: '#b9b4a4' }}>
            <summary>Stack Trace</summary>
            <pre style={{ fontSize: '0.8rem', marginTop: '0.5rem', whiteSpace: 'pre-wrap' }}>
              {this.state.errorInfo?.componentStack || this.state.error?.stack}
            </pre>
          </details>
          <button 
            onClick={() => { localStorage.clear(); window.location.reload(); }}
            style={{ marginTop: '1.5rem', padding: '0.75rem 1.5rem', background: '#da7756', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer' }}
          >
            Clear Local Storage & Reload
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

// Global window error catcher
window.addEventListener('error', (event) => {
  console.error('Global Error Event:', event.error || event.message);
});

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);
