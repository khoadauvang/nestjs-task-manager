import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEmail, IsIn, IsOptional } from 'class-validator';
import { toLowerCaseTrimmed } from '../../../common/utils/transforms.js';
import { ASSIGNABLE_ROLES, ProjectRole } from '../project-role.enum.js';

export class AddMemberDto {
  /** Email of an existing user. @example "teammate@example.com" */
  @Transform(toLowerCaseTrimmed)
  @IsEmail()
  email: string;

  @ApiProperty({
    enum: ASSIGNABLE_ROLES,
    default: ProjectRole.MEMBER,
    required: false,
  })
  @IsOptional()
  @IsIn(ASSIGNABLE_ROLES)
  role: ProjectRole = ProjectRole.MEMBER;
}
