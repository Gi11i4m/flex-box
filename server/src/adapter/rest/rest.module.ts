import { Module } from '@nestjs/common';
import { CoreModule } from 'src/core/core.module';
import { ApiController } from './api.controller';

@Module({
  imports: [CoreModule],
  controllers: [ApiController],
})
export class AdapterRestModule {}
