import { getIronSession, SessionOptions } from 'iron-session';
import { cookies } from 'next/headers';

export interface SessionData {
  isAuthenticated: boolean;
  authenticatedAt?: number;
}

const sessionOptions: SessionOptions = {
  password: process.env.CLAWDIFY_SESSION_SECRET || 'complex_password_at_least_32_characters_long',
  cookieName: 'clawdify_session',
  cookieOptions: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    sameSite: 'strict' as const,
    maxAge: parseInt(process.env.CLAWDIFY_SESSION_MAX_AGE || '604800', 10), // 7 days default
  },
};

export async function getSession() {
  const cookieStore = await cookies();
  const session = await getIronSession<SessionData>(cookieStore, sessionOptions);
  return session;
}

export async function isAuthenticated(): Promise<boolean> {
  const session = await getSession();
  return session.isAuthenticated === true;
}

export async function authenticate() {
  const session = await getSession();
  session.isAuthenticated = true;
  session.authenticatedAt = Date.now();
  await session.save();
}

export async function logout() {
  const session = await getSession();
  session.destroy();
}
