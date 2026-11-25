import assert from "node:assert/strict";
import test from "node:test";

import {
  sanitizeGitRef,
  validateGithubRepositoryUrl
} from "./github-url.js";

test(
  "accepts a plain github.com owner/repo URL",
  () => {
    const result =
      validateGithubRepositoryUrl(
        "https://github.com/octocat/Hello-World"
      );

    assert.equal(
      result.ok,
      true
    );

    if (result.ok) {
      assert.equal(
        result.target.normalizedUrl,
        "https://github.com/octocat/Hello-World.git"
      );
      assert.equal(
        result.target.owner,
        "octocat"
      );
      assert.equal(
        result.target.repo,
        "Hello-World"
      );
    }
  }
);

test(
  "accepts a URL with a .git suffix and trailing slash",
  () => {
    const withSuffix =
      validateGithubRepositoryUrl(
        "https://github.com/octocat/Hello-World.git"
      );
    const withTrailingSlash =
      validateGithubRepositoryUrl(
        "https://github.com/octocat/Hello-World/"
      );

    assert.equal(
      withSuffix.ok,
      true
    );
    assert.equal(
      withTrailingSlash.ok,
      true
    );
  }
);

test(
  "rejects missing or empty values",
  () => {
    assert.equal(
      validateGithubRepositoryUrl(undefined).ok,
      false
    );
    assert.equal(
      validateGithubRepositoryUrl("").ok,
      false
    );
    assert.equal(
      validateGithubRepositoryUrl("   ").ok,
      false
    );
  }
);

test(
  "rejects non-https protocols",
  () => {
    assert.equal(
      validateGithubRepositoryUrl("http://github.com/octocat/Hello-World").ok,
      false
    );
    assert.equal(
      validateGithubRepositoryUrl("ssh://git@github.com/octocat/Hello-World.git").ok,
      false
    );
    assert.equal(
      validateGithubRepositoryUrl("git://github.com/octocat/Hello-World.git").ok,
      false
    );
    assert.equal(
      validateGithubRepositoryUrl("file:///etc/passwd").ok,
      false
    );
  }
);

test(
  "rejects hosts other than github.com, including userinfo tricks",
  () => {
    assert.equal(
      validateGithubRepositoryUrl("https://notgithub.com/octocat/Hello-World").ok,
      false
    );
    assert.equal(
      validateGithubRepositoryUrl("https://github.com.evil.com/octocat/Hello-World").ok,
      false
    );
    assert.equal(
      validateGithubRepositoryUrl("https://github.com@evil.com/octocat/Hello-World").ok,
      false
    );
    assert.equal(
      validateGithubRepositoryUrl("https://localhost/octocat/Hello-World").ok,
      false
    );
    assert.equal(
      validateGithubRepositoryUrl("https://127.0.0.1/octocat/Hello-World").ok,
      false
    );
  }
);

test(
  "rejects a port, query string, or hash fragment",
  () => {
    assert.equal(
      validateGithubRepositoryUrl("https://github.com:8443/octocat/Hello-World").ok,
      false
    );
    assert.equal(
      validateGithubRepositoryUrl("https://github.com/octocat/Hello-World?x=1").ok,
      false
    );
    assert.equal(
      validateGithubRepositoryUrl("https://github.com/octocat/Hello-World#readme").ok,
      false
    );
  }
);

test(
  "rejects malformed owner/repo paths",
  () => {
    assert.equal(
      validateGithubRepositoryUrl("https://github.com/octocat").ok,
      false
    );
    assert.equal(
      validateGithubRepositoryUrl("https://github.com/").ok,
      false
    );
  }
);

test(
  "normalizes dot-segments in the path without escaping the owner/repo charset",
  () => {
    // The WHATWG URL parser collapses ../ segments before validation ever
    // sees them, so this resolves to /etc/passwd, which is then validated
    // as an ordinary (if unlikely) owner/repo pair — not a path-traversal
    // risk, since the clone destination is always a fixed workspace
    // directory that never incorporates owner/repo.
    const result =
      validateGithubRepositoryUrl(
        "https://github.com/../../etc/passwd"
      );

    assert.equal(
      result.ok,
      true
    );

    if (result.ok) {
      assert.equal(
        result.target.owner,
        "etc"
      );
      assert.equal(
        result.target.repo,
        "passwd"
      );
    }
  }
);

test(
  "rejects whitespace and control characters",
  () => {
    assert.equal(
      validateGithubRepositoryUrl("https://github.com/octocat/Hello World").ok,
      false
    );
    assert.equal(
      validateGithubRepositoryUrl("https://github.com/octocat/Hello-World\n").ok,
      false
    );
  }
);

test(
  "sanitizeGitRef accepts well-formed refs and rejects dangerous ones",
  () => {
    assert.equal(
      sanitizeGitRef("main"),
      "main"
    );
    assert.equal(
      sanitizeGitRef("release/1.0.0"),
      "release/1.0.0"
    );
    assert.equal(
      sanitizeGitRef(undefined),
      undefined
    );
    assert.equal(
      sanitizeGitRef(""),
      undefined
    );
    assert.equal(
      sanitizeGitRef("--upload-pack=evil"),
      undefined
    );
    assert.equal(
      sanitizeGitRef("../escape"),
      undefined
    );
    assert.equal(
      sanitizeGitRef("has space"),
      undefined
    );
  }
);
