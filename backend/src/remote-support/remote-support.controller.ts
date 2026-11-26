import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard.js';
import type { AuthenticatedRequest } from '../auth/auth.types.js';
import { Roles } from '../auth/roles.decorator.js';
import { RolesGuard } from '../auth/roles.guard.js';
import {
  CancelRemoteSessionDto,
  CompleteRemoteSessionDto,
  CreateDeviceDto,
  FlagTicketRemoteSupportDto,
  NotificationsQueryDto,
  PushLiveFrameDto,
  RejectRemoteSessionDto,
  RemoteSessionsQueryDto,
  RequestRemoteSessionDto,
  SendRemoteInputDto,
  UpdateDeviceDto,
  UpdateLiveControlSettingsDto,
} from './dto/remote-support.dto.js';
import { RemoteSupportService } from './remote-support.service.js';

@UseGuards(AuthGuard, RolesGuard)
@Controller('api/v1/remote-support')
export class RemoteSupportController {
  constructor(private readonly remoteSupportService: RemoteSupportService) {}

  @Get('config')
  async getClientConfig() {
    const config = await this.remoteSupportService.getClientConfig();
    return { config };
  }

  @Roles('REQUESTER')
  @Get('devices/my')
  async listMyDevices(@Req() request: AuthenticatedRequest) {
    const devices = await this.remoteSupportService.listMyDevices(request.user);
    return { devices };
  }

  @Roles('REQUESTER')
  @Post('devices/my')
  async createMyDevice(
    @Req() request: AuthenticatedRequest,
    @Body() body: unknown,
  ) {
    const device = await this.remoteSupportService.createMyDevice(
      request.user,
      CreateDeviceDto.validate(body),
    );
    return { device };
  }

  @Roles('REQUESTER')
  @Patch('devices/my/:id')
  async updateMyDevice(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    const device = await this.remoteSupportService.updateMyDevice(
      request.user,
      id,
      UpdateDeviceDto.validate(body),
    );
    return { device };
  }

  @Roles('REQUESTER')
  @Patch('tickets/:ticketId/flag')
  async flagTicketRemoteSupport(
    @Req() request: AuthenticatedRequest,
    @Param('ticketId') ticketId: string,
    @Body() body: unknown,
  ) {
    return this.remoteSupportService.flagTicketRemoteSupport(
      request.user,
      ticketId,
      FlagTicketRemoteSupportDto.validate(body),
    );
  }

  @Roles('REQUESTER', 'TECHNICIAN', 'SUPERVISOR')
  @Get('tickets/:ticketId/sessions')
  async getTicketRemoteSupportContext(
    @Req() request: AuthenticatedRequest,
    @Param('ticketId') ticketId: string,
  ) {
    return this.remoteSupportService.getTicketRemoteSupportContext(
      request.user,
      ticketId,
    );
  }

  @Roles('TECHNICIAN')
  @Post('tickets/:ticketId/sessions')
  async requestSession(
    @Req() request: AuthenticatedRequest,
    @Param('ticketId') ticketId: string,
    @Body() body: unknown,
  ) {
    const session = await this.remoteSupportService.requestSession(
      request.user,
      ticketId,
      RequestRemoteSessionDto.validate(body),
    );
    return { session };
  }

  @Roles('REQUESTER')
  @Post('sessions/:id/approve')
  async approveSession(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
  ) {
    const session = await this.remoteSupportService.approveSession(
      request.user,
      id,
    );
    return { session };
  }

  @Roles('REQUESTER')
  @Post('sessions/:id/reject')
  async rejectSession(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    const session = await this.remoteSupportService.rejectSession(
      request.user,
      id,
      RejectRemoteSessionDto.validate(body),
    );
    return { session };
  }

  @Roles('TECHNICIAN')
  @Post('sessions/:id/start')
  async startSession(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
  ) {
    const session = await this.remoteSupportService.startSession(
      request.user,
      id,
    );
    return { session };
  }

  @Roles('REQUESTER', 'TECHNICIAN')
  @Post('sessions/:id/complete')
  async completeSession(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    const session = await this.remoteSupportService.completeSession(
      request.user,
      id,
      CompleteRemoteSessionDto.validate(body),
    );
    return { session };
  }

  @Roles('REQUESTER', 'TECHNICIAN', 'SUPERVISOR')
  @Post('sessions/:id/cancel')
  async cancelSession(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    const session = await this.remoteSupportService.cancelSession(
      request.user,
      id,
      CancelRemoteSessionDto.validate(body),
    );
    return { session };
  }

  @Roles('REQUESTER', 'TECHNICIAN', 'SUPERVISOR')
  @Get('sessions/:id/live')
  async getLiveSessionState(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
    @Query('consumeInputs') consumeInputs?: string,
  ) {
    const live = await this.remoteSupportService.getLiveSessionState(
      request.user,
      id,
      consumeInputs === 'true',
    );
    return { live };
  }

  @Roles('REQUESTER')
  @Patch('sessions/:id/live-settings')
  async updateLiveControlSettings(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    const live = await this.remoteSupportService.updateLiveControlSettings(
      request.user,
      id,
      UpdateLiveControlSettingsDto.validate(body),
    );
    return { live };
  }

  @Roles('REQUESTER')
  @Post('sessions/:id/live-frame')
  async pushLiveFrame(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    return this.remoteSupportService.pushLiveFrame(
      request.user,
      id,
      PushLiveFrameDto.validate(body),
    );
  }

  @Roles('TECHNICIAN')
  @Post('sessions/:id/live-input')
  async sendRemoteInput(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    return this.remoteSupportService.sendRemoteInput(
      request.user,
      id,
      SendRemoteInputDto.validate(body),
    );
  }

  @Roles('REQUESTER', 'TECHNICIAN', 'SUPERVISOR')
  @Get('sessions')
  async listSessions(
    @Req() request: AuthenticatedRequest,
    @Query() query: Record<string, unknown>,
  ) {
    return this.remoteSupportService.listSessions(
      request.user,
      RemoteSessionsQueryDto.validate(query),
    );
  }

  @Get('notifications')
  async listMyNotifications(
    @Req() request: AuthenticatedRequest,
    @Query() query: Record<string, unknown>,
  ) {
    return this.remoteSupportService.listMyNotifications(
      request.user,
      NotificationsQueryDto.validate(query),
    );
  }

  @Patch('notifications/read-all')
  async markAllNotificationsRead(@Req() request: AuthenticatedRequest) {
    return this.remoteSupportService.markAllNotificationsRead(request.user);
  }

  @Patch('notifications/:id/read')
  async markNotificationRead(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
  ) {
    const notification = await this.remoteSupportService.markNotificationRead(
      request.user,
      id,
    );
    return { notification };
  }
}
