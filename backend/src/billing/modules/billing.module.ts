import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtAuthModule } from '../../auth/modules/jwt-auth.module';
import { RoleGuard } from '../../common/guards/role.guard';
import { Membership } from '../../database/entities/membership.entity';
import { Organisation } from '../../database/entities/organisation.entity';
import { Subscription } from '../../database/entities/subscription.entity';
import { EmailModule } from '../../email/modules/email.module';
import { BillingController } from '../controllers/billing.controller';
import { StripeService } from '../services/stripe.service';
import { TrialService } from '../services/trial.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Subscription, Organisation, Membership]),
    JwtAuthModule,
    EmailModule,
  ],
  controllers: [BillingController],
  providers: [StripeService, TrialService, RoleGuard],
  exports: [StripeService, TrialService],
})
export class BillingModule {}
