---
fecha: 2026-08-10
resumen: Mi Pasaporte usa un monorepo TypeScript con tres aplicaciones Next.js desplegadas separadamente en Vercel.
estado: propuesta
---

# ADR 0011 — Monorepo y despliegues web separados

## Contexto

Consumidor, comercio y plataforma son dominios de acceso separados (ADR 0010), aunque comparten reglas y datos de producto.

## Propuesta

Usar `pnpm` + Turborepo con tres aplicaciones Next.js App Router: consumer PWA, merchant backoffice y platform backoffice. Cada una se despliega como proyecto Vercel Pro distinto, con subdominio, secretos y cookies propios. Los paquetes compartidos contienen datos, contratos, dominio y sólo UI realmente común.

## Consecuencias

- Se reduce el riesgo de mezclar sesiones o rutas de superficies distintas.
- Se comparten reglas críticas y tipos sin copiar código entre repositorios.
- Hay más configuración de despliegue que en una única aplicación.

## Estado

Propuesta pendiente de validación del fundador.

