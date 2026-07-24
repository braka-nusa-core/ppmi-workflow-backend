import 'express';

declare module 'express' {
  export interface Request {
    fullurl: string;
    credentials: { sub: string; fullname: string; role: 'SUPERADMIN' | 'USER' };
  }
}
