# Oracle Cloud deployment guide — Tenacom RMS

Checked against the repository and official provider documentation on **2026-10-08**. This guide deploys the complete application to one Oracle Cloud Ubuntu ARM server: Next.js frontend, .NET API and MySQL 8.4. Caddy runs on the server and provides HTTPS.

This is a deployment guide. No Oracle server has been provisioned and no cloud deployment or ARM application build is claimed.

Guide checks completed locally: 22 Bash blocks pass syntax parsing, 3 PowerShell blocks parse successfully, and the production Compose override resolves to HTTPS/secure cookies with separate migration and runtime accounts and private API/database ports. Registry manifest checks confirm `linux/arm64` images for MySQL 8.4, Node 24 Alpine and the .NET 10 SDK/runtime. These checks do not replace building and testing on the actual Oracle VM.

## 1. What you need

- An Oracle Cloud account and permission to create an Always Free compute instance.
- An SSH private key stored on your computer; upload only its public key to Oracle.
- A hostname you control, such as `rms.example.com`, pointing to the server. An existing domain or a free DNS hostname can be used; buying a domain is separate from Oracle compute.
- The current project at `C:\Tenacom\tenacom-rms` and Docker Desktop for exporting your local database.

Throughout this guide, replace `rms.example.com`, `SERVER_PUBLIC_IP`, `YOUR_PUBLIC_IP/32` and the SSH key path with your own values. **PowerShell** blocks run on your Windows computer. **Bash** blocks run in the Ubuntu SSH session, unless stated otherwise.

The application already has the official Tenacom logo and password-free Resource submissions. Only Admins and Managers sign in and record hours.

## 2. Create the free Oracle server

In the Oracle console, open **Compute → Instances → Create instance**. Use:

| Setting | Value |
| --- | --- |
| Name | `tenacom-rms` |
| Region | Your account’s home region; choose one near your users when signing up |
| Image | Ubuntu 24.04 LTS, ARM-compatible platform image |
| Shape | `VM.Standard.A1.Flex` |
| Allocation | 2 OCPUs, 12 GB RAM, within your remaining free allocation |
| Boot volume | 50 GB, within your total free storage allowance |
| Network | Public subnet with an internet gateway and public IPv4 address |
| SSH key | Your own OpenSSH public key, or a generated key pair whose private key you save securely |

