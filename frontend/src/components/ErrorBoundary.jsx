import { Component } from "react";

// If a page crashes, visitors see a friendly message instead of a blank screen.
export default class ErrorBoundary extends Component {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error) {
    console.error(error);
  }

  render() {
    if (!this.state.failed) return this.props.children;

    return (
      <section className="mx-auto flex min-h-[60vh] max-w-3xl flex-col items-center justify-center px-5 py-24 text-center">
        <h1 className="font-display text-4xl font-extrabold text-brand md:text-5xl">
          Something went wrong
        </h1>
        <p className="mt-4 max-w-md text-lg text-muted">
          This page could not be shown. Please try again.
        </p>
        <button
          type="button"
          onClick={() => window.location.assign("/")}
          className="mt-8 rounded-full bg-brand px-8 py-3 font-bold text-white transition duration-300 hover:-translate-y-1 hover:bg-accent hover:text-brand"
        >
          Back to home
        </button>
      </section>
    );
  }
}