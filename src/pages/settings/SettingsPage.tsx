import { CategoryManagement } from "./CategoryManagement";

export function SettingsPage() {
  return (
    <div className="space-y-6">
      <p className="text-muted-foreground">
        Interest rates, penalty rates, default terms, and app configuration.
      </p>

      {/* Category Management */}
      <CategoryManagement />
    </div>
  );
}
