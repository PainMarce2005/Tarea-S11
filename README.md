# Proyecto TiendaDemo

TiendaDemo es una aplicación académica estática de carrito de compras, usada
para demostrar pruebas automatizadas y su ejecución en Jenkins. La aplicación
se compone de HTML, CSS y JavaScript en el navegador; no tiene backend, API,
base de datos ni servicio web propio.

El proyecto reúne pruebas funcionales de interfaz con Selenium/unittest,
escenarios de aceptación con Behave, pruebas unitarias aisladas con Jest y
pruebas no funcionales HTTP con k6.

## Requisitos

- Python 3 y Google Chrome para las pruebas Selenium y para servir la app a k6.
  Selenium Manager administra el driver de Chrome.
- Dependencias Python declaradas en `requirements.txt`.
- Node.js 20 o posterior y npm para las pruebas unitarias Jest.
- k6 para las pruebas no funcionales.
- Jenkins con Pipeline y JUnit plugins para ejecutar el pipeline y publicar
  los resultados. Para el agente Windows, el pipeline usa el step `powershell`.

No es necesario instalar Jest globalmente: las dependencias de Jest y
`jest-junit` se instalan localmente desde `unit_tests/package.json`. k6 y Node
deben estar instalados en el agente antes de ejecutar Jenkins; el pipeline no
instala herramientas de sistema.

### Instalación de herramientas

Instala Python y Chrome según el sistema operativo y las políticas de tu
equipo. Para Node.js/npm, opciones habituales son:

```powershell
winget install OpenJS.NodeJS.LTS
```

```sh
brew install node
```

En Ubuntu/Debian:

```sh
sudo apt-get install nodejs npm
```

Para k6:

```powershell
winget install k6 --source winget
```

```sh
brew install k6
```

En Ubuntu/Debian, configura el repositorio oficial de Grafana e instala k6:

```sh
sudo apt-get update
sudo apt-get install -y ca-certificates gnupg
sudo mkdir -p /etc/apt/keyrings
wget -q -O - https://apt.grafana.com/gpg.key | gpg --dearmor | sudo tee /etc/apt/keyrings/grafana.gpg > /dev/null
echo "deb [signed-by=/etc/apt/keyrings/grafana.gpg] https://apt.grafana.com stable main" | sudo tee /etc/apt/sources.list.d/grafana.list
sudo apt-get update
sudo apt-get install -y k6
```

Consulta https://grafana.com/docs/k6/latest/set-up/install-k6/ si tu
distribución requiere un método diferente.

## Estructura

- `app/` — HTML, CSS y JavaScript de la tienda estática.
- `pages/` — Page Objects de Selenium.
- `tests/` — suite funcional Selenium/unittest, organizada por rangos de casos.
- `features/` — escenarios Behave y sus definiciones de pasos.
- `unit_tests/` — pruebas aisladas Jest de lógica de carrito.
- `k6/` — perfiles smoke, load y stress para las rutas estáticas.
- `utils/` — utilidades compartidas, incluido el factory de Chrome.
- `Jenkinsfile` — única fuente de verdad del pipeline para SCM.

Los casos Selenium se agrupan en `test_tc01_tc05.py`, `test_tc06_tc13.py`,
`test_tc14_tc19.py`, `test_tc20_tc31.py`, `test_tc32_tc41.py` y
`test_fails.py`; el caso base compartido está en `tests/base_test_case.py`.
Behave organiza sus escenarios en los mismos rangos y mantiene pasos comunes
en `features/steps/common_steps.py`.

## Ejecutar las pruebas localmente

### Selenium / unittest

Instala dependencias Python desde la raíz:

```sh
pip install -r requirements.txt
```

Ejecuta la suite, incluyendo sus reportes XML:

```sh
python -m xmlrunner discover -s tests -o reports/unittest
```

Los casos existentes prueban la aplicación con Chrome headless. Algunos
comportamientos TC-42 a TC-50 están documentados como pendientes y sus fallos
actuales son esperados en este ejemplo académico.

### Aceptación / Behave

```sh
python -m behave features --junit --junit-directory reports/behave
```

Los escenarios cubren TC-01 a TC-50. TC-32 a TC-41 están rotulados UAT, pero
ese rótulo no constituye aprobación formal de usuarios o negocio.

### Unitarias aisladas / Jest

Desde la raíz:

