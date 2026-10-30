import http from 'k6/http';
import { check, sleep } from 'k6';

const BASE_URL = (__ENV.BASE_URL || 'http://localhost:8000').replace(/\/+$/, '');

if (!/^http:\/\/(?:localhost|127\.0\.0\.1)(?::\d+)?$/i.test(BASE_URL)) {
  throw new Error('BASE_URL debe apuntar a localhost o 127.0.0.1.');
}

export const options = {
  stages: [
    { duration: '30s', target: 5 },
    { duration: '30s', target: 10 },
    { duration: '30s', target: 15 },
    { duration: '30s', target: 20 },
    { duration: '15s', target: 0 },
  ],
  thresholds: {
    http_req_duration: ['p(95)<2000'],
    http_req_failed: ['rate<0.02'],
    checks: ['rate>0.98'],
  },
};

export default function () {
  // Aumenta gradualmente la carga local hasta veinte VUs para observar degradación.
  const responses = http.batch([
    ['GET', `${BASE_URL}/tienda_demo.html`],
    ['GET', `${BASE_URL}/estilos.css`],
    ['GET', `${BASE_URL}/carrito.js`],
  ]);

  check(responses[0], {
    'la tienda responde HTTP 200': (response) => response.status === 200,
    'se sirve la página TiendaDemo': (response) =>
      response.body.includes('TiendaDemo'),
    'la página responde en menos de 2 s': (response) =>
      response.timings.duration < 2000,
  });
  check(responses[1], {
    'los estilos responden HTTP 200': (response) => response.status === 200,
    'los estilos responden en menos de 2 s': (response) =>
      response.timings.duration < 2000,
  });
  check(responses[2], {
    'el JavaScript responde HTTP 200': (response) => response.status === 200,
    'el JavaScript responde en menos de 2 s': (response) =>
      response.timings.duration < 2000,
  });

  sleep(1);
}
