import { Configuration } from '@library/configuration/configuration';
import { Controller, Get, Logger, Post } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Controller('api')
export class ApiController {
  private readonly logger = new Logger(ApiController.name);

  constructor(private config: ConfigService) {}

  @Get('health')
  health() {
    // TODO: Gcal status
    // TODO: Super7 status
    return {
      config: this.config.get<Configuration>('config'),
    };
  }

  @Post()
  sync() {
    return 'We are syncing!';
  }
}
