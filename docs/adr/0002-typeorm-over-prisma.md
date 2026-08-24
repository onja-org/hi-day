# Use TypeORM instead of Prisma for the backend ORM

The backend originally used Prisma (`@prisma/client` + `@prisma/adapter-pg`), with one applied migration (`organisations`/`users`/`memberships`). It was replaced with TypeORM (`@nestjs/typeorm`, injected `Repository<Entity>` per entity) — no specific technical driver (e.g. a Prisma limitation or licensing issue) was identified; this was a preference call made before any real data existed.

The schema itself was kept identical — same tables, columns, enum values, and the `[userId, organisationId]` uniqueness constraint — so this was purely an ORM swap, not a data-model change. The old Prisma migration history was dropped and replaced with a single fresh TypeORM initial migration, since no production data existed yet to preserve.
