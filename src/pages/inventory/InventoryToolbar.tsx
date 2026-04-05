import { Search, Archive } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import type { Category } from "@/types/product";

type StatusFilter = "all" | "active" | "archived";

interface Filters {
  search: string;
  categoryId: number | null;
  status: StatusFilter;
}

interface InventoryToolbarProps {
  filters: Filters;
  categories: Category[];
  selectedCount: number;
  onFilterChange: <K extends keyof Filters>(key: K, value: Filters[K]) => void;
  onBulkArchive: () => void;
  onClearSelection: () => void;
}

export function InventoryToolbar({
  filters,
  categories,
  selectedCount,
  onFilterChange,
  onBulkArchive,
  onClearSelection,
}: InventoryToolbarProps) {
  return (
    <>
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search products, SKU…"
            className="pl-9"
            value={filters.search}
            onChange={(e) => onFilterChange("search", e.target.value)}
          />
        </div>

        <Select
          value={filters.categoryId?.toString() ?? "all"}
          onValueChange={(v) =>
            onFilterChange("categoryId", v === "all" ? null : Number(v))
          }
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="All Categories" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {categories.map((c) => (
              <SelectItem key={c.id} value={c.id.toString()}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={filters.status}
          onValueChange={(v) =>
            onFilterChange("status", v as StatusFilter)
          }
        >
          <SelectTrigger className="w-[140px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="archived">Archived</SelectItem>
            <SelectItem value="all">All</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Bulk Action Bar */}
      {selectedCount > 0 && (
        <div className="flex items-center gap-3 rounded-md border bg-muted/50 p-2">
          <span className="text-sm font-medium">{selectedCount} selected</span>
          <Button
            variant="destructive"
            size="sm"
            onClick={onBulkArchive}
          >
            <Archive className="mr-1 h-4 w-4" />
            Archive Selected
          </Button>
          <Button variant="ghost" size="sm" onClick={onClearSelection}>
            Clear
          </Button>
        </div>
      )}
    </>
  );
}
