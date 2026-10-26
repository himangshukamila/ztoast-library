import { Component } from "react";
import type { ErrorInfo, ReactNode } from "react";

export class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.log("[playground] Rendering failed", { error, componentStack: info.componentStack });
    if (window.parent !== window) {
      window.parent.postMessage({ source: "ztoast-preview", action: "error" }, window.location.origin);
    }
  }

  render() {
    if (this.state.failed) {
      return (
        <main className="failure" role="alert">
          <h1>The playground could not render.</h1>
          <p>Check the browser console for details, then reload to try again.</p>
          <button type="button" onClick={() => window.location.reload()}>Reload playground</button>
        </main>
      );
    }
    return this.props.children;
  }
}