```sh
npm install --prefix unit_tests
npm test --prefix unit_tests
```

Las pruebas nuevas cargan `app/carrito.js` en `node:vm`, sin navegador, red o
base de datos. Un mock DOM mínimo permite probar el cupón. Cubren cálculo de
subtotal/descuento/total con cupón válido, cupón inválido sin descuento
aplicado y formateo de precios. En `carrito.js` no hay una función para parsear
precios: los valores del catálogo ya son números, por lo que no se inventa una
función de parseo.

El caso de cupón inválido aplicado después de uno válido (TC-44) ya es una
funcionalidad pendiente probada por los casos existentes; la suite unitaria no
cambia ese comportamiento.

Jest genera `reports/jest/junit.xml` mediante `jest-junit`.

### No funcionales / k6

La app no tiene servidor incorporado. Desde la raíz, inicia en una terminal un
servidor estático para `app/`:

```sh
python -m http.server 8000 --directory app
```

En Windows también puedes usar:

```powershell
py -3 -m http.server 8000 --directory app
```

En otra terminal, desde la raíz del proyecto:

```powershell
$env:BASE_URL = 'http://localhost:8000'
New-Item -ItemType Directory -Force k6/results | Out-Null
k6 run --summary-export=k6/results/smoke-summary.json k6/smoke.js
k6 run --summary-export=k6/results/load-summary.json k6/load.js
k6 run --summary-export=k6/results/stress-summary.json k6/stress.js
```

En macOS/Linux:

```sh
export BASE_URL=http://localhost:8000
mkdir -p k6/results
k6 run --summary-export=k6/results/smoke-summary.json k6/smoke.js
k6 run --summary-export=k6/results/load-summary.json k6/load.js
k6 run --summary-export=k6/results/stress-summary.json k6/stress.js
```

`BASE_URL` es el origen local (sin ruta) y por defecto es
`http://localhost:8000`. Los scripts consultan rutas existentes:
`/tienda_demo.html`, `/estilos.css` y `/carrito.js`; rechazan orígenes que no
sean `localhost` o `127.0.0.1`.

| Perfil | Carga | Umbrales |
|---|---|---|
| `smoke.js` | 1 VU durante 10 s | p95 < 1500 ms, errores HTTP < 1 %, checks > 99 %. |
| `load.js` | 10 VUs durante 1 min | p95 < 1500 ms, errores HTTP < 1 %, checks > 99 %. |
| `stress.js` | Incrementos de 5, 10, 15 y 20 VUs, luego descenso | p95 < 2000 ms, errores HTTP < 2 %, checks > 98 %. |

Estos umbrales son iniciales y moderados para una demo local; no son SLOs ni
resultados medidos. k6 muestra solicitudes por segundo en el resumen; no se
fija un mínimo de throughput porque depende del equipo. Los resultados JSON
van a `k6/results/`, excluidos de Git.

Un ejemplo ilustrativo de salida:

```text
http_req_duration..............: avg=18ms min=2ms med=12ms max=220ms p(95)=75ms
http_req_failed................: 0.00%  0 out of 1800
http_reqs......................: 1800   29.8/s
checks.........................: 100.00% 5400 out of 5400
```

## Pipeline de Jenkins

El `Jenkinsfile` raíz es la fuente única del pipeline. Ejecuta las suites
secuencialmente:

1. **Install dependencies** limpia los XML previos de unittest y Behave,
   instala `requirements.txt` y crea los directorios de reportes de ambas
   suites.
2. **Functional / Unit tests (Selenium)** ejecuta
   `xmlrunner discover -s tests`; conserva el uso actual de Selenium. Los
   fallos funcionales esperados no impiden intentar las etapas siguientes.
3. **Acceptance tests (Behave)** ejecuta los escenarios de `features/` con
   salida JUnit.
4. **Unit tests (Jest)** instala dependencias locales con
   `npm install --prefix unit_tests` y ejecuta `npm test --prefix unit_tests`.
5. **Non-functional tests (k6)** inicia un servidor HTTP estático de Python en
   `127.0.0.1:8000`, espera a que la página responda, ejecuta el perfil
   seleccionado y detiene el servidor.

El bloque `post { always { ... } }` publica los tres grupos de XML JUnit
(`reports/unittest`, `reports/behave` y `reports/jest`) y archiva los resúmenes
JSON `k6/results/*-summary.json`. `K6_PROFILE=all` ejecuta smoke, load y stress
en secuencia. k6 no genera JUnit en esta configuración; su summary se publica
como artefacto JSON.

