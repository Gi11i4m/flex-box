import { Module } from '@nestjs/common';
import { AdapterRestModule } from '@adapter/rest/rest.module';
import { CoreModule } from '@core/core.module';
import { AdapterGoogleCalendarModule } from '@adapter/google-calendar/google-calendar.module';
import { AdapterSuper7Module } from '@adapter/super7/super7.module';
import { LibraryConfigurationModule } from '@library/configuration/configuration.module';

@Module({
  imports: [
    LibraryConfigurationModule,
    AdapterRestModule,
    AdapterGoogleCalendarModule,
    AdapterSuper7Module,
    CoreModule,
  ],
})
export class AppModule {}
