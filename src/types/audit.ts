export interface AuditEntry {
  id: number;
  action: string;
  entity_type: string;
  entity_id: number | null;
  details: string | null;
  created_at: string;
}
