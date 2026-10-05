import { Component } from 'react';

/**
 * Error boundary for heavy visual subtrees (WebGL scenes, Spline embeds).
 * Any render/runtime error in children swaps in `fallback` instead of
 * unmounting the whole app. `onError` lets the parent flip persistent state
 * (e.g. force 2D mode) so re-renders don't retry the crashed tree.
 */
export default class SceneErrorBoundary extends Component {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error) {
    console.error('[landing] visual subtree crashed, showing fallback:', error);
    this.props.onError?.(error);
  }

  render() {
    return this.state.failed ? (this.props.fallback ?? null) : this.props.children;
  }
}
