import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { ProjectsModule } from '../projects/projects.module.js';
import { RealtimeGateway } from './realtime.gateway.js';

@Module({
  imports: [AuthModule, ProjectsModule],
  providers: [RealtimeGateway],
})
export class RealtimeModule {}
