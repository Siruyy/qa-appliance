import { useMemo, useState } from "react";

const DEFAULT_PAGE_SIZE = 10;

export function useClientPagination<T>(items: T[], pageSize = DEFAULT_PAGE_SIZE) {
  const [page, setPage] = useState(1);

  const totalPages = Math.ceil(items.length / pageSize);
  const safePageValue = Math.min(page, Math.max(totalPages, 1));

  const paginatedItems = useMemo(
    () => items.slice((safePageValue - 1) * pageSize, safePageValue * pageSize),
    [items, safePageValue, pageSize]
  );

  return {
    page: safePageValue,
    setPage,
    pageSize,
    total: items.length,
    totalPages,
    paginatedItems,
    resetPage: () => setPage(1),
  };
}
