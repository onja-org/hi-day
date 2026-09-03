import { IsOptional, IsUUID } from 'class-validator';

export class ListDevicesDto {
  @IsOptional()
  @IsUUID()
  userId?: string;
}
