import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBase64,
  IsEmail,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';

export const MAX_REPORT_RECIPIENTS = 10;
// Base64 text, not bytes: ~3 MB of file once decoded, which keeps the whole
// request under the app-wide 5 MB JSON body limit.
export const MAX_REPORT_CONTENT_LENGTH = 4_000_000;

export class SendReportDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(MAX_REPORT_RECIPIENTS)
  @IsEmail({}, { each: true })
  emails: string[];

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  subject: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  message?: string;

  @IsIn(['pdf', 'csv'])
  fileType: 'pdf' | 'csv';

  // Becomes the attachment's name, so no path characters.
  @IsString()
  @MaxLength(100)
  @Matches(/^[\w\- .]+\.(pdf|csv)$/i)
  filename: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(MAX_REPORT_CONTENT_LENGTH)
  @IsBase64()
  contentBase64: string;
}
