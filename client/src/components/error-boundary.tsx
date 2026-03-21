import { Component, type ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error) {
    console.error("[ErrorBoundary]", error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-background gap-4 p-6 text-center" dir="rtl">
          <p className="text-lg font-semibold">حصل خطأ غير متوقع</p>
          <p className="text-sm text-muted-foreground">حاول تحديث الصفحة مرة ثانية</p>
          <button
            className="px-6 py-2 rounded-lg bg-primary text-primary-foreground font-medium text-sm"
            onClick={() => {
              this.setState({ hasError: false });
              window.location.reload();
            }}
            data-testid="button-error-reload"
          >
            تحديث الصفحة
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
