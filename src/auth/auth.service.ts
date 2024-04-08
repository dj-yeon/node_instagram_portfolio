import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { HASH_ROUNDS, JWT_SECRET } from './const/auth.const';
import { UsersModel } from 'src/users/entities/users.entity';
import * as bcrypt from 'bcrypt';
import { UsersService } from '../users/users.service';
import { RegisterUserDto } from './dto/register-user.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly usersService: UsersService,
  ) {}
  /**
   * 1) registerWithEmail
   *    - Takes email, nickname, and password as inputs to create a 'User'.
   *    - Returns an accessToken and a refreshToken.
   *    (Note: After 'signing up', there is no need to log in again.)
   *
   * 2) loginWithEmail
   *    - Verifies a user using their email and password.
   *    - Returns an accessToken and a refreshToken.
   *
   * 3) loginUser
   *    - Logic to return the accessToken and refreshToken required in  1) and 2).
   *
   * 4) signToken
   *    - Logic to sign the accessToken and refreshToken required in 3).
   *
   * 5) authenticateWithEmailAndPassword
   *    - Basic verification process required when proceeding with a login in 2).
   *    1. Verifies if the user exists (by email).
   *    2. Checks if the password is correct.
   *    3. If all checks pass, returns the found user information.
   *    4. Generates tokens based on the data returned from loginWithEmail.
   */

  /**
   * information in 'Payload'
   *
   * 1) email
   * 2) sub data -> id
   * 3) type: 'access' | 'refresh'
   *
   */

  // JWT_SECRET: customized charcter set(개인화한 비밀번호 생성을 위한 키(?)
  signToken(user: Pick<UsersModel, 'email' | 'id'>, isRefreshToken: boolean) {
    const payload = {
      email: user.email,
      sub: user.id,
      type: isRefreshToken ? 'refresh' : 'access',
    };

    return this.jwtService.sign(payload, {
      secret: JWT_SECRET,
      expiresIn: isRefreshToken ? 3600 : 300,
    });
  }

  loginUser(user: Pick<UsersModel, 'email' | 'id'>) {
    return {
      accessToken: this.signToken(user, false),
      refreshToken: this.signToken(user, true),
    };
  }

  async authenticateWithEmailAndPassword(
    user: Pick<UsersModel, 'email' | 'password'>,
  ) {
    const existingUser = await this.usersService.getUserByEmail(user.email);

    if (!existingUser) {
      throw new UnauthorizedException();
    }

    /**
     *  Parameter
     *
     *  1) 입력된 비밀번호
     *  2) 기존 해시 ( hash ) -> 사용자 정보에 저장돼있는 hash
     */

    const passOk = await bcrypt.compare(user.password, existingUser.password);

    if (!passOk) {
      throw new UnauthorizedException('비밀번호가 틀렸습니다.');
    }

    return existingUser;
  }

  async loginWithEmail(user: Pick<UsersModel, 'email' | 'password'>) {
    const existingUser = await this.authenticateWithEmailAndPassword(user);

    return this.loginUser(existingUser);
  }

  async registerWithEmail(user: RegisterUserDto) {
    // 비밀번호를 hash_rounds만큼 해쉬 돌린다.
    const hash = await bcrypt.hash(user.password, HASH_ROUNDS);

    const newUser = await this.usersService.createUser({
      ...user,
      password: hash,
    });

    return this.loginUser(newUser);
  }

  /**
   * Header로 부터 토큰을 받을 때
   *
   * {authorization: 'Basic {token}'}
   * {authorization: 'Bearer {token}'}
   *
   */

  extractTokenFromHeader(header: string, isBearer: boolean) {
    const splitToken = header.split(' ');

    const prefix = isBearer ? 'Bearer' : 'Basic';

    // prefix로 시작하지 않는다면
    if (splitToken.length !== 2 || splitToken[0] !== prefix) {
      throw new UnauthorizedException('wrong token!');
    }

    const token = splitToken[1];

    return token;
  }

  /**
   * Basic asdfoiwefe(base64 characters)
   *
   * 1) asdfoiwefe(base64 characters) -> email:password
   * 2) email:password -> [email, password]
   * 3) {email: email, password: password}
   */

  decodeBasicToken(base64String: string) {
    const decode = Buffer.from(base64String, 'base64').toString('utf8');

    const split = decode.split(':');

    if (split.length !== 2) {
      throw new UnauthorizedException('wrong token!');
    }

    const email = split[0];
    const password = split[1];

    return {
      email,
      password,
    };
  }

  // 토큰 검증, secret을 가지고 token을 검증한다
  verifyToken(token: string) {
    try {
      return this.jwtService.verify(token, {
        secret: JWT_SECRET,
      });
    } catch (e) {
      throw new UnauthorizedException(
        '토큰이 만료되었거나, 잘못된 토큰입니다.',
      );
    }
  }

  // refreshtoken - 로그인 갱신
  // refreshtoken도 refreshtoken으로 갱신할 수 있다고 가정
  rotateToken(token: string, isRefreshToken: boolean) {
    const decoded = this.jwtService.verify(token, {
      secret: JWT_SECRET,
    });

    /**
     * payload에 들어있는 항목
     * == decoded에 들어있는 항목
     *
     * sub: id
     * email: email,
     * type: 'access' | 'refresh'
     */

    if (decoded.type !== 'refresh') {
      throw new UnauthorizedException('토큰 재발급은 Refresh 토큰으로만 가능!');
    }

    return this.signToken(
      {
        ...decoded,
      },
      isRefreshToken,
    );
  }
}
