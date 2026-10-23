import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Query,
  UseGuards,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser, AuthenticatedUser } from '../auth/decorators/current-user.decorator';
import {
  UserRole,
  UserStatus,
  UpdateUserRole,
  UpdateUserRoleSchema,
  UpdateUserStatus,
  UpdateUserStatusSchema,
  AdminCreateUser,
  AdminCreateUserSchema,
  AdminUpdateUserDto,
  AdminUpdateUserSchema,
  UpdateProfileDto,
  UpdateProfileSchema,
} from '@healthclaim/shared';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';

@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  /**
   * Get currently logged-in user profile & quota
   */
  @Get('me')
  async getMyProfile(@CurrentUser() user: AuthenticatedUser) {
    return this.usersService.getCurrentUserProfile(user.id);
  }

  /**
   * Update self profile settings (Name, email, department, password)
   */
  @Patch('me')
  async updateMyProfile(
    @CurrentUser('id') userId: string,
    @Body(new ZodValidationPipe(UpdateProfileSchema)) dto: UpdateProfileDto,
  ) {
    return this.usersService.updateMyProfile(userId, dto);
  }

  /**
   * List all users (System Admin & Security Auditor)
   */
  @Get()
  @Roles(UserRole.SYSTEM_ADMIN, UserRole.SECURITY_AUDITOR)
  async getAllUsers(
    @Query('role') role?: UserRole,
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('status') status?: UserStatus,
  ) {
    return this.usersService.getAllUsers({
      role,
      status,
      search,
      page: page ? parseInt(page, 10) : undefined,
      pageSize: pageSize ? parseInt(pageSize, 10) : undefined,
    });
  }

  /**
   * Update user role (System Admin only)
   */
  @Patch(':id/role')
  @Roles(UserRole.SYSTEM_ADMIN)
  async updateUserRole(
    @Param('id') targetUserId: string,
    @Body(new ZodValidationPipe(UpdateUserRoleSchema)) dto: UpdateUserRole,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.usersService.updateUserRole(targetUserId, dto, actor.id);
  }

  /**
   * Update user account status (System Admin only)
   */
  @Patch(':id/status')
  @Roles(UserRole.SYSTEM_ADMIN)
  async updateUserStatus(
    @Param('id') targetUserId: string,
    @Body(new ZodValidationPipe(UpdateUserStatusSchema)) dto: UpdateUserStatus,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.usersService.updateUserStatus(targetUserId, dto, actor.id);
  }

  /**
   * Admin create new user
   */
  @Post()
  @Roles(UserRole.SYSTEM_ADMIN)
  async adminCreateUser(
    @Body(new ZodValidationPipe(AdminCreateUserSchema)) dto: AdminCreateUser,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.usersService.adminCreateUser(dto, actor.id);
  }

  /**
   * Comprehensive user profile and credentials update (Admin only)
   */
  @Patch(':id/admin-profile')
  @Roles(UserRole.SYSTEM_ADMIN)
  async adminUpdateUserProfile(
    @Param('id') targetUserId: string,
    @Body(new ZodValidationPipe(AdminUpdateUserSchema)) dto: AdminUpdateUserDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.usersService.adminUpdateUserProfile(targetUserId, dto, actor.id);
  }
}
