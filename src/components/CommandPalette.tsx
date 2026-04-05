import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import {
  Users,
  ShoppingCart,
  Package,
  CreditCard,
  Settings,
  BarChart3,
  LayoutDashboard,
  FileText,
  Plus,
} from "lucide-react";
import { useCustomerStore } from "@/stores/customerStore";
import { useProductStore } from "@/stores/productStore";

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CommandPalette({ open, onOpenChange }: CommandPaletteProps) {
  const navigate = useNavigate();
  const customers = useCustomerStore((s) => s.customers);
  const products = useProductStore((s) => s.products);
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (!open) setSearch("");
  }, [open]);

  const go = (path: string) => {
    navigate(path);
    onOpenChange(false);
  };

  const filteredCustomers = useMemo(
    () =>
      customers
        .filter((c) => c.is_active)
        .slice(0, 8),
    [customers]
  );

  const filteredProducts = useMemo(
    () =>
      products
        .filter((p) => p.is_active)
        .slice(0, 8),
    [products]
  );

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput
        placeholder="Search customers, products, or navigate…"
        value={search}
        onValueChange={setSearch}
      />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>

        <CommandGroup heading="Quick Actions">
          <CommandItem onSelect={() => go("/sales/new")}>
            <Plus className="mr-2 h-4 w-4" />
            New Sale
          </CommandItem>
          <CommandItem onSelect={() => go("/customers")}>
            <Users className="mr-2 h-4 w-4" />
            Add Customer
          </CommandItem>
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="Navigation">
          <CommandItem onSelect={() => go("/")}>
            <LayoutDashboard className="mr-2 h-4 w-4" />
            Dashboard
          </CommandItem>
          <CommandItem onSelect={() => go("/sales")}>
            <ShoppingCart className="mr-2 h-4 w-4" />
            Sales History
          </CommandItem>
          <CommandItem onSelect={() => go("/customers")}>
            <Users className="mr-2 h-4 w-4" />
            Customers
          </CommandItem>
          <CommandItem onSelect={() => go("/inventory")}>
            <Package className="mr-2 h-4 w-4" />
            Inventory
          </CommandItem>
          <CommandItem onSelect={() => go("/accounts")}>
            <CreditCard className="mr-2 h-4 w-4" />
            Accounts
          </CommandItem>
          <CommandItem onSelect={() => go("/payments")}>
            <FileText className="mr-2 h-4 w-4" />
            Payments
          </CommandItem>
          <CommandItem onSelect={() => go("/reports")}>
            <BarChart3 className="mr-2 h-4 w-4" />
            Reports
          </CommandItem>
          <CommandItem onSelect={() => go("/settings")}>
            <Settings className="mr-2 h-4 w-4" />
            Settings
          </CommandItem>
        </CommandGroup>

        {filteredCustomers.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Customers">
              {filteredCustomers.map((c) => (
                <CommandItem
                  key={c.id}
                  value={`customer ${c.name} ${c.phone ?? ""}`}
                  onSelect={() => go(`/customers/${c.id}`)}
                >
                  <Users className="mr-2 h-4 w-4 text-muted-foreground" />
                  <span>{c.name}</span>
                  {c.phone && (
                    <span className="ml-2 text-xs text-muted-foreground">{c.phone}</span>
                  )}
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}

        {filteredProducts.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Products">
              {filteredProducts.map((p) => (
                <CommandItem
                  key={p.id}
                  value={`product ${p.name} ${p.category_name ?? ""}`}
                  onSelect={() => go(`/inventory`)}
                >
                  <Package className="mr-2 h-4 w-4 text-muted-foreground" />
                  <span>{p.name}</span>
                  {p.category_name && (
                    <span className="ml-2 text-xs text-muted-foreground">{p.category_name}</span>
                  )}
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}
      </CommandList>
    </CommandDialog>
  );
}
