import { apiClient } from '../kernel/client';
import { ItemDetail, ItemPublic } from '../kernel/types';

export interface GetItemsParams {
  category?: string;
  status?: string;
  search?: string;
  limit?: number;
  offset?: number;
}

export interface ReportFoundData {
  category: string;
  public_description: string;
  found_location_public: string;
  found_date: string;
  hidden_description?: string;
  hidden_attributes?: Record<string, any>;
}

export interface ReportLostData {
  category: string;
  description: string;
  lost_location: string;
  lost_date: string;
  attributes?: Record<string, any>;
}

export const itemsService = {
  async getItems(params?: GetItemsParams): Promise<ItemPublic[]> {
    const query = new URLSearchParams();
    if (params?.category) query.append('category', params.category);
    if (params?.status) query.append('status', params.status);
    if (params?.search) query.append('search', params.search);
    if (params?.limit) query.append('limit', params.limit.toString());
    if (params?.offset) query.append('offset', params.offset.toString());

    const qs = query.toString();
    const res = await apiClient.get<{ items: ItemPublic[] }>(`/items${qs ? `?${qs}` : ''}`);
    return res.items || [];
  },

  async getItem(id: string): Promise<ItemDetail> {
    const res = await apiClient.get<{ item: ItemDetail }>(`/items/${id}`);
    return res.item;
  },

  async reportFound(data: ReportFoundData): Promise<ItemDetail> {
    const res = await apiClient.post<{ item: ItemDetail }>('/items/found', data);
    return res.item;
  },

  async reportLost(data: ReportLostData): Promise<any> {
    const res = await apiClient.post('/items/lost', data);
    return res;
  },
};
