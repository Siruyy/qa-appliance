import { useCallback, useEffect } from "react";
import { invoke } from "@/lib/invoke";
import { useCustomerStore } from "@/stores/customerStore";
import { toast } from "sonner";
import type {
  Customer,
  CustomerDetail,
  CreateCustomerPayload,
  UpdateCustomerPayload,
} from "@/types/customer";
import type { PaginatedResult } from "@/types/shared";

export function useCustomers() {
  const { setCustomers, setLoading, setTotalCount, setPage, filters, page, pageSize } =
    useCustomerStore();

  const fetchCustomers = useCallback(async () => {
    setLoading(true);
    try {
      const { items, total } = await invoke<PaginatedResult<Customer>>(
        "get_customers",
        {
          includeArchived: filters.status !== "active",
          search: filters.search || null,
          limit: pageSize,
          offset: (page - 1) * pageSize,
        }
      );
      setCustomers(items);
      setTotalCount(total);
    } catch (e) {
      toast.error(`Failed to load customers: ${e}`);
    } finally {
      setLoading(false);
    }
  }, [
    filters.search,
    filters.status,
    page,
    pageSize,
    setCustomers,
    setLoading,
    setTotalCount,
  ]);

  useEffect(() => {
    fetchCustomers();
  }, [fetchCustomers]);

  const getCustomerById = useCallback(async (id: number) => {
    return await invoke<CustomerDetail>("get_customer_by_id", { id });
  }, []);

  const createCustomer = useCallback(async (payload: CreateCustomerPayload) => {
    const customer = await invoke<Customer>("create_customer", { payload });
    await fetchCustomers();
    return customer;
  }, [fetchCustomers]);

  const updateCustomer = useCallback(async (payload: UpdateCustomerPayload) => {
    const customer = await invoke<Customer>("update_customer", { payload });
    await fetchCustomers();
    return customer;
  }, [fetchCustomers]);

  const archiveCustomer = useCallback(async (id: number) => {
    await invoke<void>("archive_customer", { id });
    setPage(1);
    await fetchCustomers();
  }, [fetchCustomers, setPage]);

  const restoreCustomer = useCallback(async (id: number) => {
    await invoke<void>("restore_customer", { id });
    setPage(1);
    await fetchCustomers();
  }, [fetchCustomers, setPage]);

  return {
    fetchCustomers,
    getCustomerById,
    createCustomer,
    updateCustomer,
    archiveCustomer,
    restoreCustomer,
  };
}
