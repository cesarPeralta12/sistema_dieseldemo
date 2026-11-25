# Vales de diésel: demo

Demo de la solicitud SC-2026-01, con datos ficticios. `demo-vales-diesel.html` se abre con doble clic, sin instalar nada.

## Guion (10 minutos)

1. **Hoja de control.** Las filas rojas son buses que no partieron en días anteriores. Filtra por ciudad.
2. **Emitir vale.** Elige ruta, bus, chofer y punto de carga. El vale se dibuja mientras lo llenas.
3. **No partió.** Márcalo y usa «Pasar al día siguiente»: el vale sigue en la hoja.
4. **Partió.** El bus sale con todo su saldo. Míralo en Kardex por bus.
5. **Otros movimientos.** Abastece un tanque y comprueba que el saldo del bus no cambia.
6. **Verificar facturas.** Cambia los litros para ver el ajuste.
7. **Conciliar aliadas.** Revisa los cuatro resultados y luego Adeudado.
8. **Entrar como.** Cambia a Contable o a un encargado para ver sus permisos.

«Reiniciar demo» vuelve a los datos iniciales.

## Límites

- Los datos viven en el navegador. No hay servidor, contraseñas ni varios usuarios a la vez.
- El precio es fijo por estación (Bs 17,95) y cada vale conserva el suyo. La vigencia por fechas va en el sistema final.
- El estado de cuenta se pega como texto. No hay lectura de Excel ni PDF, y el código de barras del vale es decorativo.
- Traspasos y compras sin factura no se limitan por ciudad, porque ocurren en carretera.
- Adeudado no descuenta pagos.

## Código

`src/dominio` tiene las reglas, sin dependencia de la interfaz. `src/paginas` son las pantallas.

    npm install
    npm run dev
    npm test
    npm run build
