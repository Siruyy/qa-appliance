import { useParams } from "react-router-dom";

export function AccountDetailPage() {
  const { id } = useParams<{ id: string }>();

  return (
    <div>
      <p className="text-muted-foreground">
        Account detail view for account #{id}.
      </p>
    </div>
  );
}
