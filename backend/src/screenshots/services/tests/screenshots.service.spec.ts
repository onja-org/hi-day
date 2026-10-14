import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { Membership } from '../../../database/entities/membership.entity';
import { MembershipRole } from '../../../database/entities/membership-role.enum';
import { Screenshot } from '../../../database/entities/screenshot.entity';
import { OrganisationsService } from '../../../organisations/services/organisations.service';
import { TimeEntriesService } from '../../../time-entries/services/time-entries.service';
import { ScreenshotStorageService } from '../screenshot-storage.service';
import { ScreenshotsService } from '../screenshots.service';

describe('ScreenshotsService deleteScreenshot', () => {
  const SHOT = {
    id: 'shot-1',
    membershipId: 'm-owner',
    storageKey: 'screenshots/org-1/device-1/a.jpg',
  } as Screenshot;

  function makeService(
    caller: Partial<Membership>,
    orgAllows: boolean,
    shot: Screenshot | null = SHOT,
  ) {
    const remove = jest.fn().mockResolvedValue({ affected: 1 });
    const deleteObjects = jest.fn().mockResolvedValue(undefined);
    const service = new ScreenshotsService(
      {
        findOne: jest.fn().mockResolvedValue(shot),
        delete: remove,
      } as unknown as Repository<Screenshot>,
      {
        findOne: jest.fn().mockResolvedValue(caller),
      } as unknown as Repository<Membership>,
      {
        membersCanDeleteScreenshots: jest.fn().mockResolvedValue(orgAllows),
      } as unknown as OrganisationsService,
      { deleteObjects } as unknown as ScreenshotStorageService,
      {} as unknown as TimeEntriesService,
    );
    return { service, remove, deleteObjects };
  }

  it("lets an admin delete anyone's", async () => {
    const { service, remove, deleteObjects } = makeService(
      { id: 'm-admin', role: MembershipRole.ADMIN },
      false,
    );

    await service.deleteScreenshot('org-1', 'user-1', 'shot-1');

    expect(remove).toHaveBeenCalledWith({ id: 'shot-1' });
    expect(deleteObjects).toHaveBeenCalledWith([SHOT.storageKey]);
  });

  it('lets a member delete their own once the organisation allows it', async () => {
    const { service, remove } = makeService(
      {
        id: 'm-owner',
        role: MembershipRole.MEMBER,
        canDeleteScreenshots: null,
      },
      true,
    );

    await service.deleteScreenshot('org-1', 'user-1', 'shot-1');

    expect(remove).toHaveBeenCalled();
  });

  it('refuses a member while the organisation does not', async () => {
    const { service, remove } = makeService(
      {
        id: 'm-owner',
        role: MembershipRole.MEMBER,
        canDeleteScreenshots: null,
      },
      false,
    );

    await expect(
      service.deleteScreenshot('org-1', 'user-1', 'shot-1'),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(remove).not.toHaveBeenCalled();
  });

  it("refuses someone else's screenshot even when allowed", async () => {
    const { service, remove } = makeService(
      {
        id: 'm-other',
        role: MembershipRole.MEMBER,
        canDeleteScreenshots: true,
      },
      true,
    );

    await expect(
      service.deleteScreenshot('org-1', 'user-1', 'shot-1'),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(remove).not.toHaveBeenCalled();
  });

  it("lets a member's own override beat an organisation that forbids it", async () => {
    const { service, remove } = makeService(
      {
        id: 'm-owner',
        role: MembershipRole.MEMBER,
        canDeleteScreenshots: true,
      },
      false,
    );

    await service.deleteScreenshot('org-1', 'user-1', 'shot-1');

    expect(remove).toHaveBeenCalled();
  });

  it('404s for a screenshot that is not there', async () => {
    const { service } = makeService(
      { id: 'm-admin', role: MembershipRole.ADMIN },
      true,
      null,
    );

    await expect(
      service.deleteScreenshot('org-1', 'user-1', 'missing'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
