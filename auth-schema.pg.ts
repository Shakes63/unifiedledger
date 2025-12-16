import { sql } from "drizzle-orm";
import { pgTable, text, boolean, bigint } from "drizzle-orm/pg-core";

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified")
    .default(false)
    .notNull(),
  pendingEmail: text("pending_email"),
  image: text("image"),
  imageUpdatedAt: bigint("image_updated_at", { mode: "number" }),
  twoFactorEnabled: boolean("two_factor_enabled")
    .default(false)
    .notNull(),
  twoFactorSecret: text("two_factor_secret"),
  twoFactorBackupCodes: text("two_factor_backup_codes"), // JSON array of hashed codes
  twoFactorVerifiedAt: bigint("two_factor_verified_at", { mode: "number" }),
  isApplicationOwner: boolean("is_application_owner")
    .default(false)
    .notNull(),
  createdAt: bigint("created_at", { mode: "number" })
    .default(sql`(cast(extract(epoch from now()) * 1000 as bigint))`)
    .notNull(),
  updatedAt: bigint("updated_at", { mode: "number" })
    .default(sql`(cast(extract(epoch from now()) * 1000 as bigint))`)
    .$onUpdate(() => /* @__PURE__ */ new Date())
    .notNull(),
});

export const session = pgTable("session", {
  id: text("id").primaryKey(),
  expiresAt: bigint("expires_at", { mode: "number" }).notNull(),
  token: text("token").notNull().unique(),
  createdAt: bigint("created_at", { mode: "number" })
    .default(sql`(cast(extract(epoch from now()) * 1000 as bigint))`)
    .notNull(),
  updatedAt: bigint("updated_at", { mode: "number" })
    .$onUpdate(() => /* @__PURE__ */ new Date())
    .notNull(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  city: text("city"),
  region: text("region"),
  country: text("country"),
  countryCode: text("country_code"),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  lastActivityAt: bigint("last_activity_at", { mode: "number" })
    .default(sql`(cast(extract(epoch from now()) * 1000 as bigint))`)
    .notNull(),
  rememberMe: boolean("remember_me")
    .default(false)
    .notNull(),
});

export const account = pgTable("account", {
  id: text("id").primaryKey(),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: bigint("access_token_expires_at", { mode: "number" }),
  refreshTokenExpiresAt: bigint("refresh_token_expires_at", { mode: "number" }),
  scope: text("scope"),
  password: text("password"),
  createdAt: bigint("created_at", { mode: "number" })
    .default(sql`(cast(extract(epoch from now()) * 1000 as bigint))`)
    .notNull(),
  updatedAt: bigint("updated_at", { mode: "number" })
    .$onUpdate(() => /* @__PURE__ */ new Date())
    .notNull(),
});

export const verification = pgTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: bigint("expires_at", { mode: "number" }).notNull(),
  createdAt: bigint("created_at", { mode: "number" })
    .default(sql`(cast(extract(epoch from now()) * 1000 as bigint))`)
    .notNull(),
  updatedAt: bigint("updated_at", { mode: "number" })
    .default(sql`(cast(extract(epoch from now()) * 1000 as bigint))`)
    .$onUpdate(() => /* @__PURE__ */ new Date())
    .notNull(),
});
