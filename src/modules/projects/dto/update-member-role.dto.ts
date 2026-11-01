import { ApiProperty } from '@nestjs/swagger';
import { IsIn } from 'class-validator';
import { ASSIGNABLE_ROLES, ProjectRole } from '../project-role.enum.js';

export class UpdateMemberRoleDto {
  @ApiProperty({ enum: ASSIGNABLE_ROLES })
  @IsIn(ASSIGNABLE_ROLES)
  role: ProjectRole;
}
