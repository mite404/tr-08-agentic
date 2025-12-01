import {
  pgTable,
  pgSchema,
  uniqueIndex,
  index,
  foreignKey,
  check,
  uuid,
  text,
  timestamp,
  jsonb,
  boolean,
  varchar,
  bigserial,
  pgPolicy,
  bigint,
  smallint,
  json,
  inet,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const auth = pgSchema("auth");
export const aalLevelInAuth = auth.enum("aal_level", ["aal1", "aal2", "aal3"]);
export const codeChallengeMethodInAuth = auth.enum("code_challenge_method", [
  "s256",
  "plain",
]);
export const factorStatusInAuth = auth.enum("factor_status", [
  "unverified",
  "verified",
]);
export const factorTypeInAuth = auth.enum("factor_type", [
  "totp",
  "webauthn",
  "phone",
]);
export const oauthAuthorizationStatusInAuth = auth.enum(
  "oauth_authorization_status",
  ["pending", "approved", "denied", "expired"],
);
export const oauthClientTypeInAuth = auth.enum("oauth_client_type", [
  "public",
  "confidential",
]);
export const oauthRegistrationTypeInAuth = auth.enum(
  "oauth_registration_type",
  ["dynamic", "manual"],
);
export const oauthResponseTypeInAuth = auth.enum("oauth_response_type", [
  "code",
]);
export const oneTimeTokenTypeInAuth = auth.enum("one_time_token_type", [
  "confirmation_token",
  "reauthentication_token",
  "recovery_token",
  "email_change_token_new",
  "email_change_token_current",
  "phone_change_token",
]);

export const ssoDomainsInAuth = auth.table(
  "sso_domains",
  {
    id: uuid().notNull(),
    ssoProviderId: uuid("sso_provider_id").notNull(),
    domain: text().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" }),
  },
  (table) => [
    uniqueIndex("sso_domains_domain_idx").using("btree", sql`lower(domain)`),
    index("sso_domains_sso_provider_id_idx").using(
      "btree",
      table.ssoProviderId.asc().nullsLast().op("uuid_ops"),
    ),
    foreignKey({
      columns: [table.ssoProviderId],
      foreignColumns: [ssoProvidersInAuth.id],
      name: "sso_domains_sso_provider_id_fkey",
    }).onDelete("cascade"),
    check("domain not empty", sql`char_length(domain) > 0`),
  ],
);

export const samlProvidersInAuth = auth.table(
  "saml_providers",
  {
    id: uuid().notNull(),
    ssoProviderId: uuid("sso_provider_id").notNull(),
    entityId: text("entity_id").notNull(),
    metadataXml: text("metadata_xml").notNull(),
    metadataUrl: text("metadata_url"),
    attributeMapping: jsonb("attribute_mapping"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" }),
    nameIdFormat: text("name_id_format"),
  },
  (table) => [
    index("saml_providers_sso_provider_id_idx").using(
      "btree",
      table.ssoProviderId.asc().nullsLast().op("uuid_ops"),
    ),
    foreignKey({
      columns: [table.ssoProviderId],
      foreignColumns: [ssoProvidersInAuth.id],
      name: "saml_providers_sso_provider_id_fkey",
    }).onDelete("cascade"),
    check("entity_id not empty", sql`char_length(entity_id) > 0`),
    check(
      "metadata_url not empty",
      sql`(metadata_url = NULL::text) OR (char_length(metadata_url) > 0)`,
    ),
    check("metadata_xml not empty", sql`char_length(metadata_xml) > 0`),
  ],
);

export const ssoProvidersInAuth = auth.table(
  "sso_providers",
  {
    id: uuid().notNull(),
    resourceId: text("resource_id"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" }),
    disabled: boolean(),
  },
  (table) => [
    uniqueIndex("sso_providers_resource_id_idx").using(
      "btree",
      sql`lower(resource_id)`,
    ),
    index("sso_providers_resource_id_pattern_idx").using(
      "btree",
      table.resourceId.asc().nullsLast().op("text_pattern_ops"),
    ),
    check(
      "resource_id not empty",
      sql`(resource_id = NULL::text) OR (char_length(resource_id) > 0)`,
    ),
  ],
);

export const instancesInAuth = auth.table("instances", {
  id: uuid().notNull(),
  uuid: uuid(),
  rawBaseConfig: text("raw_base_config"),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" }),
});

export const schemaMigrationsInAuth = auth.table("schema_migrations", {
  version: varchar({ length: 255 }).notNull(),
});

export const mfaFactorsInAuth = auth.table(
  "mfa_factors",
  {
    id: uuid().notNull(),
    userId: uuid("user_id").notNull(),
    friendlyName: text("friendly_name"),
    factorType: factorTypeInAuth("factor_type").notNull(),
    status: factorStatusInAuth().notNull(),
    createdAt: timestamp("created_at", {
      withTimezone: true,
      mode: "string",
    }).notNull(),
    updatedAt: timestamp("updated_at", {
      withTimezone: true,
      mode: "string",
    }).notNull(),
    secret: text(),
    phone: text(),
    lastChallengedAt: timestamp("last_challenged_at", {
      withTimezone: true,
      mode: "string",
    }),
    webAuthnCredential: jsonb("web_authn_credential"),
    webAuthnAaguid: uuid("web_authn_aaguid"),
    lastWebauthnChallengeData: jsonb("last_webauthn_challenge_data"),
  },
  (table) => [
    index("factor_id_created_at_idx").using(
      "btree",
      table.userId.asc().nullsLast().op("timestamptz_ops"),
      table.createdAt.asc().nullsLast().op("uuid_ops"),
    ),
    uniqueIndex("mfa_factors_user_friendly_name_unique")
      .using(
        "btree",
        table.friendlyName.asc().nullsLast().op("text_ops"),
        table.userId.asc().nullsLast().op("uuid_ops"),
      )
      .where(sql`(TRIM(BOTH FROM friendly_name) <> ''::text)`),
    index("mfa_factors_user_id_idx").using(
      "btree",
      table.userId.asc().nullsLast().op("uuid_ops"),
    ),
    uniqueIndex("unique_phone_factor_per_user").using(
      "btree",
      table.userId.asc().nullsLast().op("text_ops"),
      table.phone.asc().nullsLast().op("text_ops"),
    ),
    foreignKey({
      columns: [table.userId],
      foreignColumns: [usersInAuth.id],
      name: "mfa_factors_user_id_fkey",
    }).onDelete("cascade"),
  ],
);

export const refreshTokensInAuth = auth.table(
  "refresh_tokens",
  {
    instanceId: uuid("instance_id"),
    id: bigserial({ mode: "bigint" }).notNull(),
    token: varchar({ length: 255 }),
    userId: varchar("user_id", { length: 255 }),
    revoked: boolean(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" }),
    parent: varchar({ length: 255 }),
    sessionId: uuid("session_id"),
  },
  (table) => [
    index("refresh_tokens_instance_id_idx").using(
      "btree",
      table.instanceId.asc().nullsLast().op("uuid_ops"),
    ),
    index("refresh_tokens_instance_id_user_id_idx").using(
      "btree",
      table.instanceId.asc().nullsLast().op("text_ops"),
      table.userId.asc().nullsLast().op("text_ops"),
    ),
    index("refresh_tokens_parent_idx").using(
      "btree",
      table.parent.asc().nullsLast().op("text_ops"),
    ),
    index("refresh_tokens_session_id_revoked_idx").using(
      "btree",
      table.sessionId.asc().nullsLast().op("bool_ops"),
      table.revoked.asc().nullsLast().op("bool_ops"),
    ),
    index("refresh_tokens_updated_at_idx").using(
      "btree",
      table.updatedAt.desc().nullsFirst().op("timestamptz_ops"),
    ),
    foreignKey({
      columns: [table.sessionId],
      foreignColumns: [sessionsInAuth.id],
      name: "refresh_tokens_session_id_fkey",
    }).onDelete("cascade"),
  ],
);

export const usersInAuth = auth.table(
  "users",
  {
    instanceId: uuid("instance_id"),
    id: uuid().notNull(),
    aud: varchar({ length: 255 }),
    role: varchar({ length: 255 }),
    email: varchar({ length: 255 }),
    encryptedPassword: varchar("encrypted_password", { length: 255 }),
    emailConfirmedAt: timestamp("email_confirmed_at", {
      withTimezone: true,
      mode: "string",
    }),
    invitedAt: timestamp("invited_at", { withTimezone: true, mode: "string" }),
    confirmationToken: varchar("confirmation_token", { length: 255 }),
    confirmationSentAt: timestamp("confirmation_sent_at", {
      withTimezone: true,
      mode: "string",
    }),
    recoveryToken: varchar("recovery_token", { length: 255 }),
    recoverySentAt: timestamp("recovery_sent_at", {
      withTimezone: true,
      mode: "string",
    }),
    emailChangeTokenNew: varchar("email_change_token_new", { length: 255 }),
    emailChange: varchar("email_change", { length: 255 }),
    emailChangeSentAt: timestamp("email_change_sent_at", {
      withTimezone: true,
      mode: "string",
    }),
    lastSignInAt: timestamp("last_sign_in_at", {
      withTimezone: true,
      mode: "string",
    }),
    rawAppMetaData: jsonb("raw_app_meta_data"),
    rawUserMetaData: jsonb("raw_user_meta_data"),
    isSuperAdmin: boolean("is_super_admin"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" }),
    phone: text().default(sql`NULL`),
    phoneConfirmedAt: timestamp("phone_confirmed_at", {
      withTimezone: true,
      mode: "string",
    }),
    phoneChange: text("phone_change").default(""),
    phoneChangeToken: varchar("phone_change_token", { length: 255 }).default(
      "",
    ),
    phoneChangeSentAt: timestamp("phone_change_sent_at", {
      withTimezone: true,
      mode: "string",
    }),
    confirmedAt: timestamp("confirmed_at", {
      withTimezone: true,
      mode: "string",
    }).generatedAlwaysAs(sql`LEAST(email_confirmed_at, phone_confirmed_at)`),
    emailChangeTokenCurrent: varchar("email_change_token_current", {
      length: 255,
    }).default(""),
    emailChangeConfirmStatus: smallint("email_change_confirm_status").default(
      0,
    ),
    bannedUntil: timestamp("banned_until", {
      withTimezone: true,
      mode: "string",
    }),
    reauthenticationToken: varchar("reauthentication_token", {
      length: 255,
    }).default(""),
    reauthenticationSentAt: timestamp("reauthentication_sent_at", {
      withTimezone: true,
      mode: "string",
    }),
    isSsoUser: boolean("is_sso_user").default(false).notNull(),
    deletedAt: timestamp("deleted_at", { withTimezone: true, mode: "string" }),
    isAnonymous: boolean("is_anonymous").default(false).notNull(),
  },
  (table) => [
    uniqueIndex("confirmation_token_idx")
      .using("btree", table.confirmationToken.asc().nullsLast().op("text_ops"))
      .where(sql`((confirmation_token)::text !~ '^[0-9 ]*$'::text)`),
    uniqueIndex("email_change_token_current_idx")
      .using(
        "btree",
        table.emailChangeTokenCurrent.asc().nullsLast().op("text_ops"),
      )
      .where(sql`((email_change_token_current)::text !~ '^[0-9 ]*$'::text)`),
    uniqueIndex("email_change_token_new_idx")
      .using(
        "btree",
        table.emailChangeTokenNew.asc().nullsLast().op("text_ops"),
      )
      .where(sql`((email_change_token_new)::text !~ '^[0-9 ]*$'::text)`),
    uniqueIndex("reauthentication_token_idx")
      .using(
        "btree",
        table.reauthenticationToken.asc().nullsLast().op("text_ops"),
      )
      .where(sql`((reauthentication_token)::text !~ '^[0-9 ]*$'::text)`),
    uniqueIndex("recovery_token_idx")
      .using("btree", table.recoveryToken.asc().nullsLast().op("text_ops"))
      .where(sql`((recovery_token)::text !~ '^[0-9 ]*$'::text)`),
    uniqueIndex("users_email_partial_key")
      .using("btree", table.email.asc().nullsLast().op("text_ops"))
      .where(sql`(is_sso_user = false)`),
    index("users_instance_id_email_idx").using(
      "btree",
      sql`instance_id`,
      sql`lower((email)::text)`,
    ),
    index("users_instance_id_idx").using(
      "btree",
      table.instanceId.asc().nullsLast().op("uuid_ops"),
    ),
    index("users_is_anonymous_idx").using(
      "btree",
      table.isAnonymous.asc().nullsLast().op("bool_ops"),
    ),
    check(
      "users_email_change_confirm_status_check",
      sql`(email_change_confirm_status >= 0) AND (email_change_confirm_status <= 2)`,
    ),
  ],
);

export const auditLogEntriesInAuth = auth.table(
  "audit_log_entries",
  {
    instanceId: uuid("instance_id"),
    id: uuid().notNull(),
    payload: json(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }),
    ipAddress: varchar("ip_address", { length: 64 }).default("").notNull(),
  },
  (table) => [
    index("audit_logs_instance_id_idx").using(
      "btree",
      table.instanceId.asc().nullsLast().op("uuid_ops"),
    ),
  ],
);

export const samlRelayStatesInAuth = auth.table(
  "saml_relay_states",
  {
    id: uuid().notNull(),
    ssoProviderId: uuid("sso_provider_id").notNull(),
    requestId: text("request_id").notNull(),
    forEmail: text("for_email"),
    redirectTo: text("redirect_to"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" }),
    flowStateId: uuid("flow_state_id"),
  },
  (table) => [
    index("saml_relay_states_created_at_idx").using(
      "btree",
      table.createdAt.desc().nullsFirst().op("timestamptz_ops"),
    ),
    index("saml_relay_states_for_email_idx").using(
      "btree",
      table.forEmail.asc().nullsLast().op("text_ops"),
    ),
    index("saml_relay_states_sso_provider_id_idx").using(
      "btree",
      table.ssoProviderId.asc().nullsLast().op("uuid_ops"),
    ),
    foreignKey({
      columns: [table.flowStateId],
      foreignColumns: [flowStateInAuth.id],
      name: "saml_relay_states_flow_state_id_fkey",
    }).onDelete("cascade"),
    foreignKey({
      columns: [table.ssoProviderId],
      foreignColumns: [ssoProvidersInAuth.id],
      name: "saml_relay_states_sso_provider_id_fkey",
    }).onDelete("cascade"),
    check("request_id not empty", sql`char_length(request_id) > 0`),
  ],
);

export const mfaAmrClaimsInAuth = auth.table(
  "mfa_amr_claims",
  {
    sessionId: uuid("session_id").notNull(),
    createdAt: timestamp("created_at", {
      withTimezone: true,
      mode: "string",
    }).notNull(),
    updatedAt: timestamp("updated_at", {
      withTimezone: true,
      mode: "string",
    }).notNull(),
    authenticationMethod: text("authentication_method").notNull(),
    id: uuid().notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.sessionId],
      foreignColumns: [sessionsInAuth.id],
      name: "mfa_amr_claims_session_id_fkey",
    }).onDelete("cascade"),
  ],
);

export const flowStateInAuth = auth.table(
  "flow_state",
  {
    id: uuid().notNull(),
    userId: uuid("user_id"),
    authCode: text("auth_code").notNull(),
    codeChallengeMethod: codeChallengeMethodInAuth(
      "code_challenge_method",
    ).notNull(),
    codeChallenge: text("code_challenge").notNull(),
    providerType: text("provider_type").notNull(),
    providerAccessToken: text("provider_access_token"),
    providerRefreshToken: text("provider_refresh_token"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" }),
    authenticationMethod: text("authentication_method").notNull(),
    authCodeIssuedAt: timestamp("auth_code_issued_at", {
      withTimezone: true,
      mode: "string",
    }),
  },
  (table) => [
    index("flow_state_created_at_idx").using(
      "btree",
      table.createdAt.desc().nullsFirst().op("timestamptz_ops"),
    ),
    index("idx_auth_code").using(
      "btree",
      table.authCode.asc().nullsLast().op("text_ops"),
    ),
    index("idx_user_id_auth_method").using(
      "btree",
      table.userId.asc().nullsLast().op("uuid_ops"),
      table.authenticationMethod.asc().nullsLast().op("uuid_ops"),
    ),
  ],
);

export const identitiesInAuth = auth.table(
  "identities",
  {
    providerId: text("provider_id").notNull(),
    userId: uuid("user_id").notNull(),
    identityData: jsonb("identity_data").notNull(),
    provider: text().notNull(),
    lastSignInAt: timestamp("last_sign_in_at", {
      withTimezone: true,
      mode: "string",
    }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" }),
    email: text().generatedAlwaysAs(
      sql`lower((identity_data ->> 'email'::text))`,
    ),
    id: uuid().defaultRandom().notNull(),
  },
  (table) => [
    index("identities_email_idx").using(
      "btree",
      table.email.asc().nullsLast().op("text_pattern_ops"),
    ),
    index("identities_user_id_idx").using(
      "btree",
      table.userId.asc().nullsLast().op("uuid_ops"),
    ),
    foreignKey({
      columns: [table.userId],
      foreignColumns: [usersInAuth.id],
      name: "identities_user_id_fkey",
    }).onDelete("cascade"),
  ],
);

export const oneTimeTokensInAuth = auth.table(
  "one_time_tokens",
  {
    id: uuid().notNull(),
    userId: uuid("user_id").notNull(),
    tokenType: oneTimeTokenTypeInAuth("token_type").notNull(),
    tokenHash: text("token_hash").notNull(),
    relatesTo: text("relates_to").notNull(),
    createdAt: timestamp("created_at", { mode: "string" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("one_time_tokens_relates_to_hash_idx").using(
      "hash",
      table.relatesTo.asc().nullsLast().op("text_ops"),
    ),
    index("one_time_tokens_token_hash_hash_idx").using(
      "hash",
      table.tokenHash.asc().nullsLast().op("text_ops"),
    ),
    uniqueIndex("one_time_tokens_user_id_token_type_key").using(
      "btree",
      table.userId.asc().nullsLast().op("uuid_ops"),
      table.tokenType.asc().nullsLast().op("uuid_ops"),
    ),
    foreignKey({
      columns: [table.userId],
      foreignColumns: [usersInAuth.id],
      name: "one_time_tokens_user_id_fkey",
    }).onDelete("cascade"),
    check("one_time_tokens_token_hash_check", sql`char_length(token_hash) > 0`),
  ],
);

export const mfaChallengesInAuth = auth.table(
  "mfa_challenges",
  {
    id: uuid().notNull(),
    factorId: uuid("factor_id").notNull(),
    createdAt: timestamp("created_at", {
      withTimezone: true,
      mode: "string",
    }).notNull(),
    verifiedAt: timestamp("verified_at", {
      withTimezone: true,
      mode: "string",
    }),
    ipAddress: inet("ip_address").notNull(),
    otpCode: text("otp_code"),
    webAuthnSessionData: jsonb("web_authn_session_data"),
  },
  (table) => [
    index("mfa_challenge_created_at_idx").using(
      "btree",
      table.createdAt.desc().nullsFirst().op("timestamptz_ops"),
    ),
    foreignKey({
      columns: [table.factorId],
      foreignColumns: [mfaFactorsInAuth.id],
      name: "mfa_challenges_auth_factor_id_fkey",
    }).onDelete("cascade"),
  ],
);

export const oauthClientsInAuth = auth.table(
  "oauth_clients",
  {
    id: uuid().notNull(),
    clientSecretHash: text("client_secret_hash"),
    registrationType:
      oauthRegistrationTypeInAuth("registration_type").notNull(),
    redirectUris: text("redirect_uris").notNull(),
    grantTypes: text("grant_types").notNull(),
    clientName: text("client_name"),
    clientUri: text("client_uri"),
    logoUri: text("logo_uri"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
    deletedAt: timestamp("deleted_at", { withTimezone: true, mode: "string" }),
    clientType: oauthClientTypeInAuth("client_type")
      .default("confidential")
      .notNull(),
  },
  (table) => [
    index("oauth_clients_deleted_at_idx").using(
      "btree",
      table.deletedAt.asc().nullsLast().op("timestamptz_ops"),
    ),
    check(
      "oauth_clients_client_name_length",
      sql`char_length(client_name) <= 1024`,
    ),
    check(
      "oauth_clients_client_uri_length",
      sql`char_length(client_uri) <= 2048`,
    ),
    check("oauth_clients_logo_uri_length", sql`char_length(logo_uri) <= 2048`),
  ],
);

export const oauthConsentsInAuth = auth.table(
  "oauth_consents",
  {
    id: uuid().notNull(),
    userId: uuid("user_id").notNull(),
    clientId: uuid("client_id").notNull(),
    scopes: text().notNull(),
    grantedAt: timestamp("granted_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
    revokedAt: timestamp("revoked_at", { withTimezone: true, mode: "string" }),
  },
  (table) => [
    index("oauth_consents_active_client_idx")
      .using("btree", table.clientId.asc().nullsLast().op("uuid_ops"))
      .where(sql`(revoked_at IS NULL)`),
    index("oauth_consents_active_user_client_idx")
      .using(
        "btree",
        table.userId.asc().nullsLast().op("uuid_ops"),
        table.clientId.asc().nullsLast().op("uuid_ops"),
      )
      .where(sql`(revoked_at IS NULL)`),
    index("oauth_consents_user_order_idx").using(
      "btree",
      table.userId.asc().nullsLast().op("timestamptz_ops"),
      table.grantedAt.desc().nullsFirst().op("timestamptz_ops"),
    ),
    foreignKey({
      columns: [table.clientId],
      foreignColumns: [oauthClientsInAuth.id],
      name: "oauth_consents_client_id_fkey",
    }).onDelete("cascade"),
    foreignKey({
      columns: [table.userId],
      foreignColumns: [usersInAuth.id],
      name: "oauth_consents_user_id_fkey",
    }).onDelete("cascade"),
    check(
      "oauth_consents_revoked_after_granted",
      sql`(revoked_at IS NULL) OR (revoked_at >= granted_at)`,
    ),
    check("oauth_consents_scopes_length", sql`char_length(scopes) <= 2048`),
    check(
      "oauth_consents_scopes_not_empty",
      sql`char_length(TRIM(BOTH FROM scopes)) > 0`,
    ),
  ],
);

export const sessionsInAuth = auth.table(
  "sessions",
  {
    id: uuid().notNull(),
    userId: uuid("user_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" }),
    factorId: uuid("factor_id"),
    aal: aalLevelInAuth(),
    notAfter: timestamp("not_after", { withTimezone: true, mode: "string" }),
    refreshedAt: timestamp("refreshed_at", { mode: "string" }),
    userAgent: text("user_agent"),
    ip: inet(),
    tag: text(),
    oauthClientId: uuid("oauth_client_id"),
    refreshTokenHmacKey: text("refresh_token_hmac_key"),
    // You can use { mode: "bigint" } if numbers are exceeding js number limitations
    refreshTokenCounter: bigint("refresh_token_counter", { mode: "number" }),
    scopes: text(),
  },
  (table) => [
    index("sessions_not_after_idx").using(
      "btree",
      table.notAfter.desc().nullsFirst().op("timestamptz_ops"),
    ),
    index("sessions_oauth_client_id_idx").using(
      "btree",
      table.oauthClientId.asc().nullsLast().op("uuid_ops"),
    ),
    index("sessions_user_id_idx").using(
      "btree",
      table.userId.asc().nullsLast().op("uuid_ops"),
    ),
    index("user_id_created_at_idx").using(
      "btree",
      table.userId.asc().nullsLast().op("uuid_ops"),
      table.createdAt.asc().nullsLast().op("timestamptz_ops"),
    ),
    foreignKey({
      columns: [table.oauthClientId],
      foreignColumns: [oauthClientsInAuth.id],
      name: "sessions_oauth_client_id_fkey",
    }).onDelete("cascade"),
    foreignKey({
      columns: [table.userId],
      foreignColumns: [usersInAuth.id],
      name: "sessions_user_id_fkey",
    }).onDelete("cascade"),
    check("sessions_scopes_length", sql`char_length(scopes) <= 4096`),
  ],
);

export const oauthAuthorizationsInAuth = auth.table(
  "oauth_authorizations",
  {
    id: uuid().notNull(),
    authorizationId: text("authorization_id").notNull(),
    clientId: uuid("client_id").notNull(),
    userId: uuid("user_id"),
    redirectUri: text("redirect_uri").notNull(),
    scope: text().notNull(),
    state: text(),
    resource: text(),
    codeChallenge: text("code_challenge"),
    codeChallengeMethod: codeChallengeMethodInAuth("code_challenge_method"),
    responseType: oauthResponseTypeInAuth("response_type")
      .default("code")
      .notNull(),
    status: oauthAuthorizationStatusInAuth().default("pending").notNull(),
    authorizationCode: text("authorization_code"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true, mode: "string" })
      .default(sql`(now() + '00:03:00'::interval)`)
      .notNull(),
    approvedAt: timestamp("approved_at", {
      withTimezone: true,
      mode: "string",
    }),
    nonce: text(),
  },
  (table) => [
    index("oauth_auth_pending_exp_idx")
      .using("btree", table.expiresAt.asc().nullsLast().op("timestamptz_ops"))
      .where(sql`(status = 'pending'::auth.oauth_authorization_status)`),
    foreignKey({
      columns: [table.clientId],
      foreignColumns: [oauthClientsInAuth.id],
      name: "oauth_authorizations_client_id_fkey",
    }).onDelete("cascade"),
    foreignKey({
      columns: [table.userId],
      foreignColumns: [usersInAuth.id],
      name: "oauth_authorizations_user_id_fkey",
    }).onDelete("cascade"),
    check(
      "oauth_authorizations_authorization_code_length",
      sql`char_length(authorization_code) <= 255`,
    ),
    check(
      "oauth_authorizations_code_challenge_length",
      sql`char_length(code_challenge) <= 128`,
    ),
    check(
      "oauth_authorizations_expires_at_future",
      sql`expires_at > created_at`,
    ),
    check("oauth_authorizations_nonce_length", sql`char_length(nonce) <= 255`),
    check(
      "oauth_authorizations_redirect_uri_length",
      sql`char_length(redirect_uri) <= 2048`,
    ),
    check(
      "oauth_authorizations_resource_length",
      sql`char_length(resource) <= 2048`,
    ),
    check("oauth_authorizations_scope_length", sql`char_length(scope) <= 4096`),
    check("oauth_authorizations_state_length", sql`char_length(state) <= 4096`),
  ],
);

export const profiles = pgTable(
  "profiles",
  {
    id: uuid().primaryKey().notNull(),
    username: text(),
    avatarUrl: text("avatar_url"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.id],
      foreignColumns: [usersInAuth.id],
      name: "profiles_id_fkey",
    }).onDelete("cascade"),
    pgPolicy("Users can update their own profile", {
      as: "permissive",
      for: "update",
      to: ["public"],
      using: sql`(( SELECT auth.uid() AS uid) = id)`,
    }),
    pgPolicy("Public profiles are viewable by everyone", {
      as: "permissive",
      for: "select",
      to: ["public"],
    }),
  ],
);

export const beats = pgTable(
  "beats",
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    userId: uuid("user_id").notNull(),
    beatName: text("beat_name").notNull(),
    data: jsonb().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("idx_beats_updated_at").using(
      "btree",
      table.updatedAt.desc().nullsFirst().op("timestamptz_ops"),
    ),
    index("idx_beats_user_id").using(
      "btree",
      table.userId.asc().nullsLast().op("uuid_ops"),
    ),
    foreignKey({
      columns: [table.userId],
      foreignColumns: [usersInAuth.id],
      name: "beats_user_id_fkey",
    }).onDelete("cascade"),
    pgPolicy("Users can delete their own beats", {
      as: "permissive",
      for: "delete",
      to: ["public"],
      using: sql`(( SELECT auth.uid() AS uid) = user_id)`,
    }),
    pgPolicy("Users can update their own beats", {
      as: "permissive",
      for: "update",
      to: ["public"],
    }),
    pgPolicy("Users can create their own beats", {
      as: "permissive",
      for: "insert",
      to: ["public"],
    }),
    pgPolicy("Beats are public to view", {
      as: "permissive",
      for: "select",
      to: ["public"],
    }),
    check(
      "beats_beat_name_check",
      sql`(char_length(beat_name) <= 25) AND (char_length(beat_name) >= 1)`,
    ),
  ],
);
