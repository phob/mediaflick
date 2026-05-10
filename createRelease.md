# Create A Release

Use GitHub Actions for normal releases. The release workflow updates `VERSION`, commits it, creates the tag, and opens a draft GitHub release.

## 1. Start The Release Workflow

Open GitHub Actions and run:

```text
Create Release Draft
```

Enter the new version with a leading `v`, for example:

```text
v0.2.4
```

The workflow will:

- update `VERSION`
- commit the `VERSION` change to the selected branch
- create and push the `v0.2.4` tag
- create a draft GitHub release for that tag

## 2. Publish The Container

After `Create Release Draft` finishes, run this workflow manually:

```text
Docker Image CI
```

Leave the `tag` input blank to build the latest semver tag automatically. You can also enter a specific tag such as:

```text
v0.2.4
```

The workflow builds and pushes the image to:

```text
ghcr.io/phob/mediaflick
```

For `v0.2.4`, expected image tags include:

```text
ghcr.io/phob/mediaflick:0.2.4
ghcr.io/phob/mediaflick:0.2
```

If you run `Docker Image CI` from the default branch, it also publishes:

```text
ghcr.io/phob/mediaflick:latest
```

## 3. Publish The Draft Release

After the Docker workflow succeeds, review the draft GitHub release notes and publish the release.

## 4. Pull The New Container

On the deployment host:

```bash
docker pull ghcr.io/phob/mediaflick:0.2.4
```

Update compose to use the new image tag, then restart:

```bash
docker compose pull mediaflick
docker compose up -d mediaflick
```

If the compose file builds locally instead of using `image: ghcr.io/phob/mediaflick:0.2.4`, update it before pulling.

## Why Two Workflows?

A tag created by `GITHUB_TOKEN` inside `Create Release Draft` does not trigger another workflow automatically. Run `Docker Image CI` manually after the draft release workflow finishes.
