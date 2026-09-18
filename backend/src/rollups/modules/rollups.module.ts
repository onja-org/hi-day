import { Module } from '@nestjs/common';
import { RollupService } from '../services/rollup.service';

@Module({
  providers: [RollupService],
  exports: [RollupService],
})
export class RollupsModule {}
