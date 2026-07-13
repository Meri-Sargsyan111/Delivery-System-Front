const wsProtocol = typeof window !== 'undefined' && window.location.protocol === 'https:' ? 'wss:' : 'ws:';
const wsHost = typeof window !== 'undefined' ? window.location.host : '';

export const environment = {
  production: true,
  apiBase: '',
  authBase: '/auth',
  wsBase: `${wsProtocol}//${wsHost}`,
};
