import { env } from "../env";

export const isEeAvailable: boolean =
  env.NEXT_PUBLIC_ELASTICDASH_CLOUD_REGION !== undefined ||
  env.ELASTICDASH_EE_LICENSE_KEY !== undefined;
