import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, X, Check } from "lucide-react";

import { useCategories } from "@/hooks/useCategories";
import { useProductStore } from "@/stores/productStore";
import { categorySchema, type CategoryFormData } from "@/lib/validations/product";
import type { Category } from "@/types/product";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type EditingState = { type: "none" } | { type: "add" } | { type: "edit"; category: Category };

export function CategoryManagement() {
  const { createCategory, updateCategory, deleteCategory } = useCategories();
  const categories = useProductStore((s) => s.categories);
  const [editing, setEditing] = useState<EditingState>({ type: "none" });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CategoryFormData>({
    resolver: zodResolver(categorySchema),
  });

  const startAdd = () => {
    reset({ name: "", description: "" });
    setEditing({ type: "add" });
  };

  const startEdit = (category: Category) => {
    reset({ name: category.name, description: category.description ?? "" });
    setEditing({ type: "edit", category });
  };

  const cancel = () => {
    setEditing({ type: "none" });
    reset();
  };

  const onSubmit = async (data: CategoryFormData) => {
    try {
      if (editing.type === "add") {
        await createCategory(data.name, data.description || undefined);
        toast.success("Category created");
      } else if (editing.type === "edit") {
        await updateCategory(editing.category.id, data.name, data.description || undefined);
        toast.success("Category updated");
      }
      cancel();
    } catch (e) {
      toast.error(String(e));
    }
  };

  const handleDelete = async (category: Category) => {
    try {
      await deleteCategory(category.id);
      toast.success(`"${category.name}" deleted`);
    } catch (e) {
      toast.error(String(e));
    }
  };

  const isEditing = editing.type !== "none";

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <CardTitle className="text-base">Categories</CardTitle>
        {!isEditing && (
          <Button size="sm" onClick={startAdd}>
            <Plus className="mr-1 h-4 w-4" />
            Add Category
          </Button>
        )}
      </CardHeader>
      <CardContent>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Description</TableHead>
                <TableHead className="w-24" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {/* Inline add/edit row */}
              {isEditing && (
                <TableRow>
                  <TableCell>
                    <form
                      id="category-form"
                      onSubmit={handleSubmit(onSubmit)}
                      className="space-y-1"
                    >
                      <Input
                        {...register("name")}
                        placeholder="Category name"
                        autoFocus
                      />
                      {errors.name && (
                        <p className="text-xs text-destructive">{errors.name.message}</p>
                      )}
                    </form>
                  </TableCell>
                  <TableCell>
                    <Input
                      {...register("description")}
                      placeholder="Optional description"
                      form="category-form"
                    />
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button
                        type="submit"
                        form="category-form"
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8"
                        disabled={isSubmitting}
                      >
                        <Check className="h-4 w-4 text-green-600" />
                      </Button>
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8"
                        onClick={cancel}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              )}

              {categories.length === 0 && !isEditing && (
                <TableRow>
                  <TableCell colSpan={3} className="text-center text-muted-foreground py-6">
                    No categories yet. Add one to get started.
                  </TableCell>
                </TableRow>
              )}

              {categories.map((cat) => {
                const isBeingEdited = editing.type === "edit" && editing.category.id === cat.id;
                if (isBeingEdited) return null; // shown in the edit row above

                return (
                  <TableRow key={cat.id}>
                    <TableCell className="font-medium">{cat.name}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {cat.description || "—"}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8"
                          onClick={() => startEdit(cat)}
                          disabled={isEditing}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8"
                          onClick={() => handleDelete(cat)}
                          disabled={isEditing}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
