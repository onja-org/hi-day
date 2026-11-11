import {
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { AuthenticatedRequest } from '../../auth/jwt-auth.guard';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { RequireRole } from '../../common/decorators/require-role.decorator';
import { RoleGuard } from '../../common/guards/role.guard';
import { MembershipRole } from '../../database/entities/membership-role.enum';
import { ListScreenshotSlotsDto } from '../dto/list-screenshot-slots.dto';
import { ListScreenshotsDto } from '../dto/list-screenshots.dto';
import type {
  ScreenshotSlotsDay,
  ScreenshotsPage,
} from '../services/screenshots.service';
import { ScreenshotsService } from '../services/screenshots.service';

@Controller('organisations/:id/screenshots')
@UseGuards(JwtAuthGuard, RoleGuard)
@RequireRole(
  MembershipRole.ADMIN,
  MembershipRole.MANAGER,
  MembershipRole.MEMBER,
)
export class ScreenshotsController {
  constructor(private readonly screenshotsService: ScreenshotsService) {}

  /** Who may delete what is decided in the service — an admin anyone's,
   * everyone else their own and only where the Organisation allows it. */
  @Delete(':screenshotId')
  @HttpCode(204)
  remove(
    @Param('screenshotId') screenshotId: string,
    @Req() request: AuthenticatedRequest,
  ): Promise<void> {
    return this.screenshotsService.deleteScreenshot(
      request.organisationId!,
      request.userId,
      screenshotId,
    );
  }

  /** The 10-minute view of the caller's own day. */
  @Get('slots/mine')
  getMySlots(
    @Query() query: ListScreenshotSlotsDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<ScreenshotSlotsDay> {
    return this.screenshotsService.getMySlots(
      request.organisationId!,
      request.userId,
      query.date,
      { projectId: query.projectId },
      { page: query.page, pageSize: query.pageSize },
    );
  }

  @Get('mine')
  getMine(
    @Query() query: ListScreenshotsDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<ScreenshotsPage> {
    return this.screenshotsService.getMyScreenshots(
      request.organisationId!,
      request.userId,
      query.date,
      { projectId: query.projectId },
      {
        page: query.page,
        pageSize: query.pageSize,
        newestFirst: query.order === 'newest',
      },
    );
  }
}
