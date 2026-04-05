/** Standard API error shape */
export interface ApiError {
  message: string;
  code?: string;
}

/** Sort direction */
export type SortDirection = 'asc' | 'desc';

/** Pagination metadata with navigation info */
export interface PaginationMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

/** Generic paginated result */
export interface PaginatedResponse<T> {
  data: T[];
  pagination: PaginationMeta;
}

/** Generic filter options */
export interface FilterOptions {
  search: string;
  dateFrom: string;
  dateTo: string;
  sortBy?: string;
  sortDirection?: SortDirection;
}
