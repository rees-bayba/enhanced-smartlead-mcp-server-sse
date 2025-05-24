import axios, { AxiosInstance } from 'axios';

export class SmartLeadClient {
  private client: AxiosInstance;
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
    this.client = axios.create({
      baseURL: 'https://server.smartlead.ai/api/v1',
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Add request interceptor for debugging
    this.client.interceptors.request.use((config) => {
      console.error(`[SmartLead API] ${config.method?.toUpperCase()} ${config.url}`);
      return config;
    });

    // Add response interceptor for error handling
    this.client.interceptors.response.use(
      (response) => response,
      (error) => {
        console.error('[SmartLead API Error]', error.response?.data || error.message);
        throw error;
      }
    );
  }

  // Generic request method
  async request(method: string, endpoint: string, data?: any, params?: any) {
    try {
      const response = await this.client.request({
        method,
        url: endpoint,
        data,
        params: {
          api_key: this.apiKey,
          ...params,
        },
      });
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw new Error(`SmartLead API Error: ${error.response?.data?.message || error.message}`);
      }
      throw error;
    }
  }

  // Convenience methods
  get(endpoint: string, params?: any) {
    return this.request('GET', endpoint, undefined, params);
  }

  post(endpoint: string, data?: any, params?: any) {
    return this.request('POST', endpoint, data, params);
  }

  delete(endpoint: string, params?: any) {
    return this.request('DELETE', endpoint, undefined, params);
  }
}
