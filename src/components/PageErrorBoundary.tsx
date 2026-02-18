import React from 'react';

interface PageErrorBoundaryProps {
  children: React.ReactNode;
  pageName: string;
}

interface PageErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class PageErrorBoundary extends React.Component<PageErrorBoundaryProps, PageErrorBoundaryState> {
  constructor(props: PageErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): PageErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error(`[${this.props.pageName}] ErrorBoundary caught:`, error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '2rem',
          textAlign: 'center',
        }}>
          <div style={{
            maxWidth: '500px',
            padding: '2rem',
            borderRadius: '1rem',
            border: '2px solid hsl(0, 72%, 50%)',
            backgroundColor: 'hsl(0, 72%, 50%, 0.05)',
          }}>
            <h2 style={{ fontSize: '1.25rem', marginBottom: '0.75rem', color: 'hsl(0, 72%, 50%)' }}>
              Erro em {this.props.pageName}
            </h2>
            <p style={{ fontSize: '0.875rem', marginBottom: '1rem', opacity: 0.7 }}>
              {this.state.error?.message || 'Erro inesperado'}
            </p>
            <details style={{ marginBottom: '1rem', textAlign: 'left', fontSize: '0.75rem', opacity: 0.5 }}>
              <summary style={{ cursor: 'pointer' }}>Stack trace</summary>
              <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all', marginTop: '0.5rem' }}>
                {this.state.error?.stack}
              </pre>
            </details>
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
              <button
                onClick={() => this.setState({ hasError: false, error: null })}
                style={{
                  padding: '0.5rem 1.25rem',
                  borderRadius: '0.5rem',
                  border: '1px solid hsl(var(--border, 220 13% 26%))',
                  background: 'transparent',
                  cursor: 'pointer',
                  fontSize: '0.875rem',
                }}
              >
                Tentar novamente
              </button>
              <button
                onClick={() => window.location.href = '/'}
                style={{
                  padding: '0.5rem 1.25rem',
                  borderRadius: '0.5rem',
                  border: 'none',
                  background: 'hsl(250, 70%, 60%)',
                  color: 'white',
                  cursor: 'pointer',
                  fontSize: '0.875rem',
                }}
              >
                Voltar ao início
              </button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default PageErrorBoundary;
