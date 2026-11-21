import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { AuthenticatedRequest } from '../auth/auth.types.js';
import { AuthGuard } from '../auth/auth.guard.js';
import { Roles } from '../auth/roles.decorator.js';
import { RolesGuard } from '../auth/roles.guard.js';
import { CreateTicketDto } from './dto/create-ticket.dto.js';
import { TicketActionDto } from './dto/ticket-action.dto.js';
import { TicketCommentDto } from './dto/ticket-comment.dto.js';
import { TicketQueryDto } from './dto/ticket-query.dto.js';
import {
  AssignTicketDto,
  OverridePriorityDto,
  TriageTicketDto,
} from './dto/supervisor-ticket.dto.js';
import { TicketTextActionDto } from './dto/ticket-text-action.dto.js';
import { TicketsService } from './tickets.service.js';

@UseGuards(AuthGuard, RolesGuard)
@Controller('api/v1/tickets')
export class TicketsController {
  constructor(private readonly ticketsService: TicketsService) {}

  @Roles('REQUESTER', 'TECHNICIAN', 'SUPERVISOR')
  @Get()
  findAll(
    @Req() request: AuthenticatedRequest,
    @Query() query: Record<string, unknown>,
  ) {
    return this.ticketsService.findAll(
      request.user,
      TicketQueryDto.validate(query),
    );
  }

  @Roles('REQUESTER')
  @Post()
  create(@Req() request: AuthenticatedRequest, @Body() input: unknown) {
    return this.ticketsService.create(
      request.user,
      CreateTicketDto.validate(input),
    );
  }

  @Roles('REQUESTER')
  @Get('my/count')
  countRequested(
    @Req() request: AuthenticatedRequest,
    @Query() query: Record<string, unknown>,
  ) {
    return this.ticketsService.countRequested(
      request.user,
      TicketQueryDto.validate(query),
    );
  }

  @Roles('SUPERVISOR')
  @Get('supervisor/dashboard')
  getSupervisorDashboard(@Req() request: AuthenticatedRequest) {
    return this.ticketsService.getSupervisorDashboard(request.user);
  }

  @Roles('SUPERVISOR')
  @Get('supervisor/technicians')
  listTechnicians(@Req() request: AuthenticatedRequest) {
    return this.ticketsService.listTechnicians(request.user);
  }

  @Roles('TECHNICIAN')
  @Get('technician/summary')
  getTechnicianSummary(@Req() request: AuthenticatedRequest) {
    return this.ticketsService.getTechnicianSummary(request.user);
  }

  @Roles('REQUESTER', 'TECHNICIAN', 'SUPERVISOR')
  @Get(':id')
  findById(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
    @Query() query: Record<string, unknown>,
  ) {
    return this.ticketsService.findById(
      request.user,
      id,
      TicketQueryDto.validate(query).scope,
    );
  }

  @Roles('REQUESTER', 'TECHNICIAN', 'SUPERVISOR')
  @Get(':id/sla')
  getTicketSla(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
  ) {
    return this.ticketsService.getTicketSla(request.user, id);
  }

  @Roles('SUPERVISOR')
  @Get(':id/events')
  getSupervisorActivity(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
  ) {
    return this.ticketsService.getSupervisorTicketActivity(request.user, id);
  }

  @Roles('SUPERVISOR')
  @Post(':id/triage')
  triageTicket(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() input: unknown,
  ) {
    return this.ticketsService.triageTicket(
      request.user,
      id,
      TriageTicketDto.validate(input),
    );
  }

  @Roles('SUPERVISOR')
  @Post(':id/assign')
  assignTicket(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() input: unknown,
  ) {
    return this.ticketsService.assignTicket(
      request.user,
      id,
      AssignTicketDto.validate(input),
    );
  }

  @Roles('SUPERVISOR')
  @Post(':id/reject')
  rejectTicket(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() input: unknown,
  ) {
    return this.ticketsService.rejectTicket(
      request.user,
      id,
      TicketActionDto.validate(input, true),
    );
  }

  @Roles('SUPERVISOR')
  @Post(':id/override-priority')
  overridePriority(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() input: unknown,
  ) {
    return this.ticketsService.overridePriority(
      request.user,
      id,
      OverridePriorityDto.validate(input),
    );
  }

  @Roles('TECHNICIAN')
  @Get(':id/technician-activity')
  getTechnicianActivity(@Req() request: AuthenticatedRequest, @Param('id') id: string) {
    return this.ticketsService.getTechnicianActivity(request.user, id);
  }

  @Roles('TECHNICIAN')
  @Post(':id/start')
  startAssignedTicket(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() input: unknown,
  ) {
    return this.ticketsService.startAssignedTicket(request.user, id, TicketActionDto.validate(input));
  }

  @Roles('TECHNICIAN')
  @Post(':id/technician-comments')
  addTechnicianComment(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() input: unknown,
  ) {
    return this.ticketsService.addTechnicianComment(
      request.user, id, TicketTextActionDto.validate(input, 'Comment'),
    );
  }

  @Roles('TECHNICIAN')
  @Post(':id/notes')
  addTechnicianNote(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() input: unknown,
  ) {
    return this.ticketsService.addTechnicianNote(
      request.user, id, TicketTextActionDto.validate(input, 'Note'),
    );
  }

  @Roles('TECHNICIAN')
  @Post(':id/request-information')
  requestInformation(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() input: unknown,
  ) {
    return this.ticketsService.requestInformation(
      request.user, id, TicketTextActionDto.validate(input, 'Information request'),
    );
  }

  @Roles('TECHNICIAN')
  @Post(':id/resolve')
  resolveAssignedTicket(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() input: unknown,
  ) {
    return this.ticketsService.resolveAssignedTicket(
      request.user, id, TicketTextActionDto.validate(input, 'Resolution'),
    );
  }

  @Roles('REQUESTER')
  @Get(':id/activity')
  getRequesterActivity(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
  ) {
    return this.ticketsService.getRequesterActivity(request.user, id);
  }

  @Roles('REQUESTER')
  @Post(':id/comments')
  addRequesterComment(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() input: unknown,
  ) {
    return this.ticketsService.addRequesterComment(
      request.user,
      id,
      TicketCommentDto.validate(input),
    );
  }

  @Roles('REQUESTER')
  @Post(':id/close')
  closeRequesterTicket(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() input: unknown,
  ) {
    return this.ticketsService.closeRequesterTicket(
      request.user,
      id,
      TicketActionDto.validate(input),
    );
  }

  @Roles('REQUESTER')
  @Post(':id/reopen')
  reopenRequesterTicket(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() input: unknown,
  ) {
    return this.ticketsService.reopenRequesterTicket(
      request.user,
      id,
      TicketActionDto.validate(input, true),
    );
  }
}
