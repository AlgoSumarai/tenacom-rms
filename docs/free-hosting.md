# Free hosting: Netlify, Render and Aiven

Use Netlify Free for Next.js, Render Free for the .NET API and Aiven Free for MySQL. The provider addresses include HTTPS. This setup is for evaluation and light use: Render sleeps after 15 minutes without requests, quotas can pause services, and Aiven's free database has 1 GB storage. It has no guaranteed business uptime.

## Prepare the database

Create an Aiven MySQL service on the Free / $0 plan, then create the `tenacom` database under Connect → Databases. Save its connection details privately. Download its public CA certificate to `.local/aiven-ca.pem` in your local checkout; that directory is ignored by Git. On Linux/macOS, make the public certificate readable with `chmod 644 .local/aiven-ca.pem`.

Run from your checkout in Bash with Docker running:

```bash
bash scripts/Initialize-Cloud.sh
```

At its hidden connection-string prompt use the following form with actual values:

```text
Server=AIVEN_HOST;Port=AIVEN_PORT;Database=tenacom;User=avnadmin;Password=AIVEN_PASSWORD;SslMode=VerifyFull;SslCa=/etc/secrets/aiven-ca.pem;MaximumPoolSize=10
```

This is a .NET connection string, not a mysql:// URI. Quote password values containing semicolons or quotes using connection-string syntax. The script runs migrations, then asks for the first administrator email and password. It stops on failures. Bootstrap refuses a nonempty user database. Do not rerun bootstrap for upgrades.

## Create a runtime database account

Connect as avnadmin with a MySQL client, using the CA certificate and hostname verification. Create a separate account with a strong random hexadecimal password:

```sql
CREATE USER 'tenacom_runtime'@'%' IDENTIFIED BY 'REPLACE_WITH_RANDOM_HEXADECIMAL_PASSWORD';
GRANT SELECT, INSERT, UPDATE, DELETE ON tenacom.* TO 'tenacom_runtime'@'%';
SHOW GRANTS FOR 'tenacom_runtime'@'%';
```

Stop on any error. Keep avnadmin for migrations and administration; the deployed API uses tenacom_runtime. If you restrict Aiven's IP allowlist, permit your initialization computer and the Render service's documented outbound addresses.

## Create the frontend

Import this GitHub repository into Netlify Free. Select the branch containing the hosting files. The root netlify.toml sets base apps/web, build command npm run build, publish directory .next and Node 24. Use Netlify's automatic Next.js adapter. Choose a stable project name and record the exact HTTPS production origin. API requests will work after connecting Render below.

## Deploy the API

Create a Render Blueprint from this repository and the same branch. render.yaml selects a Free Docker service with repository-root context, apps/api/Dockerfile.render, health check /health/ready and manual deployments. Leave Docker Command unset. The Dockerfile retains the existing build and uses primary group 1000 so the non-root app can read Render's mounted certificate.

Set these Render environment variables:

| Key | Value |
| --- | --- |
| ASPNETCORE_ENVIRONMENT | Production |
| ASPNETCORE_HTTP_PORTS | 8080 |
| PORT | 8080 |
| Security__SecureCookies | true |
| Security__Origin | Exact Netlify HTTPS production origin, no trailing slash |
| AllowedHosts | Actual Render API hostname without scheme, followed by ;localhost;127.0.0.1 |
| ConnectionStrings__Database | Runtime connection string below |

```text
Server=AIVEN_HOST;Port=AIVEN_PORT;Database=tenacom;User=tenacom_runtime;Password=RUNTIME_PASSWORD;SslMode=VerifyFull;SslCa=/etc/secrets/aiven-ca.pem;MaximumPoolSize=10
```

In Render Environment → Secret Files, create aiven-ca.pem with the certificate contents downloaded from Aiven. It is mounted at /etc/secrets/aiven-ca.pem. Save and deploy. Correct AllowedHosts if Render assigns a different hostname. Confirm the API's /health/ready returns 200. Free services do not provide a shell or paid pre-deploy migrations; initialization runs locally.

## Connect and verify

Set API_URL in Netlify to the actual HTTPS Render API address, with no trailing slash, then rebuild the frontend. The existing /api rewrite compiles this setting at build time. Browser requests stay on the Netlify address, including login. Do not add wildcard CORS or put database credentials in Netlify.

Sign in using your initialized administrator. Verify invitation creation, public profile submission and saving records. An anonymous /api/users request through Netlify should return 401. Verify Secure/HttpOnly cookies. The first API request after inactivity can take about a minute. Cloud proxy behavior, cookies, database migrations and free-instance memory still need deployment verification.

Keep encrypted exports outside the database provider. Before updates, back up, pause editing, run the new release's --migrate command with the migration account, then deploy API and frontend from the same release.

## Verification and references

Local checks on 2026-10-12: Render API Docker build passed; the non-root runtime could read a mounted CA certificate; Bash syntax and YAML/TOML parsing passed. No cloud deployment or database initialization is claimed.

- [Render free limits](https://render.com/docs/free)
- [Render Docker secret-file access](https://render.com/docs/docker-secrets)
- [Next.js on Netlify](https://docs.netlify.com/build/frameworks/framework-setup-guides/nextjs/overview/)
- [Netlify pricing](https://www.netlify.com/pricing/)
- [Aiven MySQL free tier](https://aiven.io/docs/products/mysql/concepts/mysql-free-tier)
- [MySqlConnector TLS options](https://mysqlconnector.net/connection-options/)
