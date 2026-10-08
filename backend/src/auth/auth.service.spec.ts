import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcrypt';

const mockUser = {
  id: 'user-1',
  email: 'test@example.com',
  password: '$2b$12$hashedpassword',
  firstName: 'Test',
  lastName: 'User',
  role: 'USER',
  isActive: true,
  refreshToken: null,
};

describe('AuthService', () => {
  let service: AuthService;
  let usersService: jest.Mocked<UsersService>;
  let prismaService: jest.Mocked<PrismaService>;
  let jwtService: jest.Mocked<JwtService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: UsersService,
          useValue: {
            findByEmail: jest.fn(),
            findById: jest.fn(),
            create: jest.fn(),
          },
        },
        {
          provide: JwtService,
          useValue: {
            signAsync: jest.fn().mockResolvedValue('mock-token'),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              const config: Record<string, string> = {
                JWT_SECRET: 'test-secret',
                JWT_REFRESH_SECRET: 'test-refresh-secret',
                JWT_EXPIRES_IN: '15m',
                JWT_REFRESH_EXPIRES_IN: '7d',
              };
              return config[key];
            }),
          },
        },
        {
          provide: PrismaService,
          useValue: {
            user: {
              update: jest.fn(),
              findUnique: jest.fn(),
            },
            workspace: {
              create: jest.fn(),
            },
          },
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    usersService = module.get(UsersService);
    prismaService = module.get(PrismaService);
    jwtService = module.get(JwtService);
  });

  describe('register', () => {
    it('should throw ConflictException if email exists', async () => {
      usersService.findByEmail.mockResolvedValue(mockUser as any);
      await expect(
        service.register({
          firstName: 'Test',
          lastName: 'User',
          email: 'test@example.com',
          password: 'Password@123',
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('should create user and return tokens on success', async () => {
      usersService.findByEmail.mockResolvedValue(null);
      usersService.create.mockResolvedValue(mockUser as any);
      (prismaService.workspace as any).create.mockResolvedValue({});
      (prismaService.user as any).update.mockResolvedValue(mockUser);

      const result = await service.register({
        firstName: 'Test',
        lastName: 'User',
        email: 'test@example.com',
        password: 'Password@123',
      });

      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
      expect(result).toHaveProperty('user');
      expect(result.user).not.toHaveProperty('password');
    });
  });

  describe('login', () => {
    it('should throw UnauthorizedException for invalid email', async () => {
      usersService.findByEmail.mockResolvedValue(null);
      await expect(
        service.login({ email: 'wrong@example.com', password: 'pass' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException for wrong password', async () => {
      usersService.findByEmail.mockResolvedValue(mockUser as any);
      jest.spyOn(bcrypt, 'compare').mockResolvedValue(false as never);
      await expect(
        service.login({ email: 'test@example.com', password: 'wrong' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should return tokens and user on successful login', async () => {
      usersService.findByEmail.mockResolvedValue(mockUser as any);
      jest.spyOn(bcrypt, 'compare').mockResolvedValue(true as never);
      (prismaService.user as any).update.mockResolvedValue(mockUser);

      const result = await service.login({
        email: 'test@example.com',
        password: 'Password@123',
      });

      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('user');
      expect(result.user.email).toBe('test@example.com');
    });
  });

  describe('validateUser', () => {
    it('should return null for non-existent user', async () => {
      usersService.findByEmail.mockResolvedValue(null);
      const result = await service.validateUser('wrong@example.com', 'pass');
      expect(result).toBeNull();
    });

    it('should return user on valid credentials', async () => {
      usersService.findByEmail.mockResolvedValue(mockUser as any);
      jest.spyOn(bcrypt, 'compare').mockResolvedValue(true as never);
      const result = await service.validateUser('test@example.com', 'Password@123');
      expect(result).toEqual(mockUser);
    });
  });
});
