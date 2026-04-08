import { userInfo } from "node:os";
import { normalizePathPrefix, workshopPathPrefix } from "ai-engineer-workshop";

function participantPathPrefix() {
  const configuredPathPrefix = workshopPathPrefix();
  if (configuredPathPrefix !== "/") {
    return configuredPathPrefix;
  }

  return normalizePathPrefix(`/${userInfo().username}`);
}

export function workshopStreamPath(suffix: string) {
  const pathPrefix = participantPathPrefix();
  const normalizedSuffix = suffix.startsWith("/") ? suffix : `/${suffix}`;
  return pathPrefix === "/" ? normalizedSuffix : `${pathPrefix}${normalizedSuffix}`;
}

export function workshopStreamPattern(suffix: string) {
  const pathPrefix = participantPathPrefix();
  return pathPrefix === "/" ? suffix : `${pathPrefix}${suffix}`;
}
