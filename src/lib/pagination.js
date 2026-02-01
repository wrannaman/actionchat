/**
 * Pagination Detection & Utilities
 *
 * Detects pagination patterns from API responses and extracts
 * the metadata needed to fetch subsequent pages.
 */

/**
 * Common pagination patterns across APIs:
 *
 * 1. Stripe-style (cursor-based):
 *    { data: [...], has_more: true, object: "list" }
 *    Next page: ?starting_after=last_item_id
 *
 * 2. Offset-based:
 *    { results: [...], total: 100, page: 1, per_page: 10 }
 *    Next page: ?page=2 or ?offset=10
 *
 * 3. Cursor-based (generic):
 *    { items: [...], next_cursor: "abc123", has_more: true }
 *    Next page: ?cursor=abc123
 *
 * 4. Link-based (REST/HATEOAS):
 *    { data: [...], links: { next: "/api/users?page=2" } }
 *    Next page: follow links.next
 *
 * 5. Token-based (Google-style):
 *    { items: [...], nextPageToken: "token123" }
 *    Next page: ?pageToken=token123
 */

/**
 * Detect pagination info from an API response
 * @param {object} response - The API response body
 * @param {object} originalInput - The original tool input params
 * @returns {object|null} Pagination metadata or null if not paginated
 */
export function detectPagination(response, originalInput = {}) {
  if (!response || typeof response !== 'object') return null;

  // Extract the data array (try common field names)
  const dataArray = extractDataArray(response);
  if (!dataArray || dataArray.length === 0) return null;

  // Try each detection strategy
  const strategies = [
    detectStripePagination,
    detectCursorPagination,
    detectOffsetPagination,
    detectLinkPagination,
    detectTokenPagination,
    detectRawArrayPagination, // Fallback for APIs that just return arrays
  ];

  for (const detect of strategies) {
    const result = detect(response, dataArray, originalInput);
    if (result) {
      return {
        ...result,
        itemCount: dataArray.length,
        dataPath: findDataPath(response, dataArray),
      };
    }
  }

  return null;
}

/**
 * Extract the main data array from a response
 */
function extractDataArray(response) {
  // Direct array
  if (Array.isArray(response)) return response;

  // Common wrapper fields
  const arrayFields = ['data', 'results', 'items', 'records', 'entries', 'list', 'rows', 'objects'];
  for (const field of arrayFields) {
    if (Array.isArray(response[field])) {
      return response[field];
    }
  }

  // Nested in a response wrapper
  if (response.response && typeof response.response === 'object') {
    return extractDataArray(response.response);
  }

  return null;
}

/**
 * Find the path to the data array in the response
 */
function findDataPath(response, targetArray) {
  if (Array.isArray(response)) return '';

  const arrayFields = ['data', 'results', 'items', 'records', 'entries', 'list', 'rows', 'objects'];
  for (const field of arrayFields) {
    if (response[field] === targetArray) return field;
  }

  return 'data'; // default
}

/**
 * Stripe-style pagination
 * { data: [...], has_more: true, object: "list" }
 */
function detectStripePagination(response, dataArray, originalInput) {
  if (response.has_more === undefined) return null;
  if (response.object !== 'list' && !response.has_more) return null;

  const lastItem = dataArray[dataArray.length - 1];
  const lastId = lastItem?.id;

  return {
    type: 'stripe',
    hasMore: response.has_more === true,
    totalCount: response.total_count ?? null,
    cursor: lastId,
    nextParams: response.has_more ? { starting_after: lastId } : null,
    // Also track limit if present
    limit: originalInput.limit || dataArray.length,
  };
}

/**
 * Generic cursor-based pagination
 * { items: [...], next_cursor: "abc", has_more: true }
 */
