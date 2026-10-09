/** El encabezado y los pasos de la prueba, escritos para alguien que la hace sola. */
export function PrinterSteps({ supported }: { supported: boolean }) {
  return (
    <>
      <header className="space-y-2">
        <h1 className="text-2xl font-bold">Prueba de impresora</h1>
        <p>
          Esta página prueba si tu impresora térmica puede imprimir directo
          desde Chrome, sin pasos extra. Tarda 5 minutos.
        </p>
      </header>

      {!supported && (
        <section className="space-y-2 rounded-lg bg-danger-soft p-4">
          <h2 className="font-bold">Este navegador no sirve para la prueba</h2>
          <p>
            Tienes que abrir este enlace en <strong>Google Chrome</strong> en tu
            celular Android. Si lo abriste desde WhatsApp, toca los tres puntos
            de arriba a la derecha y elige «Abrir en Chrome», o copia el enlace
            y pégalo en Chrome.
          </p>
          <p>
            Si ya estás en Chrome, actualízalo: entra a Play Store, busca
            «Chrome» y toca «Actualizar».
          </p>
        </section>
      )}

      <section className="space-y-3">
        <h2 className="text-lg font-bold">Antes de empezar</h2>
        <ol className="list-decimal space-y-2 pl-5">
          <li>Enciende la impresora y verifica que tenga papel.</li>
          <li>
            <strong>Cierra por completo la app de punto de venta</strong> que
            usas siempre para imprimir. La impresora solo acepta una conexión a
            la vez: si esa app está abierta, la prueba puede fallar.
          </li>
          <li>Ten el celular cerca de la impresora.</li>
        </ol>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-bold">La prueba</h2>
        <ol className="list-decimal space-y-2 pl-5">
          <li>Toca el botón verde «Imprimir prueba».</li>
          <li>
            Si Chrome pregunta por <strong>«Dispositivos cercanos»</strong>,
            toca <strong>Permitir</strong>.
          </li>
          <li>
            Aparece una lista: toca <strong>tu impresora</strong> y luego{" "}
            <strong>Conectar</strong>. Debería salir un papel que dice «SI LEES
            ESTO, FUNCIONO». Si la lista sale vacía, sigue el recuadro amarillo
            que está debajo del botón.
          </li>
          <li>
            Ahora <strong>cierra Chrome por completo</strong> (desliza la app
            hacia arriba para quitarla de las apps abiertas), vuelve a abrir
            este mismo enlace y toca «Imprimir prueba» otra vez.
          </li>
          <li>
            Si esta segunda vez <strong>imprime sin preguntarte nada</strong>,
            todo funcionó. El papel debería decir «Impresora recordada: SI».
          </li>
          <li>
            Hazle una <strong>captura de pantalla</strong> al recuadro gris de
            abajo y mándasela a quien te pasó este enlace.
          </li>
        </ol>
      </section>
    </>
  );
}
