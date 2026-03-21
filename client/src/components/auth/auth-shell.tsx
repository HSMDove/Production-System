import type { ReactNode } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type AuthShellProps = {
  eyebrow: string;
  title: string;
  description: string;
  panelTitle: string;
  panelDescription: string;
  icon: ReactNode;
  highlights: string[];
  children: ReactNode;
  footer?: ReactNode;
};

export function AuthShell({
  eyebrow,
  title,
  description,
  panelTitle,
  panelDescription,
  icon,
  highlights,
  children,
  footer,
}: AuthShellProps) {
  return (
    <div dir="rtl" className="auth-stage">
      <div className="auth-shell-grid">
        <Card className="auth-form-panel">
          <CardHeader className="space-y-3 pb-4 md:pb-5">
            <CardTitle>{panelTitle}</CardTitle>
            <CardDescription>{panelDescription}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {children}
          </CardContent>
        </Card>

        <section className="auth-hero-panel">
          <div className="auth-icon-badge">{icon}</div>
          <span className="nb-kicker">{eyebrow}</span>
          <h1 className="auth-title">{title}</h1>
          {description ? <p className="auth-description">{description}</p> : null}

          {highlights.length > 0 ? (
            <div className="auth-highlight-grid">
              {highlights.map((item) => (
                <div key={item} className="auth-highlight-card">
                  <span className="auth-highlight-dot" aria-hidden="true" />
                  <span>{item}</span>
                </div>
              ))}
            </div>
          ) : null}
        </section>
      </div>

      {footer && <div className="auth-footer">{footer}</div>}
    </div>
  );
}
