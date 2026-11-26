import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { AuthenticatedRequest } from '../auth/auth.types.js';
import { AuthGuard } from '../auth/auth.guard.js';
import { Roles } from '../auth/roles.decorator.js';
import { RolesGuard } from '../auth/roles.guard.js';
import {
  AssetCategoryDto,
  AssetQueryDto,
  AssetRecordsQueryDto,
  AssetStatusDto,
  AssignAssetDto,
  CreateAssetDto,
  CreateMaintenanceDto,
  ReturnAssetDto,
  UpdateAssetCategoryDto,
  UpdateAssetDto,
  UpdateMaintenanceDto,
} from './dto/asset.dto.js';
import { AssetsService } from './assets.service.js';

@UseGuards(AuthGuard, RolesGuard)
@Controller('api/v1/assets')
export class AssetsController {
  constructor(private readonly assetsService: AssetsService) {}

  @Roles('TECHNICIAN', 'SUPERVISOR', 'ADMIN')
  @Get('dashboard')
  dashboard(@Req() request: AuthenticatedRequest) {
    return this.assetsService.dashboard(request.user);
  }

  @Roles('REQUESTER', 'TECHNICIAN', 'SUPERVISOR', 'ADMIN')
  @Get('categories')
  categories(@Req() request: AuthenticatedRequest) {
    return this.assetsService.categories(request.user);
  }

  @Roles('ADMIN')
  @Post('categories')
  createCategory(@Req() request: AuthenticatedRequest, @Body() input: unknown) {
    return this.assetsService.createCategory(
      request.user,
      AssetCategoryDto.validate(input),
    );
  }

  @Roles('ADMIN')
  @Patch('categories/:categoryId')
  updateCategory(
    @Req() request: AuthenticatedRequest,
    @Param('categoryId') categoryId: string,
    @Body() input: unknown,
  ) {
    return this.assetsService.updateCategory(
      request.user,
      categoryId,
      UpdateAssetCategoryDto.validate(input),
    );
  }

  @Roles('ADMIN')
  @Delete('categories/:categoryId')
  deleteCategory(
    @Req() request: AuthenticatedRequest,
    @Param('categoryId') categoryId: string,
  ) {
    return this.assetsService.deleteCategory(request.user, categoryId);
  }

  @Roles('REQUESTER')
  @Get('my-assigned')
  myAssigned(@Req() request: AuthenticatedRequest) {
    return this.assetsService.myAssigned(request.user);
  }

  @Roles('REQUESTER')
  @Get('search-for-ticket')
  searchForTicket(
    @Req() request: AuthenticatedRequest,
    @Query() query: Record<string, unknown>,
  ) {
    return this.assetsService.searchForTicket(
      request.user,
      AssetQueryDto.validate(query),
    );
  }

  @Roles('TECHNICIAN', 'SUPERVISOR', 'ADMIN')
  @Get()
  findAll(
    @Req() request: AuthenticatedRequest,
    @Query() query: Record<string, unknown>,
  ) {
    return this.assetsService.findAll(
      request.user,
      AssetQueryDto.validate(query),
    );
  }

  @Roles('TECHNICIAN', 'SUPERVISOR', 'ADMIN')
  @Get('assignments')
  assignmentRecords(
    @Req() request: AuthenticatedRequest,
    @Query() query: Record<string, unknown>,
  ) {
    return this.assetsService.assignmentRecords(
      request.user,
      AssetRecordsQueryDto.validate(query),
    );
  }

  @Roles('TECHNICIAN', 'SUPERVISOR', 'ADMIN')
  @Get('maintenance')
  maintenanceRecords(
    @Req() request: AuthenticatedRequest,
    @Query() query: Record<string, unknown>,
  ) {
    return this.assetsService.maintenanceRecords(
      request.user,
      AssetRecordsQueryDto.validate(query),
    );
  }

  @Roles('TECHNICIAN', 'SUPERVISOR', 'ADMIN')
  @Get('history')
  historyRecords(
    @Req() request: AuthenticatedRequest,
    @Query() query: Record<string, unknown>,
  ) {
    return this.assetsService.historyRecords(
      request.user,
      AssetRecordsQueryDto.validate(query),
    );
  }

  @Roles('ADMIN')
  @Post()
  create(@Req() request: AuthenticatedRequest, @Body() input: unknown) {
    return this.assetsService.create(
      request.user,
      CreateAssetDto.validate(input),
    );
  }

  @Roles('ADMIN')
  @Patch(':id')
  update(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() input: unknown,
  ) {
    return this.assetsService.update(
      request.user,
      id,
      UpdateAssetDto.validate(input),
    );
  }

  @Roles('ADMIN')
  @Delete(':id')
  remove(@Req() request: AuthenticatedRequest, @Param('id') id: string) {
    return this.assetsService.remove(request.user, id);
  }

  @Roles('TECHNICIAN', 'SUPERVISOR', 'ADMIN')
  @Get(':id')
  findOne(@Req() request: AuthenticatedRequest, @Param('id') id: string) {
    return this.assetsService.findOne(request.user, id);
  }

  @Roles('ADMIN')
  @Patch(':id/status')
  setStatus(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() input: unknown,
  ) {
    return this.assetsService.setStatus(
      request.user,
      id,
      AssetStatusDto.validate(input),
    );
  }

  @Roles('SUPERVISOR', 'ADMIN')
  @Get(':id/assignments')
  assignments(@Req() request: AuthenticatedRequest, @Param('id') id: string) {
    return this.assetsService.assignments(request.user, id);
  }

  @Roles('ADMIN')
  @Post(':id/assign')
  assign(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() input: unknown,
  ) {
    return this.assetsService.assign(
      request.user,
      id,
      AssignAssetDto.validate(input),
    );
  }

  @Roles('ADMIN')
  @Post(':id/return')
  returnAsset(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() input: unknown,
  ) {
    return this.assetsService.returnAsset(
      request.user,
      id,
      ReturnAssetDto.validate(input),
    );
  }

  @Roles('TECHNICIAN', 'SUPERVISOR', 'ADMIN')
  @Get(':id/maintenance')
  maintenance(@Req() request: AuthenticatedRequest, @Param('id') id: string) {
    return this.assetsService.maintenance(request.user, id);
  }

  @Roles('TECHNICIAN', 'ADMIN')
  @Post(':id/maintenance')
  createMaintenance(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() input: unknown,
  ) {
    return this.assetsService.createMaintenance(
      request.user,
      id,
      CreateMaintenanceDto.validate(input),
    );
  }

  @Roles('TECHNICIAN', 'ADMIN')
  @Patch(':id/maintenance/:maintenanceId')
  updateMaintenance(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
    @Param('maintenanceId') maintenanceId: string,
    @Body() input: unknown,
  ) {
    return this.assetsService.updateMaintenance(
      request.user,
      id,
      maintenanceId,
      UpdateMaintenanceDto.validate(input),
    );
  }

  @Roles('TECHNICIAN', 'SUPERVISOR', 'ADMIN')
  @Get(':id/history')
  history(@Req() request: AuthenticatedRequest, @Param('id') id: string) {
    return this.assetsService.history(request.user, id);
  }
}
