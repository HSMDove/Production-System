import { Component, type ReactNode } from "react";

interface Props {
  children: ReactNode;
  fullScreen?: boolean;
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
      const { fullScreen = true } = this.props;

      return (
        <div
          className={fullScreen
            ? "min-h-screen flex flex-col items-center justify-center bg-background gap-4 p-6 text-center"
            : "flex flex-col items-center justify-center gap-4 rounded-[24px] border-[3px] border-border bg-card p-6 text-center shadow-[6px_6px_0_0_rgba(0,0,0,0.88)]"}
          dir="rtl"
        >
          <p className="text-lg font-semibold">حصل خطأ غير متوقع</p>
          <p className="text-sm text-muted-foreground">تم إيقاف هذا الجزء مؤقتاً لحماية تجربة الاستخدام</p>
          <button
            className="px-6 py-2 rounded-lg bg-primary text-primary-foreground font-medium text-sm"
            onClick={() => {
              this.setState({ hasError: false });
            }}
            data-testid="button-error-reload"
          >
            إعادة المحاولة
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
