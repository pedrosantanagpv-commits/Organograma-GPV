import { mockData } from './mock-data.js';

const DEFAULT_API_URL =
  'https://script.google.com/macros/s/AKfycbxAts87uFnOtNtEiUYZy-PE_QyS46x7BrtMVpGxIhEN7DD_fQfyxJCL6IChO0ksTTfxRA/exec';

const API_URL = String(
  import.meta.env.VITE_API_URL || DEFAULT_API_URL
).trim();

export async function loadBootstrap() {
  try {
    const url = new URL(API_URL);
    url.searchParams.set('action', 'bootstrap');
    url.searchParams.set('_', Date.now().toString());

    const response = await fetch(url.toString(), {
      method: 'GET',
      cache: 'no-store',
      redirect: 'follow'
    });

    if (!response.ok) {
      throw new Error(`A API respondeu com status ${response.status}.`);
    }

    const payload = await response.json();

    if (!payload.ok) {
      throw new Error(payload?.error?.message || 'A API retornou um erro.');
    }

    return {
      data: payload.data,
      source: 'api',
      warning: ''
    };
  } catch (error) {
    console.error('Falha ao carregar a API:', error);

    return {
      data: structuredClone(mockData),
      source: 'mock',
      warning:
        'A planilha não respondeu agora. A estrutura local está sendo exibida temporariamente.'
    };
  }
}