Oracle currently documents 1,500 OCPU-hours and 9,000 GB-hours monthly for A1, equivalent to 2 OCPUs and 12 GB RAM, and 200 GB combined boot/block storage. These are totals across the account, not per server. Confirm free eligibility and your remaining allocation in the console before creating resources. Use Always Free resources rather than relying on the temporary trial credit. Capacity can be unavailable, and idle free instances may be reclaimed. Keep backups outside this server. [Oracle Always Free limits](https://docs.oracle.com/en-us/iaas/Content/FreeTier/freetier_topic-Always_Free_Resources.htm)

Oracle requires card verification during signup; its free tier has no uptime SLA. [Oracle signup FAQ](https://www.oracle.com/cloud/free/faq/)

The console’s placement and networking fields can vary. Select the Ubuntu image explicitly rather than accepting the default Oracle Linux image. [Creating an Oracle instance](https://docs.oracle.com/en-us/iaas/Content/Compute/Tasks/launchinginstance.htm)

## 3. Configure networking and DNS

Add stateful ingress rules to the instance’s network security group or subnet security list:

| Protocol / destination port | Source | Purpose |
| --- | --- | --- |
| TCP 22 | `YOUR_PUBLIC_IP/32` | SSH administration |
| TCP 80 | `0.0.0.0/0` | HTTP redirects and certificate validation |
| TCP 443 | `0.0.0.0/0` | HTTPS application access |

Retain the normal outbound rules needed for DNS, package downloads and certificate issuance. Do not add public rules for 3000, 3306, 3307, 5080 or 8080. Oracle networking rules and the Ubuntu firewall must both permit the web ports. [Oracle security rules](https://docs.oracle.com/en-us/iaas/Content/Network/Concepts/securityrules.htm)

Create a DNS **A record** for your chosen hostname pointing to the server’s public IPv4 address. Do not add an AAAA record unless IPv6 routing and firewall rules are configured. If the public IP changes, update DNS before restarting certificate setup.

Connect from Windows:

```powershell
ssh -i "C:\path\to\oracle-private-key" ubuntu@SERVER_PUBLIC_IP
```

Verify the server fingerprint through a trusted Oracle console connection before accepting a new SSH host key.

On Ubuntu, check the architecture and existing firewall:

```bash
uname -m
sudo iptables -S INPUT
sudo ufw status
```

`uname -m` should show `aarch64` on A1. If `ufw` is absent, use the existing iptables rules. If UFW is active, allow the web ports:

```bash
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
```

Otherwise, on an Oracle Ubuntu image using iptables rules, add HTTP/HTTPS acceptance before any existing reject rule:

```bash
sudo iptables -C INPUT -p tcp --dport 80 -j ACCEPT || sudo iptables -I INPUT 1 -p tcp --dport 80 -j ACCEPT
sudo iptables -C INPUT -p tcp --dport 443 -j ACCEPT || sudo iptables -I INPUT 1 -p tcp --dport 443 -j ACCEPT
sudo apt-get update
sudo apt-get install -y iptables-persistent
sudo netfilter-persistent save
```

Preserve existing SSH and Oracle networking rules; do not flush the firewall. These examples cover IPv4, matching the A record above.

## 4. Install Docker and Caddy

On the Ubuntu server, install Docker from its official package repository. These commands use Ubuntu’s codename and ARM architecture automatically. [Docker installation documentation](https://docs.docker.com/engine/install/ubuntu/)

```bash
sudo apt-get update
sudo apt-get install -y ca-certificates curl gnupg openssl
sudo install -m 0755 -d /etc/apt/keyrings
sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
sudo chmod a+r /etc/apt/keyrings/docker.asc
ubuntu_codename="$(. /etc/os-release; printf "%s" "${UBUNTU_CODENAME:-$VERSION_CODENAME}")"
printf "deb [arch=%s signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu %s stable\n" "$(dpkg --print-architecture)" "$ubuntu_codename" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
sudo systemctl enable --now docker
sudo docker run --rm hello-world
sudo docker compose version
```

Use `sudo docker` throughout this guide. Installing native .NET, Node.js or MySQL on the server is unnecessary because the application builds and runs in containers.

Install Caddy from its stable repository. [Caddy installation documentation](https://caddyserver.com/docs/install)

```bash
sudo apt-get install -y debian-keyring debian-archive-keyring apt-transport-https
curl -fsSL https://dl.cloudsmith.io/public/caddy/stable/gpg.key -o /tmp/caddy-stable.key
sudo gpg --dearmor --yes -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg /tmp/caddy-stable.key
curl -fsSL https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt -o /tmp/caddy-stable.list
sudo install -m 0644 /tmp/caddy-stable.list /etc/apt/sources.list.d/caddy-stable.list
sudo chmod a+r /usr/share/keyrings/caddy-stable-archive-keyring.gpg
sudo apt-get update
sudo apt-get install -y caddy
```

## 5. Copy the current project

Use a source archive so that the current working files are included even if they have not been committed to Git. On **Windows PowerShell**:

```powershell
Set-Location C:\Tenacom\tenacom-rms
New-Item -ItemType Directory -Force .local | Out-Null
tar.exe -czf .local\tenacom-release.tar.gz --exclude=.git --exclude=.local --exclude=.kilo --exclude=.env --exclude=.env.* --exclude=node_modules --exclude=.next --exclude=bin --exclude=obj --exclude=test-results --exclude=playwright-report --exclude=*.log --exclude=*.tsbuildinfo .
if ($LASTEXITCODE -ne 0) { throw "Source archive failed." }
scp -i "C:\path\to\oracle-private-key" .local\tenacom-release.tar.gz ubuntu@SERVER_PUBLIC_IP:~/tenacom-release.tar.gz
if ($LASTEXITCODE -ne 0) { throw "Source upload failed." }
```

The archive excludes local secrets, database backups and generated dependencies. Export the main database separately in step 8 if retaining your existing data.

On **Ubuntu**, create a new deployment directory and extract the source:

```bash
sudo install -d -m 0700 -o ubuntu -g ubuntu /opt/tenacom-rms
cd /opt/tenacom-rms
tar -xzf "$HOME/tenacom-release.tar.gz"
test -f compose.yaml && test -f apps/api/Dockerfile && test -f apps/web/Dockerfile
```

## 6. Generate production settings and separate database access

For a first installation, generate new server-side credentials. Do not copy the local `.env` or rerun this block against an existing deployment. Substitute your actual hostname first:

```bash
cd /opt/tenacom-rms
umask 077
if [ -e .env ]; then
  echo "A server .env already exists. Keep it; do not regenerate database passwords."
else
  cat > .env <<EOF
MYSQL_ROOT_PASSWORD=$(openssl rand -hex 32)
MYSQL_PASSWORD=$(openssl rand -hex 32)
MYSQL_RUNTIME_PASSWORD=$(openssl rand -hex 32)
APP_ORIGIN=https://rms.example.com
ASPNETCORE_ENVIRONMENT=Production
SECURE_COOKIES=true
EOF
  chmod 600 .env
fi
```

`APP_ORIGIN` must exactly match the browser origin: HTTPS, correct hostname, no path or trailing slash. Resources still have no passwords; these generated values are infrastructure credentials. Changing an existing `.env` password does not automatically change the corresponding MySQL account.

The base Compose file uses `tenacom` for migration and runtime access. Create an Oracle override so the API uses a separate account with only data permissions:

```bash
cat > compose.oracle.yaml <<'YAML'
services:
  api:
    environment:
      ConnectionStrings__Database: Server=db;Database=tenacom;User=tenacom_runtime;Password=${MYSQL_RUNTIME_PASSWORD:?Set MYSQL_RUNTIME_PASSWORD}
YAML
```

The migration job continues to use the original `tenacom` account, which has database DDL permissions. The runtime account will receive only SELECT, INSERT, UPDATE and DELETE.

For the rest of this guide, define this helper in each new **Ubuntu Bash** session:

```bash
cd /opt/tenacom-rms
dc() { sudo docker compose -f compose.yaml -f compose.oracle.yaml "$@"; }
dc config --quiet
```

Use `dc`, including for bootstrap and updates, so the runtime override is consistently applied. Do not use `compose.dev.yaml`, `compose.e2e.yaml` or the corporate-machine trust override on the cloud server.

## 7. Build ARM images and start MySQL

Build directly on the A1 server so Docker resolves ARM base images and installs the correct native frontend dependencies. Do not copy locally built x64 images or Windows `node_modules` to the server.

```bash
dc build api migrate web
dc up -d --wait --wait-timeout 180 db
```

Both commands must finish successfully before proceeding. An ARM source build and runtime check on the actual VM are deployment gates; they have not been performed as part of writing this guide.

Create the runtime account without exposing the root password on the command line:

```bash
runtime_password="$(sed -n 's/^MYSQL_RUNTIME_PASSWORD=//p' .env)"
if [[ ! "$runtime_password" =~ ^[0-9a-f]{64}$ ]]; then
  echo "Expected the generated 64-character hexadecimal runtime password."
else
  dc exec -T db sh -c 'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" mysql -u root' <<SQL
CREATE USER IF NOT EXISTS 'tenacom_runtime'@'%' IDENTIFIED BY '$runtime_password';
GRANT SELECT, INSERT, UPDATE, DELETE ON tenacom.* TO 'tenacom_runtime'@'%';
SQL
fi
unset runtime_password
```

Stop if account creation fails. The account command is for initial provisioning; rotating its password later requires an explicit MySQL `ALTER USER` and matching configuration change.

## 8. Choose existing data or a fresh database

### A. Preserve your existing Admin, Resources and project history

Follow this path if you want the current local data on Oracle. Do **not** bootstrap another administrator afterwards.

Pause local editing for the final export so there are no changes after the snapshot. On **Windows PowerShell**, from `C:\Tenacom\tenacom-rms`:

```powershell
docker compose exec -T db sh -c 'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" mysqldump -u root --single-transaction --no-tablespaces --routines --triggers --result-file=/tmp/tenacom-export.sql tenacom'
if ($LASTEXITCODE -ne 0) { throw "Database export failed." }
docker compose cp db:/tmp/tenacom-export.sql .local\tenacom-export.sql
if ($LASTEXITCODE -ne 0) { throw "Database copy failed." }
docker compose exec -T db rm -f /tmp/tenacom-export.sql
scp -i "C:\path\to\oracle-private-key" .local\tenacom-export.sql ubuntu@SERVER_PUBLIC_IP:~/tenacom-export.sql
if ($LASTEXITCODE -ne 0) { throw "Database upload failed." }
```

Using `--result-file` and `docker compose cp` preserves SQL bytes without PowerShell text-encoding conversion. The export contains personal data and staff password hashes; keep it private and outside source control. A single-transaction dump gives a consistent snapshot of the application’s InnoDB data; avoid concurrent schema changes. [MySQL dump documentation](https://dev.mysql.com/doc/refman/8.4/en/mysqldump.html)

On **Ubuntu**, import only into the new, unused target database from step 7:

```bash
chmod 600 "$HOME/tenacom-export.sql"
dc exec -T db sh -c 'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" mysql -u root tenacom' < "$HOME/tenacom-export.sql"
```

Stop if the import fails. Do not run this command against a database already accepting users: the dump replaces its application tables. It does not replace MySQL system accounts, so your new server-side passwords and runtime grants remain in place.

Invalidate copied login sessions so staff sign in again on the new host:

```bash
dc exec -T db sh -c 'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" mysql -u root tenacom -e "DELETE FROM Sessions;"'
```

Existing staff passwords remain valid. Profile, assignment and time IDs remain intact. Resource passwords remain absent, or migration 003 removes them if importing an older application database.

### B. Start with an empty application

Skip the import above. Migrations in the next step create the schema and reference vocabulary. After startup, bootstrap the first administrator in step 11. There are no seeded default login details.

## 9. Run migrations and start the application

From `/opt/tenacom-rms` on **Ubuntu**:

```bash
dc run --rm migrate
```

Proceed only if the migration command exits successfully. Never edit applied migration files or clear the migration ledger to bypass an error. MySQL DDL is forward-only; inspect and repair a failed upgrade before retrying.

```bash
dc up -d --wait --wait-timeout 180
dc ps -a
curl --fail --silent --show-error http://127.0.0.1:3000/login -o /dev/null
dc exec -T api dotnet Tenacom.Api.dll --health
```

MySQL, API and web should be healthy; the migration job should have exited 0. HTTP loopback here is a server-side health check. Staff browser sign-in must use the HTTPS hostname because production cookies are Secure.

The API’s existing host allowlist includes `api`, and the frontend Docker build proxies `/api` to `http://api:8080`. Keep that internal arrangement. Caddy forwards the browser hostname to Next.js; the API does not need a public hostname or port.

## 10. Enable HTTPS

Confirm DNS points to the server and TCP 80/443 are reachable. Configure Caddy on **Ubuntu**, replacing the example hostname:

```bash
sudo tee /etc/caddy/Caddyfile > /dev/null <<'CADDY'
rms.example.com {
    encode zstd gzip
    reverse_proxy 127.0.0.1:3000
}
CADDY
sudo caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile
sudo systemctl enable caddy
sudo systemctl reload caddy
sudo systemctl status caddy --no-pager
```

Caddy obtains and renews a public certificate and redirects HTTP to HTTPS when DNS, reachability and its persistent certificate storage are correct. Keep Caddy’s data directory when rebuilding the server. [Caddy automatic HTTPS](https://caddyserver.com/docs/automatic-https)

Check the public application:

```bash
curl --fail --silent --show-error -I https://rms.example.com/login
curl --fail --silent --show-error https://rms.example.com/api/terms -o /dev/null
```

After HTTPS works, add this line inside the site block to enable a 30-day HSTS policy, then validate and reload Caddy again:

```caddyfile
header Strict-Transport-Security "max-age=2592000"
```

## 11. Administrator login

**If you imported existing data:** use your existing Admin email and password. Do not run bootstrap; it intentionally refuses a nonempty Users table.

**Only for a fresh database**, run this in **Ubuntu Bash**:

```bash
read -r -p "Initial administrator email: " BOOTSTRAP_EMAIL
read -r -s -p "Initial administrator password (12–128 characters): " BOOTSTRAP_PASSWORD
printf "\n"
export BOOTSTRAP_EMAIL BOOTSTRAP_PASSWORD
sudo --preserve-env=BOOTSTRAP_EMAIL,BOOTSTRAP_PASSWORD docker compose -f compose.yaml -f compose.oracle.yaml run --rm -e BOOTSTRAP_EMAIL -e BOOTSTRAP_PASSWORD api --bootstrap
bootstrap_status=$?
unset BOOTSTRAP_EMAIL BOOTSTRAP_PASSWORD
test "$bootstrap_status" -eq 0
```

The password prompt is hidden and the password is not written into shell command history. Stop if bootstrap fails; it does not reset an existing account.

Open `https://rms.example.com/login` and sign in. Create Managers through **People & access**. Resources provide their details through invitation links or QR codes; they receive the green checkmark and thank-you message, with no password or system login.

## 12. Verify before sharing the link

- Confirm HTTPS has no certificate warning; HTTP redirects to HTTPS.
- Confirm MySQL/API/web are healthy and migrations exit 0.
- Sign in as an Admin and check imported people, profiles, projects and hours.
- Create an invitation, open it in a private browser window or phone, submit a test profile, and check the green-circle checkmark and thank-you message.
- Confirm public submission has no password field or sign-in link; Resources cannot sign in.
- Assign a Resource to a project, record hours as an Admin or Manager, and check totals and recorder attribution.
- Confirm an anonymous request to `/api/users` receives 401.
- Confirm Oracle has no public database/API port rules and only the frontend’s loopback port is published by Compose.

Current source expects three schema migrations. Inspect only aggregate data, not credentials:

```bash
dc exec -T db sh -c 'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" mysql -u root tenacom' <<'SQL'
SELECT COUNT(*) AS AppliedMigrations FROM SchemaMigrations;
SELECT COUNT(*) AS StaffAccounts FROM Users WHERE Role IN ('Admin','Manager');
SELECT COUNT(*) AS ResourceProfiles FROM ResourceProfiles;
SELECT COUNT(*) AS ResourceCredentials FROM Users WHERE Role='Resource' AND PasswordHash IS NOT NULL;
SELECT COUNT(*) AS ResourceSessions FROM Sessions s JOIN Users u ON u.Id=s.UserId WHERE u.Role='Resource';
SQL
```

Expected: three migrations for this release; zero Resource credentials and sessions. Profile counts should match the chosen import/fresh-install path plus your test submission.

## 13. Backups, updates and recovery

Create a private backup before every update and on a regular schedule. On **Ubuntu**:

```bash
cd /opt/tenacom-rms
umask 077
mkdir -p .local/backups
backup_file=".local/backups/tenacom-$(date -u +%Y%m%dT%H%M%SZ).sql"
if dc exec -T db sh -c 'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" mysqldump -u root --single-transaction --no-tablespaces --routines --triggers tenacom' > "$backup_file"; then
  gpg --symmetric --cipher-algo AES256 --output "$backup_file.gpg" "$backup_file"
  if [ $? -eq 0 ]; then
    rm -- "$backup_file"
    echo "Encrypted backup created. Copy it off this server."
  fi
else
  rm -f -- "$backup_file"
  echo "Backup failed; do not continue with an upgrade."
fi
```

GPG prompts for an encryption passphrase. Store that passphrase separately and transfer the encrypted backup to your computer or another protected storage location. A backup kept only on the Oracle VM is insufficient. For unattended backups, use a dedicated backup account and public-key encryption rather than an interactive passphrase.

Keep a protected recovery copy of the server `.env`, the Oracle override and the release source/version as well. Test decryption and restore on a separate, unused database or server before relying on the backup. Never test restoration by overwriting live data.

For an update, make a backup, upload and extract a new source archive into the existing deployment directory, preserving `.env`, `compose.oracle.yaml` and Docker volumes. Pause editing during migration:

```bash
cd /opt/tenacom-rms
dc build api migrate web
dc stop web api
dc run --rm migrate
```

If migration succeeds:

```bash
dc up -d --wait --wait-timeout 180
dc ps -a
curl --fail --silent --show-error https://rms.example.com/api/terms -o /dev/null
```

If migration fails, leave traffic stopped, inspect the error and use a forward repair. Do not start an older API against an incompatible schema. Never run `docker compose down -v`, remove the MySQL volume, or regenerate database passwords as an upgrade step.

## 14. Troubleshooting

| Symptom | Check / action |
| --- | --- |
| SSH cannot connect | Public IP, internet gateway/subnet route, TCP 22 rule for your current IP, correct `ubuntu` user and private key |
| Oracle reports no capacity | Try another availability domain in the same home region or retry later; do not switch to a paid shape unintentionally |
| HTTPS certificate fails | DNS A/AAAA records, Oracle and Ubuntu firewall ports 80/443, other services binding those ports; `sudo journalctl -u caddy -n 100 --no-pager` |
| Caddy returns 502 | `dc ps -a`, web health, and `curl http://127.0.0.1:3000/login`; use `dc logs --tail 100 web` |
| API is unhealthy | Migration exit status, runtime user/grants/password, and `dc logs --tail 100 api migrate` |
| Login or saving returns 403 | `APP_ORIGIN` must exactly match the HTTPS browser origin; use the configured hostname and keep the `/api` proxy |
| Login returns to the sign-in page | Use HTTPS; production Secure cookies will not work from a public HTTP/IP URL |
| Bootstrap refuses to run | The imported database already has people; use the existing Admin login |
| ARM build fails or memory runs out | Confirm `aarch64`, supported image manifests, remaining disk and memory; do not reuse Windows/x64 dependency folders |
| Runtime reports CREATE/ALTER denied | Use the `migrate` service for schema changes; the API runtime account deliberately has only data permissions |

Do not publish `.env`, full resolved Compose configuration, database exports, session cookies or private SSH keys when sharing diagnostics. See [operations](operations.md) for retention, account recovery and scale limits, and [verification](verification.md) for the checks already performed locally.

## Official references

- [Oracle Always Free resources](https://docs.oracle.com/en-us/iaas/Content/FreeTier/freetier_topic-Always_Free_Resources.htm)
- [Oracle instance creation](https://docs.oracle.com/en-us/iaas/Content/Compute/Tasks/launchinginstance.htm)
- [Oracle security rules](https://docs.oracle.com/en-us/iaas/Content/Network/Concepts/securityrules.htm)
- [Docker Engine on Ubuntu](https://docs.docker.com/engine/install/ubuntu/)
- [Caddy installation](https://caddyserver.com/docs/install)
- [Caddy automatic HTTPS](https://caddyserver.com/docs/automatic-https)
- [MySQL 8.4 dump documentation](https://dev.mysql.com/doc/refman/8.4/en/mysqldump.html)