function detectCursorPagination(response, dataArray, originalInput) {
  const cursorFields = ['next_cursor', 'cursor', 'nextCursor', 'next'];
  const hasMoreFields = ['has_more', 'hasMore', 'has_next', 'hasNext'];

  let cursor = null;
  let cursorParam = 'cursor';

  for (const field of cursorFields) {
    if (response[field] && typeof response[field] === 'string') {
      cursor = response[field];
      cursorParam = field === 'next_cursor' ? 'cursor' : field;
      break;
    }
  }

  if (!cursor) return null;

  let hasMore = true;
  for (const field of hasMoreFields) {
    if (response[field] !== undefined) {
      hasMore = response[field] === true;
      break;
    }
  }

  return {
    type: 'cursor',
    hasMore,
    totalCount: response.total ?? response.total_count ?? response.totalCount ?? null,
    cursor,
    nextParams: hasMore ? { [cursorParam]: cursor } : null,
    limit: originalInput.limit || originalInput.per_page || dataArray.length,
  };
}

/**
 * Offset-based pagination
 * { results: [...], total: 100, page: 1, per_page: 10 }
 */
function detectOffsetPagination(response, dataArray, originalInput) {
  const pageFields = ['page', 'current_page', 'currentPage', 'pageNumber'];
  const totalFields = ['total', 'total_count', 'totalCount', 'count'];
  const perPageFields = ['per_page', 'perPage', 'page_size', 'pageSize', 'limit'];

  let currentPage = null;
  let pageParam = 'page';
  for (const field of pageFields) {
    if (typeof response[field] === 'number') {
      currentPage = response[field];
      pageParam = field;
      break;
    }
  }

  // Also check input for page
  if (currentPage === null) {
    for (const field of pageFields) {
      if (typeof originalInput[field] === 'number') {
        currentPage = originalInput[field];
        pageParam = field;
        break;
      }
    }
  }

  let total = null;
  for (const field of totalFields) {
    if (typeof response[field] === 'number') {
      total = response[field];
      break;
    }
  }

  let perPage = dataArray.length;
  for (const field of perPageFields) {
    if (typeof response[field] === 'number') {
      perPage = response[field];
      break;
    } else if (typeof originalInput[field] === 'number') {
      perPage = originalInput[field];
      break;
    }
  }

  // Need at least page or total to detect offset pagination
  if (currentPage === null && total === null) return null;

  currentPage = currentPage || 1;
  const totalPages = total ? Math.ceil(total / perPage) : null;
  const hasMore = totalPages ? currentPage < totalPages : dataArray.length === perPage;

  return {
    type: 'offset',
    hasMore,
    totalCount: total,
    currentPage,
    totalPages,
    perPage,
    nextParams: hasMore ? { [pageParam]: currentPage + 1 } : null,
    limit: perPage,
  };
}

/**
 * Link-based pagination (HATEOAS)
 * { data: [...], links: { next: "/api/users?page=2" } }
 */
function detectLinkPagination(response, dataArray, originalInput) {
  const links = response.links || response._links || response.paging;
  if (!links || typeof links !== 'object') return null;

  const nextLink = links.next || links.nextLink || links.next_page;
  if (!nextLink) return null;

  // Parse URL params from link
  let nextParams = null;
  try {
    const url = new URL(nextLink, 'http://dummy');
    nextParams = Object.fromEntries(url.searchParams.entries());
  } catch {
    // If not a valid URL, might be just params
    nextParams = { _next_link: nextLink };
  }

  return {
    type: 'link',
    hasMore: !!nextLink,
    totalCount: response.total ?? response.total_count ?? null,
    nextLink,
    nextParams,
    limit: originalInput.limit || dataArray.length,
  };
}

/**
 * Token-based pagination (Google-style)
 * { items: [...], nextPageToken: "token123" }
 */
function detectTokenPagination(response, dataArray, originalInput) {
  const tokenFields = ['nextPageToken', 'next_page_token', 'pageToken', 'continuation_token', 'continuationToken'];

  let token = null;
  let tokenParam = 'pageToken';

  for (const field of tokenFields) {
    if (response[field] && typeof response[field] === 'string') {
      token = response[field];
      // Map response field to likely param name
      tokenParam = field.includes('continuation') ? 'continuationToken' : 'pageToken';
      break;
    }
  }

  if (!token) return null;

  return {
    type: 'token',
    hasMore: true,
    totalCount: response.totalItems ?? response.total ?? null,
    cursor: token,
    nextParams: { [tokenParam]: token },
    limit: originalInput.limit || originalInput.maxResults || dataArray.length,
  };
}

