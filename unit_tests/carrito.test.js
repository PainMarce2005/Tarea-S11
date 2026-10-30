const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const appSource = fs.readFileSync(
  path.resolve(__dirname, '../app/carrito.js'),
  'utf8',
);

function createAppContext() {
  const elements = {
    '#input-cupon': { value: '' },
    '#msg-cupon': { textContent: '', className: '' },
  };
  const context = {
    document: {
      addEventListener() {},
      querySelector(selector) {
        if (!elements[selector]) {
          throw new Error(`Selector DOM no configurado en el mock: ${selector}`);
        }
        return elements[selector];
      },
    },
    window: { scrollTo() {} },
    clearTimeout,
    setTimeout,
  };

  vm.createContext(context);
  vm.runInContext(appSource, context, {
    filename: path.resolve(__dirname, '../app/carrito.js'),
  });
  vm.runInContext('renderCarrito = () => {};', context);

  return { context, elements };
}

describe('lógica aislada del carrito', () => {
  let context;
  let elements;

  beforeEach(() => {
    ({ context, elements } = createAppContext());
    vm.runInContext(
      'estado.carrito = [{ producto: PRODUCTOS[0], cantidad: 1 }];',
      context,
    );
  });

  test('calcula subtotal y total aplicando un cupón válido', () => {
    elements['#input-cupon'].value = 'DESCUENTO10';
    vm.runInContext('aplicarCupon();', context);

    expect(vm.runInContext('estado.cuponAplicado.codigo', context))
      .toBe('DESCUENTO10');
    expect(vm.runInContext('calcularTotales().subtotal', context))
      .toBe(2499);
    expect(vm.runInContext('calcularTotales().descuento', context))
      .toBeCloseTo(249.9);
    expect(vm.runInContext('calcularTotales().total', context))
      .toBeCloseTo(2249.1);
  });

  test('un cupón inválido sin descuento previo no altera el total', () => {
    const totalAnterior = vm.runInContext('calcularTotales().total', context);
    elements['#input-cupon'].value = 'NO_EXISTE';

    vm.runInContext('aplicarCupon();', context);

    expect(vm.runInContext('calcularTotales().total', context))
      .toBe(totalAnterior);
    expect(elements['#msg-cupon'].className).toBe('error');
  });

  test.each([
    [2499, 'S/ 2,499.00'],
    [89.9, 'S/ 89.90'],
    [0, 'S/ 0.00'],
  ])('formatea %s como precio local', (value, formatted) => {
    expect(vm.runInContext(`formatPrecio(${value})`, context)).toBe(formatted);
  });
});
