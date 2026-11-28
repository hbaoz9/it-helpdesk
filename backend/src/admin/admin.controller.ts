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
import { AdminService } from './admin.service.js';
import {
  AdminAuditLogsQueryDto,
  AdminCategoriesQueryDto,
  AdminDevicesQueryDto,
  AdminUsersQueryDto,
  CreateAdminCategoryDto,
  CreateAdminUserDto,
  UpdateAdminCategoryDto,
  UpdateAdminDeviceDto,
  UpdateAdminUserDto,
  UpdateRustdeskConfigDto,
  UpdateSlaPolicyDto,
} from './dto/admin.dto.js';

@UseGuards(AuthGuard, RolesGuard)
@Roles('ADMIN')
@Controller('api/v1/admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('users')
  async listUsers(@Query() query: Record<string, unknown>) {
    const users = await this.adminService.listUsers(
      AdminUsersQueryDto.validate(query),
    );
    return { users };
  }

  @Post('users')
  async createUser(
    @Req() request: AuthenticatedRequest,
    @Body() body: unknown,
  ) {
    const user = await this.adminService.createUser(
      request.user,
      CreateAdminUserDto.validate(body),
    );
    return { user };
  }

  @Patch('users/:id')
  async updateUser(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    const user = await this.adminService.updateUser(
      request.user,
      id,
      UpdateAdminUserDto.validate(body),
    );
    return { user };
  }

  @Get('categories')
  async listCategories(@Query() query: Record<string, unknown>) {
    const categories = await this.adminService.listCategories(
      AdminCategoriesQueryDto.validate(query),
    );
    return { categories };
  }

  @Post('categories')
  async createCategory(
    @Req() request: AuthenticatedRequest,
    @Body() body: unknown,
  ) {
    const category = await this.adminService.createCategory(
      request.user,
      CreateAdminCategoryDto.validate(body),
    );
    return { category };
  }

  @Patch('categories/:id')
  async updateCategory(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    const category = await this.adminService.updateCategory(
      request.user,
      id,
      UpdateAdminCategoryDto.validate(body),
    );
    return { category };
  }

  @Get('sla-policies')
  async listSlaPolicies() {
    const slaPolicies = await this.adminService.listSlaPolicies();
    return { slaPolicies };
  }

  @Patch('sla-policies/:id')
  async updateSlaPolicy(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    const slaPolicy = await this.adminService.updateSlaPolicy(
      request.user,
      id,
      UpdateSlaPolicyDto.validate(body),
    );
    return { slaPolicy };
  }

  @Get('devices')
  async listDevices(@Query() query: Record<string, unknown>) {
    const devices = await this.adminService.listDevices(
      AdminDevicesQueryDto.validate(query),
    );
    return { devices };
  }

  @Patch('devices/:id')
  async updateDevice(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    const device = await this.adminService.updateDevice(
      request.user,
      id,
      UpdateAdminDeviceDto.validate(body),
    );
    return { device };
  }

  @Get('rustdesk-config')
  async getRustdeskConfig() {
    const config = await this.adminService.getRustdeskConfig();
    return { config };
  }

  @Patch('rustdesk-config')
  async updateRustdeskConfig(
    @Req() request: AuthenticatedRequest,
    @Body() body: unknown,
  ) {
    const config = await this.adminService.updateRustdeskConfig(
      request.user,
      UpdateRustdeskConfigDto.validate(body),
    );
    return { config };
  }

  @Get('audit-logs')
  async listAuditLogs(@Query() query: Record<string, unknown>) {
    const auditLogs = await this.adminService.listAuditLogs(
      AdminAuditLogsQueryDto.validate(query),
    );
    return { auditLogs };
  }
}
