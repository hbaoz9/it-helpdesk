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
    return this.ticketsService.countRequested(request.user, TicketQueryDto.validate(query));
  }

  @Roles('REQUESTER', 'TECHNICIAN', 'SUPERVISOR')
  @Get(':id')
  findById(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
    @Query() query: Record<string, unknown>,
  ) {
    return this.ticketsService.findById(request.user, id, TicketQueryDto.validate(query).scope);
  }

  @Roles('REQUESTER')
  @Get(':id/activity')
  getRequesterActivity(@Req() request: AuthenticatedRequest, @Param('id') id: string) {
    return this.ticketsService.getRequesterActivity(request.user, id);
  }

  @Roles('REQUESTER')
  @Post(':id/comments')
  addRequesterComment(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() input: unknown,
  ) {
    return this.ticketsService.addRequesterComment(request.user, id, TicketCommentDto.validate(input));
  }

  @Roles('REQUESTER')
  @Post(':id/close')
  closeRequesterTicket(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() input: unknown,
  ) {
    return this.ticketsService.closeRequesterTicket(request.user, id, TicketActionDto.validate(input));
  }

  @Roles('REQUESTER')
  @Post(':id/reopen')
  reopenRequesterTicket(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() input: unknown,
  ) {
    return this.ticketsService.reopenRequesterTicket(request.user, id, TicketActionDto.validate(input, true));
  }
}
