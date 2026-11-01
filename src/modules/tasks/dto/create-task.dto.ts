import { Transform } from 'class-transformer';
import {
  IsEnum,
  IsISO8601,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { trim } from '../../../common/utils/transforms.js';
import { TaskPriority, TaskStatus } from '../task.enums.js';

export class CreateTaskDto {
  /** @example "Write the API docs" */
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  title: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  description?: string | null;

  @IsOptional()
  @IsEnum(TaskStatus)
  status?: TaskStatus;

  @IsOptional()
  @IsEnum(TaskPriority)
  priority?: TaskPriority;

  /** ISO 8601 date-time. Send null to clear it. @example "2026-11-20T10:00:00.000Z" */
  @IsOptional()
  @IsISO8601({ strict: true })
  dueDate?: string | null;

  /** Must be a member of the project. Send null to unassign. */
  @IsOptional()
  @IsUUID()
  assigneeId?: string | null;
}
