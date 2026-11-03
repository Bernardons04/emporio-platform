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

// ── Promotion types ───────────────────────────────────────────────────────────

export interface PromotionProductSummary {
  product_id: number;
  name: string;
  price_brl: string;
  category_id: number;
}

export interface Promotion {
  promotion_id: number;
  product_id: number;
  discount_percent: string;
  description: string | null;
  is_active: boolean;
  product: PromotionProductSummary;
  original_price_brl: string;
  discounted_price_brl: string;
}

export interface PromotionListResponse {
  items: Promotion[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

// ── Promotion API functions ───────────────────────────────────────────────────

export async function listPromotions(params?: {
  search?: string;
  is_active?: boolean;
  page?: number;
  page_size?: number;
}): Promise<PromotionListResponse> {
  const query = new URLSearchParams();
  if (params?.search) query.set('search', params.search);
  if (params?.is_active !== undefined) query.set('is_active', String(params.is_active));
  if (params?.page) query.set('page', String(params.page));
  if (params?.page_size) query.set('page_size', String(params.page_size));
  const qs = query.toString();
  return apiRequest<PromotionListResponse>(`/api/admin/promotions${qs ? `?${qs}` : ''}`);
}

// ── Admin Conversations & Support Tickets types ───────────────────────────────

export interface AdminUserSummary {
  id: string;
  name: string;
  email: string;
  is_admin: boolean;
  customer_id: number | null;
}

export interface AdminMessageEvent {
  id: string;
  event_type: string;
  sequence: number;
  payload: Record<string, unknown>;
  created_at: string;
}

export interface AdminMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
  events: AdminMessageEvent[];
}

export interface AdminConversationSummary {
  id: string;
  user_id: string;
  user: AdminUserSummary;
  title: string | null;
  created_at: string;
  updated_at: string;
  message_count: number;
  last_message: string | null;
  has_support_ticket: boolean;
}

export interface AdminConversationDetail {
  id: string;
  user_id: string;
  user: AdminUserSummary;
  title: string | null;
  created_at: string;
  updated_at: string;
  messages: AdminMessage[];
}

export interface AdminConversationListResponse {
  items: AdminConversationSummary[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export interface AdminSupportTicket {
  id: string;
  protocol: string;
  user_id: string;
  user: AdminUserSummary;
  conversation_id: string;
  reason: string;
  status: 'pending' | 'in_progress' | 'resolved' | 'closed';
  created_at: string;
  updated_at: string;
}

export interface AdminSupportTicketDetail extends AdminSupportTicket {
  conversation: AdminConversationDetail | null;
}

export interface AdminSupportTicketListResponse {
  items: AdminSupportTicket[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

// ── Admin Conversations API functions ─────────────────────────────────────────

export async function listAdminConversations(params?: {
  search?: string;
  page?: number;
  page_size?: number;
}): Promise<AdminConversationListResponse> {
  const query = new URLSearchParams();
  if (params?.search) query.set('search', params.search);
  if (params?.page) query.set('page', String(params.page));
  if (params?.page_size) query.set('page_size', String(params.page_size));
  const qs = query.toString();
  return apiRequest<AdminConversationListResponse>(`/api/admin/conversations${qs ? `?${qs}` : ''}`);
}

export async function getAdminConversation(conversationId: string): Promise<AdminConversationDetail> {
  return apiRequest<AdminConversationDetail>(`/api/admin/conversations/${conversationId}`);
}

// ── Admin Support Tickets API functions ───────────────────────────────────────

export async function listAdminSupportTickets(params?: {
  status?: string;
  search?: string;
  page?: number;
  page_size?: number;
}): Promise<AdminSupportTicketListResponse> {
  const query = new URLSearchParams();
  if (params?.status) query.set('status_filter', params.status);
  if (params?.search) query.set('search', params.search);
  if (params?.page) query.set('page', String(params.page));
  if (params?.page_size) query.set('page_size', String(params.page_size));
  const qs = query.toString();
  return apiRequest<AdminSupportTicketListResponse>(`/api/admin/support-tickets${qs ? `?${qs}` : ''}`);
}

export async function getAdminSupportTicket(ticketId: string): Promise<AdminSupportTicketDetail> {
  return apiRequest<AdminSupportTicketDetail>(`/api/admin/support-tickets/${ticketId}`);
}

export async function updateAdminSupportTicketStatus(
  ticketId: string,
  status: 'pending' | 'in_progress' | 'resolved' | 'closed'
): Promise<AdminSupportTicket> {
  return apiRequest<AdminSupportTicket>(`/api/admin/support-tickets/${ticketId}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  });
}

// ── Customer Chat API types & functions ────────────────────────────────────────

export interface CustomerConversation {
  id: string;
  title: string | null;
  created_at: string;
  updated_at: string;
  message_count: number;
  last_message: string | null;
}

export interface CustomerMessageEvent {
  id: string;
  event_type: string;
  sequence: number;
  payload: Record<string, unknown>;
  created_at: string;
}

export interface CustomerMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  created_at: string;
  events?: CustomerMessageEvent[];
}

export interface SendMessageResponse {
  user_message: CustomerMessage;
  assistant_message: CustomerMessage;
  events: CustomerMessageEvent[];
}

export async function listCustomerConversations(): Promise<CustomerConversation[]> {
  return apiRequest<CustomerConversation[]>('/api/chat/conversations');
}

export async function createCustomerConversation(title?: string): Promise<CustomerConversation> {
  return apiRequest<CustomerConversation>('/api/chat/conversations', {
    method: 'POST',
    body: JSON.stringify(title ? { title } : {}),
  });
}

export async function getCustomerConversationMessages(conversationId: string): Promise<CustomerMessage[]> {
  return apiRequest<CustomerMessage[]>(`/api/chat/conversations/${conversationId}/messages`);
}

export async function sendCustomerMessage(
  conversationId: string,
  content: string
): Promise<SendMessageResponse> {
  return apiRequest<SendMessageResponse>(`/api/chat/conversations/${conversationId}/messages`, {
    method: 'POST',
    body: JSON.stringify({ content }),
  });
}


