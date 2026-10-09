import { createHmac, timingSafeEqual } from "node:crypto";
import { hash, verify } from "argon2";
import type { FastifyReply, FastifyRequest } from "fastify";
import { prisma } from "./prisma.js";
import { AppError } from "./errors.js";

const COOKIE_NAME = "admin_session";
const SESSION_DAYS = 7;

function sessionSecret() {
  return (
    process.env.ADMIN_SESSION_SECRET ||
    process.env.CRON_SECRET ||
    "dev-admin-session-secret-change-me"
  );
}

export async function hashPassword(password: string) {
  return hash(password);
}

export async function verifyPassword(passwordHash: string, password: string) {
  try {
    return await verify(passwordHash, password);
  } catch {
    return false;
  }
}

function sign(payload: string) {
  return createHmac("sha256", sessionSecret()).update(payload).digest("base64url");
}

export function createSessionCookieValue(adminId: string) {
  const exp = Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000;
  const payload = `${adminId}.${exp}`;
  return `${payload}.${sign(payload)}`;
}

export function parseSessionCookieValue(value?: string) {
  if (!value) return null;
  const parts = value.split(".");
  if (parts.length !== 3) return null;
  const [adminId, expRaw, signature] = parts;
  const payload = `${adminId}.${expRaw}`;
  const expected = sign(payload);
  const left = Buffer.from(signature);
  const right = Buffer.from(expected);
  if (left.length !== right.length || !timingSafeEqual(left, right)) return null;
  const exp = Number(expRaw);
  if (!Number.isFinite(exp) || exp < Date.now()) return null;
  return adminId;
}

export function setAdminSessionCookie(reply: FastifyReply, adminId: string) {
  reply.setCookie(COOKIE_NAME, createSessionCookieValue(adminId), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: process.env.NODE_ENV === "production",
    maxAge: SESSION_DAYS * 24 * 60 * 60,
  });
}

export function clearAdminSessionCookie(reply: FastifyReply) {
  reply.clearCookie(COOKIE_NAME, { path: "/" });
}

export async function requireAdmin(request: FastifyRequest) {
  const token = request.cookies?.[COOKIE_NAME];
  const adminId = parseSessionCookieValue(token);
  if (!adminId) {
    throw new AppError(401, "UNAUTHORIZED", "Нужна авторизация");
  }
  const admin = await prisma.adminUser.findUnique({ where: { id: adminId } });
  if (!admin) {
    throw new AppError(401, "UNAUTHORIZED", "Сессия недействительна");
  }
  return admin;
}

export { COOKIE_NAME };
