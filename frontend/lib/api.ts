export interface User {
  id: string;
  name: string;
  email: string;
  is_admin: boolean;
  customer_id: number | null;
  created_at: string;
}

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`;

  const headers = new Headers(options.headers || {});
  if (!headers.has('Content-Type') && options.body && typeof options.body === 'string') {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(url, {
    ...options,
    headers,
    credentials: 'include', // essential for HttpOnly session cookie transmission
  });

  if (!response.ok) {
    let errorDetail = 'An error occurred';
    try {
      const errorData = await response.json();
      errorDetail = errorData.detail || errorDetail;
    } catch {
      errorDetail = response.statusText || errorDetail;
    }
    throw new Error(errorDetail);
  }

  // 204 No Content — return undefined cast to T
  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}

export async function getCurrentUser(): Promise<User | null> {
  try {
    return await apiRequest<User>('/api/auth/me');
  } catch {
    return null;
  }
}

export async function logoutUser(): Promise<void> {
  await apiRequest<{ message: string }>('/api/auth/logout', {
    method: 'POST',
    body: JSON.stringify({}),
  });
}

// ── Product types ─────────────────────────────────────────────────────────────

export interface Category {
  category_id: number;
  name: string;
  description: string | null;
}

export interface Product {
  product_id: number;
  name: string;
  category_id: number;
  category: Category;
  description: string | null;
  price_brl: string; // Decimal serialized as string
  stock_quantity: number;
  status: 'active' | 'inactive' | 'discontinued';
  specs: Record<string, unknown> | null;
  created_at: string | null;
}

export interface ProductListResponse {
  items: Product[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export interface ProductCreate {
  name: string;
  category_id: number;
  description?: string | null;
  price_brl: string;
  stock_quantity: number;
  status: 'active' | 'inactive' | 'discontinued';
  specs?: Record<string, unknown> | null;
}

export interface ProductUpdate {
  name?: string;
  category_id?: number;
  description?: string | null;
  price_brl?: string;
  stock_quantity?: number;
  status?: 'active' | 'inactive' | 'discontinued';
  specs?: Record<string, unknown> | null;
}

// ── Product API functions ─────────────────────────────────────────────────────

export async function listCategories(): Promise<Category[]> {
  return apiRequest<Category[]>('/api/admin/products/categories');
}

export async function listProducts(params?: {
  search?: string;
  category_id?: number;
  status?: 'active' | 'inactive' | 'discontinued';
  page?: number;
  page_size?: number;
}): Promise<ProductListResponse> {
  const query = new URLSearchParams();
  if (params?.search) query.set('search', params.search);
  if (params?.category_id != null) query.set('category_id', String(params.category_id));
  if (params?.status) query.set('status', params.status);
  if (params?.page) query.set('page', String(params.page));
  if (params?.page_size) query.set('page_size', String(params.page_size));
  const qs = query.toString();
  return apiRequest<ProductListResponse>(`/api/admin/products${qs ? `?${qs}` : ''}`);
}

export async function getProduct(productId: number): Promise<Product> {
  return apiRequest<Product>(`/api/admin/products/${productId}`);
}

export async function createProduct(data: ProductCreate): Promise<Product> {
  return apiRequest<Product>('/api/admin/products', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateProduct(productId: number, data: ProductUpdate): Promise<Product> {
  return apiRequest<Product>(`/api/admin/products/${productId}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export async function deleteProduct(productId: number): Promise<void> {
  await apiRequest<void>(`/api/admin/products/${productId}`, {
    method: 'DELETE',
  });
}
