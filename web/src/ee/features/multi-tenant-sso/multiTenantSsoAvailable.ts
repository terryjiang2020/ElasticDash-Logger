import { env } from "@/src/env.mjs";

export const multiTenantSsoAvailable = Boolean(
  env.NEXT_PUBLIC_ELASTICDASH_CLOUD_REGION,
);
