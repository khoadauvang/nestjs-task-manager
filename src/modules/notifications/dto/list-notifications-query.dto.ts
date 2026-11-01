import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional } from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto.js';
import { toBoolean } from '../../../common/utils/transforms.js';

export class ListNotificationsQueryDto extends PaginationQueryDto {
  /** Only return notifications that have not been read. */
  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  unreadOnly: boolean = false;
}
