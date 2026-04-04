import { useCallback, useEffect } from "react";
import { invoke } from "@/lib/invoke";
import { useCustomerStore } from "@/stores/customerStore";
import type {
  Customer,
  CustomerDetail,
  CreateCustomerPayload,
  UpdateCustomerPayload,
} from "@/types/customer";

export function useCustomers() {
  const { setCustomers, setLoading } = useCustomerStore();

  const fetchCustomers = useCallback(
    async (includeArchived = false, search?: string) => {
      setLoading(true);
      try {
        const data = await invoke<Customer[]>("get_customers", {
          includeArchived,
          search: search || null,
        });
        setCustomers(data);
      } finally {
        setLoading(false);
      }
    },
    [setCustomers, setLoading]
  );

  useEffect(() => {
    fetchCustomers();
  }, [fetchCustomers]);

  const getCustomerById = async (id: number) => {
    return await invoke<CustomerDetail>("get_customer_by_id", { id });
  };

  const createCustomer = async (payload: CreateCustomerPayload) => {
    const customer = await invoke<Customer>("create_customer", { payload });
    await fetchCustomers();
    return customer;
  };

  const updateCustomer = async (payload: UpdateCustomerPayload) => {
    const customer = await invoke<Customer>("update_customer", { payload });
    await fetchCustomers();
    return customer;
  };

  const archiveCustomer = async (id: number) => {
    await invoke<void>("archive_customer", { id });
    await fetchCustomers();
  };

  const restoreCustomer = async (id: number) => {
    await invoke<void>("restore_customer", { id });
    await fetchCustomers();
  };

  return {
    fetchCustomers,
    getCustomerById,
    createCustomer,
    updateCustomer,
    archiveCustomer,
    restoreCustomer,
  };
}
