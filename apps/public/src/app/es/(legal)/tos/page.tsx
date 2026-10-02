import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Términos de uso",
  description:
    "Condiciones para usar CheckPass Club como cliente o comercio participante.",
  alternates: { canonical: "/es/tos" },
};

const sections = [
  ["servicio", "El servicio"],
  ["cuentas", "Cuentas y acceso"],
  ["programas", "Programas y beneficios"],
  ["comercios", "Responsabilidades de los comercios"],
  ["pagos", "Planes y pagos"],
  ["disponibilidad", "Disponibilidad y cambios"],
  ["derechos", "Derechos y contacto"],
] as const;

export default function TermsPage() {
  return (
    <main className="legal-main" id="contenido">
      <div className="legal-intro">
        <span className="legal-eyebrow">Cómo funciona el servicio</span>
        <h1>Términos de uso</h1>
        <p>
          Estas condiciones explican las reglas generales para explorar
          CheckPass Club, participar en programas de comercios y administrar un
          negocio en la plataforma.
        </p>
        <p className="legal-date">Última actualización: 1 de octubre de 2026</p>
      </div>

      <div className="legal-grid">
        <nav className="legal-toc" aria-label="Contenido de estos términos">
          <strong>En esta página</strong>
          {sections.map(([id, label]) => (
            <a href={`#${id}`} key={id}>
              {label}
            </a>
          ))}
        </nav>

        <article className="legal-article">
          <section id="servicio">
            <h2>El servicio</h2>
            <p>
              CheckPass Club ofrece herramientas para que comercios administren
              programas de fidelización, puntos o sellos, campañas y beneficios.
              Los clientes pueden inscribirse, consultar su actividad y mostrar
              su pase desde la aplicación web o, cuando esté disponible, desde
              Apple Wallet o Google Wallet.
            </p>
            <p>
              CheckPass Club proporciona la plataforma tecnológica. Cada
              comercio es responsable de los productos, servicios y beneficios
              que ofrece, de sus condiciones particulares y de atender los
              canjes en sus locales. Las fichas identificadas como ejemplos en
              la web pública son demostraciones y no anuncian ofertas vigentes.
            </p>
            <p className="legal-note">
              Prestador: <strong>The No-Code Company OÜ</strong> · Registro
              estonio 16294378 · IVA EE102499551.
              <br />
              Domicilio: Lõõtsa tn 5, Lasnamäe linnaosa, 11415 Tallinn, Estonia.
              <br />
              Correo:{" "}
              <a href="mailto:hola@checkpass.club">hola@checkpass.club</a>.
              Teléfono: <a href="tel:+491749204700">+49 174 9204700</a>.
            </p>
          </section>

          <section id="cuentas">
            <h2>Cuentas y acceso</h2>
            <p>
              Para participar en un programa debes proporcionar datos correctos
              y mantener actualizado el teléfono asociado a tu cuenta. Los
              comercios y su personal deben utilizar únicamente los accesos que
              les correspondan y proteger sus credenciales y dispositivos.
              Avísanos si detectas un acceso no autorizado.
            </p>
            <p>
              No debes utilizar cuentas ajenas, manipular códigos QR, saldos o
              cupones, automatizar canjes ni intentar acceder a datos de otros
              usuarios o comercios. Podemos restringir un uso que comprometa la
              seguridad o vulnere estas condiciones, con las garantías que
              correspondan y sin afectar derechos adquiridos legítimamente.
            </p>
          </section>

          <section id="programas">
            <h2>Programas y beneficios</h2>
            <p>
              Cada programa muestra sus propias reglas: cómo se acumulan puntos
              o sellos, qué premio se ofrece, quién puede reclamarlo, su
              vigencia y las condiciones de canje. Antes de participar o
              reclamar, revisa la información específica del programa o
              beneficio. Las condiciones concretas de cada oferta complementan
              estos términos generales.
            </p>
            <p>
              Los puntos y sellos son unidades de seguimiento del programa del
              comercio; no son dinero, no constituyen una cuenta bancaria y no
              pueden canjearse por efectivo salvo que el comercio anuncie
              expresamente otra condición permitida por la ley. Los cupones
              pueden estar sujetos a fecha de vencimiento, disponibilidad o
              límites indicados en la oferta. Un beneficio de un comercio no
              implica que cualquier otro comercio esté obligado a aceptarlo.
            </p>
            <p>
              Añadir un pase a Apple Wallet o Google Wallet es opcional. Su
              disponibilidad depende del dispositivo y de esos servicios; la
              cuenta de CheckPass Club sigue siendo el registro de referencia
              para saldos, beneficios y canjes.
            </p>
          </section>

          <section id="comercios">
            <h2>Responsabilidades de los comercios</h2>
            <p>
              Los comercios deben publicar información clara y veraz sobre sus
              locales, productos, precios y beneficios, cumplir sus ofertas
              válidamente publicadas y atender las reclamaciones de sus
              clientes. Deben acreditar visitas o compras reales, proteger los
              accesos de su personal y usar los datos de clientes únicamente
              para fines permitidos por la ley y por la{" "}
              <a href="/es/privacy">Política de privacidad</a>.
            </p>
            <p>
              CheckPass Club puede retirar contenido ilícito, engañoso o que
              afecte la seguridad de la plataforma, y podrá suspender el acceso
              de un comercio ante incumplimientos graves, respetando las
              obligaciones legales y contractuales aplicables.
            </p>
          </section>

          <section id="pagos">
            <h2>Planes y pagos</h2>
            <p>
              El uso para clientes es gratuito. Los planes para comercios,
              funciones incluidas, precios, impuestos, períodos de cobro y
              condiciones de cancelación se informarán antes de contratar. Los
              precios indicados como referenciales en páginas promocionales no
              constituyen un cobro ni reemplazan las condiciones presentadas al
              confirmar una suscripción.
            </p>
            <p>
              Si un comercio contrata un plan de pago, la facturación y los
              posibles reembolsos se regirán por las condiciones mostradas en
              ese momento y por la normativa aplicable. El procesador de pagos
              puede aplicar sus propias condiciones para ejecutar la
              transacción.
            </p>
          </section>

          <section id="disponibilidad">
            <h2>Disponibilidad y cambios</h2>
            <p>
              Trabajamos para mantener el servicio disponible y seguro. Puede
              haber interrupciones por mantenimiento, fallos de conexión o
              servicios de terceros. Si cambiamos funciones o estas condiciones
              de forma relevante, lo comunicaremos con antelación razonable
              cuando corresponda. Los cambios no eliminan derechos que la ley
              reconozca a clientes o comercios.
            </p>
            <p>
              Las marcas, textos, diseños y software de CheckPass Club están
              protegidos por sus respectivos derechos. El contenido y las marcas
              de cada comercio pertenecen a sus titulares; el comercio nos
              autoriza a mostrarlos en la medida necesaria para prestar el
              servicio.
            </p>
          </section>

          <section id="derechos">
            <h2>Derechos y contacto</h2>
            <p>
              La empresa prestadora está establecida en Estonia. Estas
              condiciones no limitan los derechos imperativos de consumidores y
              usuarios que correspondan en Ecuador o en el país de residencia de
              cada persona. Puedes dirigir consultas o reclamaciones a los datos
              de contacto del prestador indicados al comienzo. También puedes
              acudir a las autoridades competentes cuando corresponda.
            </p>
            <p>
              El tratamiento de datos personales se explica en nuestra{" "}
              <a href="/es/privacy">Política de privacidad</a>. La fecha de
              actualización de estos términos aparece al inicio de la página.
            </p>
          </section>
        </article>
      </div>
    </main>
  );
}
