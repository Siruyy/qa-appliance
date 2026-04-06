import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";

import { useCustomers } from "@/hooks/useCustomers";
import {
  customerSchema,
  parseCreditLimit,
  type CustomerFormData,
} from "@/lib/validations/customer";
import type { Customer } from "@/types/customer";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

interface Props {
  customer?: Customer;
  onClose: () => void;
}

export function CustomerFormModal({ customer, onClose }: Props) {
  const isEdit = !!customer;
  const { createCustomer, updateCustomer } = useCustomers();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<CustomerFormData>({
    resolver: zodResolver(customerSchema),
    defaultValues: {
      name: customer?.name ?? "",
      phone: customer?.phone ?? "",
      address: customer?.address ?? "",
      notes: customer?.notes ?? "",
      credit_limit: customer?.credit_limit != null ? String(customer.credit_limit) : "",
    },
  });

  const onSubmit = async (data: CustomerFormData) => {
    try {
      const payload = {
        name: data.name,
        phone: data.phone || undefined,
        address: data.address || undefined,
        notes: data.notes || undefined,
        credit_limit: parseCreditLimit(data.credit_limit),
      };

      if (isEdit) {
        await updateCustomer({ id: customer.id, ...payload });
        toast.success("Customer updated");
      } else {
        await createCustomer(payload);
        toast.success("Customer created");
      }
      onClose();
    } catch (error) {
      toast.error(error as string);
    }
  };

  return (
    <Dialog open onOpenChange={() => onClose()}>
      <DialogContent className="max-w-[560px] max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Customer" : "Add Customer"}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Name *</Label>
            <Input id="name" {...register("name")} placeholder="Full name" />
            {errors.name && (
              <p className="text-sm text-destructive">{errors.name.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone">Phone</Label>
            <Input
              id="phone"
              {...register("phone")}
              placeholder="e.g. 09171234567"
            />
            {errors.phone && (
              <p className="text-sm text-destructive">{errors.phone.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="address">Address</Label>
            <Input
              id="address"
              {...register("address")}
              placeholder="Street, City"
            />
            {errors.address && (
              <p className="text-sm text-destructive">
                {errors.address.message}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              {...register("notes")}
              placeholder="Optional notes (e.g. co-maker info)"
              rows={3}
            />
            {errors.notes && (
              <p className="text-sm text-destructive">{errors.notes.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="credit_limit">Credit Limit (₱)</Label>
            <Input
              id="credit_limit"
              type="number"
              min="0"
              step="0.01"
              {...register("credit_limit")}
              placeholder="Leave blank for no limit"
            />
            {errors.credit_limit && (
              <p className="text-sm text-destructive">{errors.credit_limit.message}</p>
            )}
            <p className="text-xs text-muted-foreground">
              Maximum installment balance allowed. Leave blank for unlimited.
            </p>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Saving…" : isEdit ? "Update" : "Add Customer"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