### Parámetros del pipeline

- `PYTHON` (texto, vacío por defecto): ejecutable Python o ruta configurable.
  Si se deja vacío, el pipeline usa `python3` en Linux/Unix y `python` en
  Windows, desde `PATH`.
- `K6_PROFILE` (elección, por defecto `smoke`): `smoke`, `load`, `stress` o
  `all`.

No hay `PROJECT_DIR`: con SCM Jenkins ejecuta el pipeline desde el workspace
del checkout. El agente debe tener Python 3, Node.js/npm, k6 y Chrome
disponibles. No se hardcodean rutas de usuario. Para Windows se usa el step
`powershell`; Unix utiliza `sh` y `curl`.

El job de Jenkins configurado originalmente era **Pipeline script** inline,
iniciado manualmente y dependiente de una ruta local. Ese job no cambia solo
por actualizar el repositorio; debe cambiarse manualmente a SCM según los
pasos de abajo.

Para revisar una ejecución, abre **Console Output** para los comandos y
diagnósticos, **Test Result** para los resultados JUnit y **Artifacts** para
los resúmenes JSON de k6 archivados.

### Historial de configuración del job local

La configuración existente documentó Jenkins en `http://localhost:8080`, el
job **TiendaDemo**, los plugins Pipeline y JUnit, y la publicación de reportes
JUnit. Durante la configuración inicial, Java rechazó el certificado TLS del
catálogo de plugins; se agregó el certificado raíz de confianza al almacén de
Java y se reinició Jenkins, sin desactivar validación TLS.

El build documentado como #3 registró 51 pruebas unittest (9 fallidas) y 50
escenarios Behave (41 aprobados y 9 fallidos): 83 aprobados y 18 fallidos en
total. Son resultados históricos del job anterior, no una ejecución de este
pipeline consolidado.

## Publicar en GitHub y conectar Jenkins por SCM

Antes de publicar, revisa `.gitignore`: conserva `__pycache__/`, `*.py[cod]`,
`reports/` y `k6/results/`. `unit_tests/.gitignore` excluye
`node_modules/`. Revisa además que no se incluyan credenciales, tokens,
archivos `.env` o artefactos generados.

Comandos Git de referencia (no ejecutados aquí). Sustituye la URL y evita
`git init` o `git remote add` si el repositorio ya está inicializado o tiene
un remoto:

```sh
git init
git branch -M main
git add .gitignore Jenkinsfile README.md app features k6 pages tests unit_tests utils requirements.txt
git status --short
git commit -m "Prepare TiendaDemo pipeline"
git remote add origin https://github.com/USUARIO/REPOSITORIO.git
git push -u origin main
```

Para usar el pipeline desde GitHub:

1. Publica el repositorio y configura las credenciales de Jenkins si es
   privado.
2. En la configuración del job, cambia **Definition** a **Pipeline script
   from SCM**.
3. Selecciona **Git**, indica URL, credenciales y rama (por ejemplo `*/main`).
4. Configura **Script Path** como `Jenkinsfile`.
5. Guarda. El checkout de SCM proporciona el workspace; configura los
   parámetros `PYTHON` y `K6_PROFILE` al iniciar builds.

Como alternativa a un webhook, habilita **Poll SCM** en **Build Triggers** con:

```text
H/5 * * * *
```

Esto sondea cada cinco minutos, distribuido por hash del job.

## Limitaciones conocidas

- La app es completamente estática: no hay endpoints API/backend, login,
  persistencia de base de datos ni transacciones servidoras. Las pruebas k6
  miden disponibilidad HTTP, latencia y errores de los recursos estáticos, no
  flujos de navegador ni carga de un backend inexistente.
- Seguridad (incluido pentesting), accesibilidad, compatibilidad visual/de
  navegador y pruebas de estrés de servicios externos quedan fuera del
  alcance de estas suites.
- TC-42 a TC-50 describen validaciones/comportamientos todavía no
  implementados. Sus fallos están previstos para la demostración y no se
  corrigen ni excluyen del pipeline.
- Los escenarios TC-32 a TC-41 se llaman UAT, pero no se dispone de evidencia
  de aprobación formal de usuarios o negocio.
