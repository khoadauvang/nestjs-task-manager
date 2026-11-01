export interface PaginationMeta {
  page: number;
  limit: number;
  totalItems: number;
  totalPages: number;
}

/**
 * Returned by list endpoints. TransformResponseInterceptor turns it into
 * `{ data: items, meta }`.
 */
export class Paginated<T> {
  constructor(
    readonly items: T[],
    readonly meta: PaginationMeta,
  ) {}

  static of<T>(
    items: T[],
    totalItems: number,
    { page, limit }: { page: number; limit: number },
  ): Paginated<T> {
    return new Paginated(items, {
      page,
      limit,
      totalItems,
      totalPages: Math.ceil(totalItems / limit),
    });
  }
}
