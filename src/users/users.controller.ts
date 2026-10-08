import { Controller, Get, Patch, Body, Req, UseGuards, Query, Param, Delete } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('Users')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard)
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('profile')
  @ApiOperation({ summary: 'Get current user profile' })
  async getProfile(@Req() req: any) {
    return this.usersService.findById(req.user.id);
  }

  @Patch('profile')
  @ApiOperation({ summary: 'Update current user profile' })
  async updateProfile(@Req() req: any, @Body() body: any) {
    return this.usersService.updateProfile(req.user.id, body);
  }

  @Patch('change-password')
  @ApiOperation({ summary: 'Change user password' })
  async changePassword(@Req() req: any, @Body() body: any) {
    return this.usersService.changePassword(req.user.id, body.currentPassword, body.newPassword);
  }

  @Get('stats')
  @ApiOperation({ summary: 'Get user statistics' })
  async getStats(@Req() req: any) {
    return this.usersService.getStats(req.user.id);
  }
}
