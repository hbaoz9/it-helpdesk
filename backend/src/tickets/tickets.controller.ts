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
import { TicketQueryDto } from './dto/ticket-query.dto.js';
import { TicketsService } from './tickets.service.js';

@UseGuards(AuthGuard, RolesGuard)
@Controller('api/v1/tickets')
export class TicketsController {
  constructor(private readonly ticketsService: TicketsService) {}

  @Roles('REQUESTER', 'TECHNICIAN', 'SUPERVISOR', 'ADMIN')
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

  @Roles('REQUESTER', 'TECHNICIAN', 'SUPERVISOR', 'ADMIN')
  @Get(':id')
  findById(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
  ) {
    return this.ticketsService.findById(request.user, id);
  }
}
