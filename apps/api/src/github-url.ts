export interface GithubRepositoryTarget {
  normalizedUrl: string;
  owner: string;
  repo: string;
}

export type GithubRepositoryValidation =
  | { ok: true; target: GithubRepositoryTarget }
  | { ok: false; error: string };

const githubRepositoryPathPattern =
  /^\/([A-Za-z0-9](?:[A-Za-z0-9-]{0,38})?)\/([A-Za-z0-9._-]{1,100}?)(?:\.git)?\/?$/;

export function validateGithubRepositoryUrl(
  rawValue: string | undefined
): GithubRepositoryValidation {
  if (
    typeof rawValue !== "string" ||
    rawValue.trim().length === 0
  ) {
    return {
      ok: false,
      error: "repositoryUrl is required"
    };
  }

  if (
    rawValue.length > 512 ||
    /[\s\x00-\x1f]/.test(rawValue)
  ) {
    return {
      ok: false,
      error: "repositoryUrl is invalid"
    };
  }

  let url: URL;

  try {
    url = new URL(rawValue);
  } catch {
    return {
      ok: false,
      error: "repositoryUrl is not a valid URL"
    };
  }

  if (
    url.protocol !== "https:" ||
    url.hostname.toLowerCase() !== "github.com" ||
    url.username !== "" ||
    url.password !== "" ||
    url.port !== "" ||
    url.search !== "" ||
    url.hash !== ""
  ) {
    return {
      ok: false,
      error: "repositoryUrl must be a plain https://github.com/<owner>/<repo> URL"
    };
  }

  const match =
    githubRepositoryPathPattern.exec(
      url.pathname
    );

  if (
    !match
  ) {
    return {
      ok: false,
      error: "repositoryUrl must point to a GitHub owner/repo path"
    };
  }

  const [, owner, repo] = match;

  return {
    ok: true,
    target: {
      normalizedUrl: `https://github.com/${owner}/${repo}.git`,
      owner,
      repo
    }
  };
}

export function sanitizeGitRef(
  value: string | undefined
): string | undefined {
  if (
    typeof value !== "string"
  ) {
    return undefined;
  }

  const trimmed =
    value.trim();

  if (
    trimmed.length === 0 ||
    trimmed.length > 200 ||
    trimmed.startsWith("-") ||
    trimmed.includes("..") ||
    !/^[A-Za-z0-9._/-]+$/.test(trimmed)
  ) {
    return undefined;
  }

  return trimmed;
}
