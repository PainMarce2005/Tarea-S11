import http from 'k6/http';
import { check, sleep } from 'k6';

const BASE_URL = (__ENV.BASE_URL || 'http://localhost:8000').replace(/\/+$/, '');

if (!/^http:\/\/(?:localhost|127\.0\.0\.1)(?::\d+)?$/i.test(BASE_URL)) {
  throw new Error('BASE_URL debe apuntar a localhost o 127.0.0.1.');
}

export const options = {
  vus: 1,
  duration: '10s',
  thresholds: {
    http_req_duration: ['p(95)<1500'],
    http_req_failed: ['rate<0.01'],
    checks: ['rate>0.99'],
  },
};

export default function () {
  // Comprueba la disponibilidad HTTP de la página y sus recursos estáticos.
  const responses = http.batch([
    ['GET', `${BASE_URL}/tienda_demo.html`],
    ['GET', `${BASE_URL}/estilos.css`],
    ['GET', `${BASE_URL}/carrito.js`],
  ]);

  check(responses[0], {
    'la tienda responde HTTP 200': (response) => response.status === 200,
    'se sirve la página TiendaDemo': (response) =>
      response.body.includes('TiendaDemo'),
    'la página responde en menos de 1.5 s': (response) =>
      response.timings.duration < 1500,
  });
  check(responses[1], {
    'los estilos responden HTTP 200': (response) => response.status === 200,
    'los estilos responden en menos de 1.5 s': (response) =>
      response.timings.duration < 1500,
  });
  check(responses[2], {
    'el JavaScript responde HTTP 200': (response) => response.status === 200,
    'el JavaScript responde en menos de 1.5 s': (response) =>
      response.timings.duration < 1500,
  });

  sleep(1);
}
