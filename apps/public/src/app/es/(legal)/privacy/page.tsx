import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Política de privacidad",
  description:
    "Conoce qué datos utiliza CheckPass Club, para qué los usa y cómo ejercer tus derechos.",
  alternates: { canonical: "/es/privacy" },
};

const sections = [
  ["responsable", "Quién trata tus datos"],
  ["datos", "Qué datos tratamos"],
  ["usos", "Para qué los usamos"],
  ["compartimos", "Con quién los compartimos"],
  ["conservacion", "Conservación y seguridad"],
  ["decisiones", "Tus elecciones y derechos"],
  ["contacto", "Contacto y cambios"],
] as const;

export default function PrivacyPage() {
  return (
    <main className="legal-main" id="contenido">
      <div className="legal-intro">
        <span className="legal-eyebrow">Tus datos, con claridad</span>
        <h1>Política de privacidad</h1>
        <p>
          Explicamos cómo se usan los datos de quienes exploran CheckPass Club,
          se inscriben en programas de comercios o administran un negocio en la
          plataforma.
        </p>
        <p className="legal-date">Última actualización: 1 de octubre de 2026</p>
      </div>

      <div className="legal-grid">
        <nav className="legal-toc" aria-label="Contenido de esta política">
          <strong>En esta página</strong>
          {sections.map(([id, label]) => (
            <a href={`#${id}`} key={id}>
              {label}
            </a>
          ))}
        </nav>

        <article className="legal-article">
          <section id="responsable">
            <h2>Quién trata tus datos</h2>
            <p>
              CheckPass Club es una plataforma que permite a comercios crear
              programas de fidelización y a sus clientes consultar puntos,
              sellos, pases y beneficios. Los datos se tratan para prestar ese
              servicio y atender a sus usuarios.
            </p>
            <p className="legal-note">
              Responsable: <strong>The No-Code Company OÜ</strong> · Registro
              estonio 16294378 · IVA EE102499551.
              <br />
              Domicilio: Lõõtsa tn 5, Lasnamäe linnaosa, 11415 Tallinn, Estonia.
              <br />
              Correo:{" "}
              <a href="mailto:hola@checkpass.club">hola@checkpass.club</a>.
              Teléfono: <a href="tel:+491749204700">+49 174 9204700</a>.
            </p>
            <p>
              Esta política tiene en cuenta el Reglamento General de Protección
              de Datos de la Unión Europea y la normativa de protección de datos
              de Ecuador, en los casos en que resulten aplicables.
            </p>
            <p>
              Los comercios participantes definen sus programas y atienden a sus
              clientes. Cuando usan datos de sus clientes para finalidades
              propias, también son responsables de explicarles ese uso y
              respetar sus derechos.
            </p>
          </section>

          <section id="datos">
            <h2>Qué datos tratamos</h2>
            <ul>
              <li>
                <strong>Clientes:</strong> nombre, apellido, teléfono y datos
                que decidan añadir a su perfil; programas a los que se
                inscriben, visitas o compras acreditadas, puntos, sellos,
                cupones, canjes y preferencias de comunicación.
              </li>
              <li>
                <strong>Comercios y personal:</strong> datos de contacto y
                acceso, información del negocio y sus locales, catálogo,
                programas y campañas. Si contratan un plan de pago, datos
                necesarios para administrar la suscripción y facturación.
              </li>
              <li>
                <strong>Uso técnico:</strong> dirección IP, navegador,
                dispositivo, registros de acceso, cookies de sesión e
                identificadores de notificaciones o pases necesarios para su
                funcionamiento y seguridad.
              </li>
              <li>
                <strong>Ubicación:</strong> ubicación de los locales publicada
                por los comercios; ubicación aproximada derivada de la conexión
                cuando se usa para adaptar la experiencia y, solo si una función
                solicita permiso, la ubicación que el dispositivo comparta.
                Puedes denegar ese permiso desde el navegador.
              </li>
            </ul>
            <p>
              Podemos recibir información de un comercio participante cuando
              registra una visita, una compra o un canje. Si no proporcionas los
              datos necesarios para crear una cuenta o inscribirte en un
              programa, esas funciones no estarán disponibles; la exploración
              pública seguirá siendo accesible.
            </p>
          </section>

          <section id="usos">
            <h2>Para qué los usamos</h2>
            <ul>
              <li>
                Crear y mantener cuentas, inscripciones y pases; mostrar saldos
                y entregar o validar beneficios. Este tratamiento permite
                prestar el servicio solicitado.
              </li>
              <li>
                Administrar negocios, personal, campañas, suscripciones, cobros
                y soporte; cumplir obligaciones contractuales y legales.
              </li>
              <li>
                Proteger cuentas, prevenir abusos y resolver fallos, conforme a
                obligaciones de seguridad e intereses legítimos compatibles con
                tus derechos.
              </li>
              <li>
                Enviar avisos de actividad y beneficios, cuando habilitas las
                notificaciones. Las promociones de cada comercio pueden
                desactivarse en la configuración de tu cuenta. También puedes
                retirar el permiso de notificaciones desde el dispositivo.
              </li>
              <li>
                Mostrar ofertas pertinentes según los programas en los que
                participas y tu interacción con los comercios, de acuerdo con
                las preferencias disponibles. No usamos estos datos para
                decisiones automatizadas con efectos legales sobre ti.
              </li>
            </ul>
            <p>
              Cuando un tratamiento requiera consentimiento, puedes retirarlo en
              cualquier momento; esto no afecta los tratamientos anteriores
              realizados válidamente ni las funciones que debamos conservar por
              otra base legal.
            </p>
          </section>

          <section id="compartimos">
            <h2>Con quién los compartimos</h2>
            <p>
              El comercio al que te inscribes recibe la información necesaria
              para administrar su programa, acreditar actividad y atender
              canjes. Otros comercios no obtienen automáticamente tu perfil por
              estar en CheckPass Club.
            </p>
            <p>
              Utilizamos proveedores que nos ayudan a alojar la plataforma,
              guardar información, enviar mensajes y notificaciones, procesar
              pagos y ofrecer mapas o pases digitales. Apple Wallet y Google
              Wallet se rigen además por sus propias políticas cuando decides
              añadir un pase. Compartimos con cada proveedor solo los datos
              necesarios para la función correspondiente.
            </p>
            <p>
              Algunos proveedores pueden tratar datos fuera de Ecuador. En esos
              casos aplicamos las garantías y condiciones exigidas por la
              normativa aplicable. También podemos comunicar datos cuando una
              autoridad competente lo requiera legalmente.
            </p>
          </section>

          <section id="conservacion">
            <h2>Conservación y seguridad</h2>
            <p>
              Conservamos los datos de cuenta y actividad mientras sean
              necesarios para prestar el servicio, mantener el historial de
              beneficios y atender solicitudes. Tras el cierre de una cuenta,
              eliminamos o anonimizamos los datos cuando ya no sean necesarios,
              salvo los que debamos conservar por obligaciones legales,
              reclamaciones o prevención de fraude durante el plazo aplicable.
              Los registros técnicos se conservan solo durante el tiempo
              necesario para seguridad y operación.
            </p>
            <p>
              Aplicamos medidas técnicas y organizativas para proteger la
              información y limitamos el acceso a quienes la necesitan para
              prestar el servicio. Ningún sistema conectado a internet puede
              garantizar seguridad absoluta.
            </p>
          </section>

          <section id="decisiones">
            <h2>Tus elecciones y derechos</h2>
            <p>
              Puedes solicitar acceso, rectificación, actualización,
              eliminación, oposición, limitación o portabilidad de tus datos,
              según corresponda. También puedes retirar consentimientos y
              presentar una reclamación ante la{" "}
              <a href="https://spdp.gob.ec/" rel="noreferrer">
                Superintendencia de Protección de Datos Personales
              </a>{" "}
              de Ecuador o ante la{" "}
              <a href="https://www.aki.ee/en" rel="noreferrer">
                autoridad de protección de datos de Estonia
              </a>
              , según corresponda. Te pediremos verificar tu identidad antes de
              entregar o modificar información personal.
            </p>
            <p>
              Desde tu cuenta puedes desactivar promociones por comercio; desde
              el navegador o el teléfono puedes gestionar permisos de
              notificaciones y ubicación. Desactivar promociones no impide los
              avisos necesarios sobre la actividad de tus programas.
            </p>
          </section>

          <section id="contacto">
            <h2>Contacto y cambios</h2>
            <p>
              Para consultas, solicitudes sobre tus datos o reclamaciones,
              utiliza los datos de contacto del responsable indicados al
              comienzo de esta política. Responderemos dentro de los plazos
              establecidos por la normativa aplicable.
            </p>
            <p>
              Si cambiamos esta política, publicaremos la versión actualizada
              aquí e informaremos los cambios relevantes por un medio apropiado.
              La fecha de actualización aparece al inicio.
            </p>
          </section>
        </article>
      </div>
    </main>
  );
}
