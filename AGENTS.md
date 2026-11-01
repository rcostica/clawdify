# Clawdify repository rules

Publish reusable application code only. Keep personal/client work, previews,
messages, memory, runtime databases, credentials, instance IDs, hostnames and
machine-specific paths outside the repository. Use environment variables,
installer discovery and per-user directories for configuration. Examples must
use synthetic data and reserved example domains.

Before committing, review staged changes for instance-specific material. Before
pushing, run `npm run check:release -- <target-ref>` and inspect every outgoing
commit, not only the final tree. Install the local gate with `npm run hooks:install`.
The gate checks tracked paths, commit metadata, credential patterns and machine-specific content;
manual review is still required for private business content and binary assets.
An optional private blocklist lives outside Git, configured through
`git config clawdify.privatePatternsFile /absolute/path/to/patterns.json` (JSON
array of literal strings). Never copy that list into source or diagnostics.

Preserve live instance data and unrelated local changes during release cleanup.

Keep author/committer identities suitable for publication. Use a public project
identity or a privacy-preserving address instead of private contact details.
After rewriting history, run `npm run check:release -- --history HEAD` to verify
all reachable revisions before a lease-protected update of the remote branch.
