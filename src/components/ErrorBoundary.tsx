import { Component, type ReactNode, type ErrorInfo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";

interface Props {
  children: ReactNode;
  fallbackMessage?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("ErrorBoundary caught:", error, info.componentStack);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex items-center justify-center min-h-[60vh] p-6">
          <Card className="max-w-lg w-full">
            <CardHeader className="flex flex-row items-center gap-3">
              <AlertTriangle className="h-6 w-6 text-destructive shrink-0" />
              <CardTitle>
                {this.props.fallbackMessage || "Something went wrong"}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                An unexpected error occurred while rendering this page. You can
                try again or refresh the browser.
              </p>
              {this.state.error && (
                <pre className="rounded-md bg-muted p-3 text-xs overflow-auto max-h-40">
                  {this.state.error.message}
                </pre>
              )}
              <Button onClick={this.handleReset}>Retry</Button>
            </CardContent>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}
