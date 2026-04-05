import { Link } from "react-router-dom";
import { Home } from "lucide-react";

export function NotFoundPage() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
      <p className="text-6xl font-bold text-muted-foreground/30" style={{ fontFamily: "var(--font-heading)" }}>
        404
      </p>
      <h1 className="text-xl font-semibold" style={{ fontFamily: "var(--font-heading)" }}>
        Page Not Found
      </h1>
      <p className="max-w-sm text-sm text-muted-foreground">
        The page you're looking for doesn't exist or has been moved.
      </p>
      <Link
        to="/dashboard"
        className="mt-2 inline-flex items-center gap-2 rounded-md border px-4 py-2 text-sm font-medium transition-colors hover:bg-accent"
      >
        <Home className="h-4 w-4" />
        Back to Dashboard
      </Link>
    </div>
  );
}
