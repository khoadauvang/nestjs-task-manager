import { PartialType } from '@nestjs/swagger';
import { CreateProjectDto } from './create-project.dto.js';

/** Same rules as CreateProjectDto, every field optional. */
export class UpdateProjectDto extends PartialType(CreateProjectDto) {}
