import { useUiCustomization } from "@/src/ee/features/ui-customization/useUiCustomization";
import { env } from "@/src/env.mjs";

export function useLangfuseEnvCode(keys?: {
  secretKey: string;
  publicKey: string;
}): string {
  const uiCustomization = useUiCustomization();
  const baseUrl = `${uiCustomization?.hostname ?? window.origin}${env.NEXT_PUBLIC_BASE_PATH ?? ""}`;

  if (keys) {
    return `ELASTICDASH_SECRET_KEY = "${keys.secretKey}"
ELASTICDASH_PUBLIC_KEY = "${keys.publicKey}"
ELASTICDASH_BASE_URL = "${baseUrl}"`;
  }

  return `ELASTICDASH_SECRET_KEY = "sk-lf-..."
ELASTICDASH_PUBLIC_KEY = "pk-lf-..."
ELASTICDASH_BASE_URL = "${baseUrl}"`;
}
