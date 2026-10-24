import { Component, type ErrorInfo, type ReactNode } from 'react';

type Props = { children: ReactNode };
type State = { failed: boolean };

export class ErrorBoundary extends Component<Props, State> {
  state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('CUT! interface failed to render', error, info.componentStack);
  }

  render(): ReactNode {
    if (this.state.failed) {
      return (
        <main className="fatal" role="alert">
          <p className="eyebrow">CUT! · LOCAL DEVELOPMENT</p>
          <h1>The stage could not load.</h1>
          <p>Check the browser console for the rendering error, then reload the page.</p>
        </main>
      );
    }
    return this.props.children;
  }
}
