import {
  ExecutionContext,
  InternalServerErrorException,
  createParamDecorator,
} from '@nestjs/common';
import { UsersModel } from '../entities/users.entity';

// Accesstoken Guard를 사용한 상태에서 사용할 수 있다고 가정
export const User = createParamDecorator(
  (data: keyof UsersModel | undefined, context: ExecutionContext) => {
    const req = context.switchToHttp().getRequest();

    const user = req.user as UsersModel;

    if (!user) {
      throw new InternalServerErrorException(
        'User 데코레이터는 AccessTokenGuard와 함께 사용하여야 합니다. Request에 user 프로퍼티가 존재하지 않습니다!',
      );
    }

    if (data) {
      return user[data];
    }

    return user;
  },
);
