import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { Provider } from 'react-redux'
import { store } from './store/store.ts'

class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { error: Error | null }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('App crash:', error, info);
  }
  render() {
    if (this.state.error) {
      return (
        <div style={{
          background: '#0d0d1a', color: '#f87171', fontFamily: 'monospace',
          padding: '2rem', height: '100vh', whiteSpace: 'pre-wrap'
        }}>
          <h1 style={{ fontSize: '1.5rem', marginBottom: '1rem' }}>⚠️ App Error</h1>
          <p>{this.state.error.message}</p>
          <p style={{ marginTop: '1rem', color: '#94a3b8', fontSize: '0.75rem' }}>
            {this.state.error.stack}
          </p>
        </div>
      );
    }
    return this.props.children;
  }
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <Provider store={store}>
        <App />
      </Provider>
    </ErrorBoundary>
  </React.StrictMode>,
)
