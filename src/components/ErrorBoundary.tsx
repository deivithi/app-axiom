import React from 'react';

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('ErrorBoundary caught:', error, info);
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
          backgroundColor: 'hsl(230, 15%, 12%)',
          color: 'hsl(210, 40%, 98%)',
          padding: '2rem',
          textAlign: 'center',
        }}>
          <h2 style={{ fontSize: '1.5rem', marginBottom: '1rem' }}>Algo deu errado</h2>
          <p style={{ color: 'hsl(215, 20%, 65%)', marginBottom: '1.5rem', maxWidth: '400px' }}>
            {this.state.error?.message || 'Erro inesperado'}
          </p>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            style={{
              padding: '0.75rem 1.5rem',
              backgroundColor: 'hsl(250, 70%, 60%)',
              color: 'white',
              border: 'none',
              borderRadius: '0.5rem',
              cursor: 'pointer',
              fontSize: '1rem',
            }}
          >
            Tentar novamente
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;
