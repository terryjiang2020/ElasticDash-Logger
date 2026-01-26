import { env } from "@/src/env.mjs";
import { createUserEmailPassword } from "@/src/features/auth-credentials/lib/credentialsServerUtils";
import { prisma } from "@langfuse/shared/src/db";
import { createAndAddApiKeysToDb } from "@langfuse/shared/src/server/auth/apiKeys";
import { hasEntitlementBasedOnPlan } from "@/src/features/entitlements/server/hasEntitlement";
import { getOrganizationPlanServerSide } from "@/src/features/entitlements/server/getPlan";
import { CloudConfigSchema } from "@langfuse/shared";
import { logger } from "@langfuse/shared/src/server";

// Warn if ELASTICDASH_INIT_* variables are set but ELASTICDASH_INIT_ORG_ID is missing
if (!env.ELASTICDASH_INIT_ORG_ID) {
  const setInitVars = [
    env.ELASTICDASH_INIT_ORG_NAME && "ELASTICDASH_INIT_ORG_NAME",
    env.ELASTICDASH_INIT_ORG_CLOUD_PLAN && "ELASTICDASH_INIT_ORG_CLOUD_PLAN",
    env.ELASTICDASH_INIT_PROJECT_ID && "ELASTICDASH_INIT_PROJECT_ID",
    env.ELASTICDASH_INIT_PROJECT_NAME && "ELASTICDASH_INIT_PROJECT_NAME",
    env.ELASTICDASH_INIT_PROJECT_RETENTION &&
      "ELASTICDASH_INIT_PROJECT_RETENTION",
    env.ELASTICDASH_INIT_PROJECT_PUBLIC_KEY &&
      "ELASTICDASH_INIT_PROJECT_PUBLIC_KEY",
    env.ELASTICDASH_INIT_PROJECT_SECRET_KEY &&
      "ELASTICDASH_INIT_PROJECT_SECRET_KEY",
    env.ELASTICDASH_INIT_USER_EMAIL && "ELASTICDASH_INIT_USER_EMAIL",
    env.ELASTICDASH_INIT_USER_NAME && "ELASTICDASH_INIT_USER_NAME",
    env.ELASTICDASH_INIT_USER_PASSWORD && "ELASTICDASH_INIT_USER_PASSWORD",
  ].filter(Boolean) as string[];

  if (setInitVars.length > 0) {
    logger.warn(
      `[ElasticDash Init] ELASTICDASH_INIT_ORG_ID is not set but other ELASTICDASH_INIT_* variables are configured. ` +
        `The following variables will be ignored: ${setInitVars.join(", ")}. ` +
        `Set ELASTICDASH_INIT_ORG_ID to enable initialization.`,
    );
  }
}

