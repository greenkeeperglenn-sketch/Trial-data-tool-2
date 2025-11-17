import React from 'react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, info: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    this.setState({ error, info });
    // eslint-disable-next-line no-console
    console.error('[ErrorBoundary] Caught error:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-4 bg-red-50 border border-red-200 rounded">
          <h3 className="text-red-800 font-bold">An error occurred while loading this component</h3>
          <pre className="text-xs text-red-700 mt-2 whitespace-pre-wrap">{String(this.state.error)}</pre>
          <details className="text-xs mt-2 text-gray-700">
            <summary className="cursor-pointer">Show stack</summary>
            <pre className="text-xs text-gray-700 mt-2">{this.state.info?.componentStack}</pre>
          </details>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
