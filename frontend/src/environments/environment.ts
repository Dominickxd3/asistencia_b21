const desarrollo = {
  production: false,
  apiUrl: 'http://localhost:3000/api',
  wsUrl: 'http://localhost:3000/realtime',
};

const produccion = {
  production: true,
  apiUrl: '/api',
  wsUrl: '/realtime',
};

export const environment = import.meta.env.PROD ? produccion : desarrollo;
