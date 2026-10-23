import { setDefaultResultOrder } from 'node:dns';
import { setDefaultAutoSelectFamily } from 'node:net';
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { json, raw, urlencoded } from 'express';
import { AppModule } from './app.module';

setDefaultResultOrder('ipv4first');
setDefaultAutoSelectFamily(false);

const REQUEST_BODY_SIZE_LIMIT = '5mb';

/**
 * Stripe signs the exact bytes it sent, so this one route must see the body
 * unparsed. Mounted before `json()`, which would otherwise consume it and
 * leave nothing to verify the signature against.
 */
const STRIPE_WEBHOOK_PATH = '/billing/webhook';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bodyParser: false });
  app.use(STRIPE_WEBHOOK_PATH, raw({ type: 'application/json' }));
  app.use(json({ limit: REQUEST_BODY_SIZE_LIMIT }));
  app.use(urlencoded({ limit: REQUEST_BODY_SIZE_LIMIT, extended: true }));
  const configService = app.get(ConfigService);

  app.enableCors({
    origin: configService.get<string>('CORS_ORIGIN', 'http://localhost:3000'),
    credentials: true,
  });

  await app.listen(configService.get<number>('PORT', 3001));
}
void bootstrap();
