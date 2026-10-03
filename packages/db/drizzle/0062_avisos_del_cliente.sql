-- Spec 0139 §4 / ADR 0116: Actividad lista los avisos de mostrador del cliente
-- (`listConsumerNotices`, `GET /api/public/consumer/notices`), asi que el rol del cliente LEE la
-- cola. La 0060 le dejo solo INSERT (`0060_rol_del_cliente.sql:33`) y pide que la spec que la lea
-- traiga su GRANT. Solo las columnas que la lectura usa: ni `status`, ni `last_error`, ni `sent_at`.
GRANT SELECT (id, consumer_id, class, title, body, created_at) ON consumer.wallet_push_queue TO checkpass_consumer;
