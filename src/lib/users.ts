import bcrypt from "bcryptjs";
import { readCollection, writeCollection } from "@/lib/data-store";
import { Role, UserRecord } from "@/lib/review-types";

export type User = UserRecord;

function parseCoordinatorEmails() {
  return new Set(
    (process.env.COORDINATOR_EMAILS ?? "")
      .split(",")
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean)
  );
}

function normalizeRole(role: string | undefined): Role {
  if (!role) {
    return "MEMBER";
  }

  if (role === "COORDINATOR" || role === "MEMBER") {
    return role;
  }

  const lowerRole = role.toLowerCase();
  if (lowerRole === "admin" || lowerRole === "coordinator") {
    return "COORDINATOR";
  }
  return "MEMBER";
}

function normalizeUsers(users: UserRecord[]) {
  let changed = false;
  const normalized = users.map((user) => {
    const role = normalizeRole(user.role);
    const now = new Date().toISOString();
    const expertise = Array.isArray(user.expertise) ? user.expertise : [];
    const next: UserRecord = {
      ...user,
      email: user.email.toLowerCase(),
      role,
      slackId: user.slackId ?? null,
      expertise,
      createdAt: user.createdAt ?? now,
      updatedAt: user.updatedAt ?? user.createdAt ?? now,
    };

    if (
      next.role !== user.role ||
      next.email !== user.email ||
      next.slackId !== user.slackId ||
      next.expertise !== user.expertise ||
      next.createdAt !== user.createdAt ||
      next.updatedAt !== user.updatedAt
    ) {
      changed = true;
    }

    return next;
  });

  return { changed, normalized };
}

function readUsers(): UserRecord[] {
  const users = readCollection("users");
  const { changed, normalized } = normalizeUsers(users);
  if (changed) {
    writeCollection("users", normalized);
  }
  return normalized;
}

function writeUsers(users: UserRecord[]) {
  writeCollection("users", users);
}

function shouldDefaultCoordinator(email: string, existingUsers: UserRecord[]) {
  if (existingUsers.length === 0) {
    return true;
  }
  const coordinators = existingUsers.filter((user) => user.role === "COORDINATOR");
  if (coordinators.length === 0) {
    return true;
  }
  return parseCoordinatorEmails().has(email.toLowerCase());
}

export function listAllUsers() {
  return readUsers();
}

export function getUserById(id: string) {
  return readUsers().find((user) => user.id === id);
}

export function getUserByEmail(email: string) {
  return readUsers().find((user) => user.email === email.toLowerCase());
}

interface CreateUserInput {
  role?: Role;
}

export async function createUser(
  name: string,
  email: string,
  password: string,
  options: CreateUserInput = {}
) {
  const users = readUsers();
  const normalizedEmail = email.toLowerCase();
  if (users.some((user) => user.email === normalizedEmail)) {
    throw new Error("User with this email already exists");
  }

  const hashedPassword = await bcrypt.hash(password, 10);
  const timestamp = new Date().toISOString();
  const resolvedRole =
    options.role ??
    (shouldDefaultCoordinator(normalizedEmail, users) ? "COORDINATOR" : "MEMBER");

  const user: UserRecord = {
    id: crypto.randomUUID(),
    name: name.trim(),
    email: normalizedEmail,
    password: hashedPassword,
    role: resolvedRole,
    slackId: null,
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  users.push(user);
  writeUsers(users);
  return user;
}

interface UpdateUserInput {
  name?: string;
  role?: Role;
  slackId?: string | null;
  expertise?: string[];
}

export function updateUser(
  userId: string,
  input: UpdateUserInput
): UserRecord {
  const users = readUsers();
  let updatedUser: UserRecord | null = null;

  const updated = users.map((user) => {
    if (user.id !== userId) {
      return user;
    }

    updatedUser = {
      ...user,
      name: input.name?.trim() ?? user.name,
      role: input.role ?? user.role,
      slackId: input.slackId === undefined ? user.slackId : input.slackId,
      expertise:
        input.expertise === undefined
          ? user.expertise ?? []
          : input.expertise
              .map((tag) => tag.trim())
              .filter((tag) => tag.length > 0),
      updatedAt: new Date().toISOString(),
    };
    return updatedUser;
  });

  if (!updatedUser) {
    throw new Error("User not found");
  }

  writeUsers(updated);
  return updatedUser as UserRecord;
}

export function linkSlackAccount(userId: string, slackId: string) {
  const trimmedSlackId = slackId.trim();
  if (!trimmedSlackId) {
    throw new Error("Slack ID is required");
  }

  const users = readUsers();
  const collision = users.find(
    (user) => user.slackId?.toLowerCase() === trimmedSlackId.toLowerCase() && user.id !== userId
  );
  if (collision) {
    throw new Error("This Slack ID is already linked to another account");
  }

  return updateUser(userId, { slackId: trimmedSlackId });
}

export function removeSlackLink(userId: string) {
  return updateUser(userId, { slackId: null });
}

export function isCoordinator(user: Pick<UserRecord, "role"> | null | undefined) {
  return user?.role === "COORDINATOR";
}