/**
 * Raw array pagination (fallback for APIs that strip metadata)
 * Detects pagination when:
 * - Response is just an array
 * - Input had a limit param
 * - Array length equals the limit (suggesting more data exists)
 */
function detectRawArrayPagination(response, dataArray, originalInput) {
  // Only trigger if we have a limit in the input
  const limitFields = ['limit', 'per_page', 'perPage', 'page_size', 'pageSize', 'count', 'max_results', 'maxResults'];
  let limit = null;
  let limitParam = 'limit';

  for (const field of limitFields) {
    if (typeof originalInput[field] === 'number' && originalInput[field] > 0) {
      limit = originalInput[field];
      limitParam = field;
      break;
    }
  }

  // No limit param = can't paginate
  if (!limit) return null;

  // If we got fewer items than the limit, we've reached the end
  if (dataArray.length < limit) return null;

  // Try to find an ID in the last item for cursor-based pagination
  const lastItem = dataArray[dataArray.length - 1];
  let cursor = null;
  let cursorParam = 'starting_after'; // Stripe-style default

  if (lastItem && typeof lastItem === 'object') {
    // Try common ID field names
    cursor = lastItem.id || lastItem._id || lastItem.uuid || lastItem.cursor;
  }

  // If no ID found, we can't cursor-paginate
  if (!cursor) return null;

  return {
    type: 'raw-array',
    hasMore: true, // Assume there's more since we hit the limit
    totalCount: null, // Unknown
    cursor,
    cursorParam,
    nextParams: { [cursorParam]: cursor },
    limit,
    limitParam,
  };
}

/**
 * Build the params for fetching the next page
 * @param {object} pagination - Pagination metadata from detectPagination
 * @param {object} originalInput - Original tool input params
 * @returns {object} Merged params for next page request
 */
export function buildNextPageParams(pagination, originalInput = {}) {
  if (!pagination?.nextParams) return null;

  // Start with original params
  const params = { ...originalInput };

  // Remove old cursor/page params that might conflict
  const cursorParams = ['starting_after', 'cursor', 'page', 'offset', 'pageToken', 'next_cursor'];
  for (const param of cursorParams) {
    delete params[param];
  }

  // Merge in next page params
  return { ...params, ...pagination.nextParams };
}

/**
 * Build params for a specific page (for offset pagination)
 * @param {object} pagination - Pagination metadata
 * @param {number} pageNumber - Target page number (1-indexed)
 * @param {object} originalInput - Original tool input params
 * @returns {object} Params for the specific page
 */
export function buildPageParams(pagination, pageNumber, originalInput = {}) {
  if (pagination.type !== 'offset') {
    throw new Error('buildPageParams only works with offset pagination');
  }

  const params = { ...originalInput };

  // Find the page param name used
  const pageParam = Object.keys(pagination.nextParams || {}).find(k =>
    ['page', 'current_page', 'currentPage', 'pageNumber'].includes(k)
  ) || 'page';

  params[pageParam] = pageNumber;
  return params;
}

/**
 * Calculate pagination display info
 * @param {object} pagination - Pagination metadata
 * @param {number} currentPageItems - Number of items on current page
 * @param {number} loadedPages - Number of pages already loaded
 * @returns {object} Display info
 */
export function getPaginationDisplayInfo(pagination, currentPageItems, loadedPages = 1) {
  if (!pagination) return null;

  const totalLoaded = currentPageItems; // Will be calculated by caller with all pages

  let display = {
    hasMore: pagination.hasMore,
    type: pagination.type,
  };

  if (pagination.totalCount) {
    display.totalCount = pagination.totalCount;
    display.text = `${totalLoaded} of ${pagination.totalCount}`;
    display.percentage = Math.round((totalLoaded / pagination.totalCount) * 100);
  } else {
    display.text = pagination.hasMore ? `${totalLoaded}+ results` : `${totalLoaded} results`;
  }

  if (pagination.type === 'offset' && pagination.totalPages) {
    display.currentPage = pagination.currentPage;
    display.totalPages = pagination.totalPages;
    display.pageText = `Page ${pagination.currentPage} of ${pagination.totalPages}`;
  }

  return display;
}
