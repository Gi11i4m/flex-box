import { Module } from '@nestjs/common';
import { EventMatcherService } from './event/event-matcher.service';

@Module({
  providers: [EventMatcherService],
})
export class CoreModule {}
