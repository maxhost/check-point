# 0242 — QA de masa y retirada

P3b entregado `30426343e6e42d236912c939c26a9de607003250`, producto/esquema y
suite canónica49e1990b; P4 continúa en su writer exclusivo. QA nuevo independiente
en WT/ref pos-qa-0242, único path informe `docs/factory/0242-p3b-p4-qa.md`.
Coordinador continúa reserva y ensambla SHAs entregados, con factory refresh antes
de cada fase. No modificar checkout por detrás de pruebas/revisión en curso.

Primera fase sobre P3b congelado: revisar esquema0108/contratos y evidencia nativa
compuesta, reproducir cadena DB canónica en CI protegida (3casos, sin skips).
DB/puerto43252 exclusivos de QA tras teardown autor; solo tools/neon-test.sh vía
runner validado. Nuevo namespace POS_MASS_NATIVE_RUN acotado, nunca sobrescribir
mass-native original ni M0/private. No repetir ventas consumidas.

Después de entrega P4, cerrar la fase anterior y congelar combinado nuevo con
aviso al revisor. Revisar cobertura sustituida, retirada real, Clientes/defaults,
ticket-settings contract2, reglas íntegras y recovery de mesas sin liberar unknown.
Reutilizar pruebas de autor compatibles y reproducir señales decisivas pertinentes.
Un smoke nativo completo nuevo con pase/cupón/masa comprueba la combinación real
tras cambios del editor/scanner; fixture propia namespace QA, inspección/replay y
cleanup por ownership. No interceptar APIs ni hacer capturas.

Separar QA de entrega P3b de combinación P3b+P4, con SHAs/evidencia/resultados
reales. Si falta P4 no declarar combinación aprobada. QA no corrige producto/tests;
fallos vuelven al autor y solo invalidan checks afectados. Fuentes/cambios de
harness que no afectan producto deben conservar identidad explícita y fallos previos.

Sin verdeglobal, M1, hardware/papel, push/PROD ni cambios de estados/factory por
QA. Conservar3201/túnel, procesos ajenos y tres WTs; detener solo procesos propios.