// Create Organization
if (env.ELASTICDASH_INIT_ORG_ID) {
  const cloudConfig = env.ELASTICDASH_INIT_ORG_CLOUD_PLAN
    ? CloudConfigSchema.parse({
        plan: env.ELASTICDASH_INIT_ORG_CLOUD_PLAN,
      })
    : undefined;

  const org = await prisma.organization.upsert({
    where: { id: env.ELASTICDASH_INIT_ORG_ID },
    update: {},
    create: {
      id: env.ELASTICDASH_INIT_ORG_ID,
      name: env.ELASTICDASH_INIT_ORG_NAME ?? "Provisioned Org",
      cloudConfig,
    },
  });

  // Warn about partial configurations
  const hasPublicKey = Boolean(env.ELASTICDASH_INIT_PROJECT_PUBLIC_KEY);
  const hasSecretKey = Boolean(env.ELASTICDASH_INIT_PROJECT_SECRET_KEY);
  const hasEmail = Boolean(env.ELASTICDASH_INIT_USER_EMAIL);
  const hasPassword = Boolean(env.ELASTICDASH_INIT_USER_PASSWORD);

  // Partial API key config
  if (hasPublicKey !== hasSecretKey) {
    const missingKey = hasPublicKey
      ? "ELASTICDASH_INIT_PROJECT_SECRET_KEY"
      : "ELASTICDASH_INIT_PROJECT_PUBLIC_KEY";
    logger.warn(
      `[ElasticDash Init] Partial API key configuration: ${missingKey} is not set. ` +
        `Both ELASTICDASH_INIT_PROJECT_PUBLIC_KEY and ELASTICDASH_INIT_PROJECT_SECRET_KEY must be set to create API keys.`,
    );
  }

  // API keys without project ID
  if ((hasPublicKey || hasSecretKey) && !env.ELASTICDASH_INIT_PROJECT_ID) {
    logger.warn(
      `[ElasticDash Init] ELASTICDASH_INIT_PROJECT_ID is not set but API key variables are configured. ` +
        `API keys will not be created. Set ELASTICDASH_INIT_PROJECT_ID to enable API key creation.`,
    );
  }

  // Partial user config
  if (hasEmail !== hasPassword) {
    const missingVar = hasEmail
      ? "ELASTICDASH_INIT_USER_PASSWORD"
      : "ELASTICDASH_INIT_USER_EMAIL";
    logger.warn(
      `[ElasticDash Init] Partial user configuration: ${missingVar} is not set. ` +
        `Both ELASTICDASH_INIT_USER_EMAIL and ELASTICDASH_INIT_USER_PASSWORD must be set to create a user.`,
    );
  }

  // Create Project: Org -> Project
  if (env.ELASTICDASH_INIT_PROJECT_ID) {
    let retentionDays: number | null = null;
    const hasRetentionEntitlement = hasEntitlementBasedOnPlan({
      plan: getOrganizationPlanServerSide(),
      entitlement: "data-retention",
    });
    if (env.ELASTICDASH_INIT_PROJECT_RETENTION && hasRetentionEntitlement) {
      retentionDays = env.ELASTICDASH_INIT_PROJECT_RETENTION;
    }

    await prisma.project.upsert({
      where: { id: env.ELASTICDASH_INIT_PROJECT_ID },
      update: {},
      create: {
        id: env.ELASTICDASH_INIT_PROJECT_ID,
        name: env.ELASTICDASH_INIT_PROJECT_NAME ?? "Provisioned Project",
        orgId: org.id,
        retentionDays,
      },
    });

    // Add API Keys: Project -> API Key
    if (
      env.ELASTICDASH_INIT_PROJECT_SECRET_KEY &&
      env.ELASTICDASH_INIT_PROJECT_PUBLIC_KEY
    ) {
      const existingApiKey = await prisma.apiKey.findUnique({
        where: { publicKey: env.ELASTICDASH_INIT_PROJECT_PUBLIC_KEY },
      });

      // Delete key if project changed
      if (
        existingApiKey &&
        existingApiKey.projectId !== env.ELASTICDASH_INIT_PROJECT_ID
      ) {
        await prisma.apiKey.delete({
          where: { publicKey: env.ELASTICDASH_INIT_PROJECT_PUBLIC_KEY },
        });
      }

      // Create new key if it doesn't exist or project changed
      if (
        !existingApiKey ||
        existingApiKey.projectId !== env.ELASTICDASH_INIT_PROJECT_ID
      ) {
        await createAndAddApiKeysToDb({
          prisma,
          entityId: env.ELASTICDASH_INIT_PROJECT_ID,
          note: "Provisioned API Key",
          scope: "PROJECT",
          predefinedKeys: {
            secretKey: env.ELASTICDASH_INIT_PROJECT_SECRET_KEY,
            publicKey: env.ELASTICDASH_INIT_PROJECT_PUBLIC_KEY,
          },
        });
      }
    }
  }

  // Create User: Org -> User
  if (env.ELASTICDASH_INIT_USER_EMAIL && env.ELASTICDASH_INIT_USER_PASSWORD) {
    const email = env.ELASTICDASH_INIT_USER_EMAIL.toLowerCase();
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    let userId = existingUser?.id;

    // Create user if it doesn't exist yet
    if (!userId) {
      userId = await createUserEmailPassword(
        email,
        env.ELASTICDASH_INIT_USER_PASSWORD,
        env.ELASTICDASH_INIT_USER_NAME ?? "Provisioned User",
      );
    }

    // Create OrgMembership: Org -> OrgMembership <- User
    await prisma.organizationMembership.upsert({
      where: {
        orgId_userId: { userId, orgId: org.id },
      },
      update: { role: "OWNER" },
      create: {
        userId,
        orgId: org.id,
        role: "OWNER",
      },
    });
  }
}
