/** Las respuestas a los problemas que puede encontrar quien hace la prueba sin ayuda. */
export function PrinterHelp() {
  return (
    <section className="space-y-4">
      <h2 className="text-lg font-bold">Si algo no funciona</h2>

      <div className="space-y-1">
        <h3 className="font-bold">
          1. Dice «Chrome no tiene permiso» o no aparece nada al tocar el botón
        </h3>
        <p>
          Abre los <strong>Ajustes</strong> del celular → <strong>Apps</strong>{" "}
          → <strong>Chrome</strong> → <strong>Permisos</strong> →{" "}
          <strong>Dispositivos cercanos</strong> → elige{" "}
          <strong>Permitir</strong>. Vuelve aquí y toca el botón otra vez.
        </p>
        <p>
          Si sigue igual: en Chrome, toca el ícono que está a la izquierda de la
          dirección de la página → <strong>Permisos</strong> o{" "}
          <strong>Configuración del sitio</strong> →{" "}
          <strong>Restablecer permisos</strong>, y prueba de nuevo.
        </p>
      </div>

      <div className="space-y-1">
        <h3 className="font-bold">
          2. La lista aparece vacía o tu impresora no está
        </h3>
        <p>
          La impresora tiene que estar emparejada en el celular. Abre{" "}
          <strong>Ajustes</strong> → <strong>Bluetooth</strong> y fíjate que
          aparezca en «Dispositivos vinculados». Si no está, enciéndela y
          vincúlala ahí (la clave suele ser 0000 o 1234). Después vuelve aquí y
          toca el botón otra vez.
        </p>
        <p>
          Si igual no aparece, usa el botón «Probar método 2» del recuadro
          amarillo: algunas impresoras usan otro tipo de Bluetooth que solo se
          ve por ese camino.
        </p>
      </div>

      <div className="space-y-1">
        <h3 className="font-bold">
          3. Dice «No se pudo conectar con la impresora»
        </h3>
        <p>
          Revisa que esté encendida, con papel y cerca. Sobre todo,{" "}
          <strong>cierra la app de punto de venta</strong> que usas siempre: si
          está conectada a la impresora, Chrome no puede entrar. Si hace falta,
          apaga y vuelve a encender la impresora y prueba de nuevo.
        </p>
      </div>

      <div className="space-y-1">
        <h3 className="font-bold">
          4. Dice «Enviado» pero no sale papel, o salen símbolos raros
        </h3>
        <p>
          Igual es un dato útil: no hace falta resolverlo. Mándale una foto del
          papel (o avisa que no salió) junto con la captura del recuadro gris.
        </p>
      </div>

      <div className="space-y-1">
        <h3 className="font-bold">5. Dice «Este navegador no sirve»</h3>
        <p>
          No estás en Chrome, o tu Chrome es viejo. Abre el enlace en Google
          Chrome y actualízalo desde Play Store.
        </p>
      </div>
    </section>
  );
}
