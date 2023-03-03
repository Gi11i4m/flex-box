import { Controller, Get } from '@nestjs/common';

@Controller('api')
export class ApiController {
  @Get('health')
  health() {
    // TODO: check adapter connectivity and return full status
    return 'OK';
  }
}
