<p align="center">
  <img src="icon.png" alt="Project Logo" width="21%">
</p>

# LND for StartOS — Security & Backup Suite

> **Improved wallet security and automated channel backups for your Lightning node.**

This branch (`channels-auto-backup`) extends the official [LND StartOS package](https://github.com/Start9Labs/lnd-startos) with:
- 📤 **Automated, encrypted channel backups** (Add and configure backup providers for your channel.backup file. You can select multiple providers (Nextcloud, Dropbox, Google Drive, Email, SFTP) and multiple email recipients.)
- 🛡️ **Unified Security Dashboard** showing your current security setup (【① Channels Backup: ENABLED🟢】
【② Wallet Unlocking: MANUAL🟢】
【③ Aezeed Seed: DELETED🟢】
【④ Watchtower Client: ENABLED🟢】)
- 🔐 **Wallet hardening** (extends branch `wallet-security`: auto-unlock disable, seed/password deletion)


---

## ✨ Key Features


### 📤 Channel Auto-Backup (this branch’s core)
![Channel Auto-Backup](assets/channel-auto-backup.png)  

Automatically back up your encrypted `channel.backup` file whenever channels open/close or by manually triggering backup via `Channels - Test Auto-Backup` action:

| Provider      | Setup Guide                                                                 | Notes                                                                 |
|---------------|-----------------------------------------------------------------------------|-----------------------------------------------------------------------|
| **Email**     | [Email setup example](#email), Gmail, MailerSend (free tiers available) | Most reliable; recommends **≥2 recipients** across providers          |
| **Dropbox**   | [Dropbox setup example](#dropbox)                 | Uses OAuth2; refresh token stored encrypted                           |
| **Google Drive** | [Google Drive setup example](#google)                  | Works with **free personal accounts**                                 |
| **Nextcloud** | [Nextcloud setup example](#nextcloud)                                     | Supports `.onion` addresses over Tor                                  |
| **SFTP**      | [SFTP setup example](#sftp) Any SSH server (remote or local)                                  | Supports **password or SSH key**; works over Tor for `.onion` servers |

- **End-to-end encrypted**: `channel.backup` is encrypted by LND using your AEZEED seed  
  → Safe to store on third-party servers
- **Tor-aware**: Special handling for `.onion` SFTP/Nextcloud destinations
- **Robust**: Per-provider success/failure logging; automatic retries


### 🔐 Wallet Security (from `wallet-security` branch)
![Wallet Security](assets/wallet-unlocking.png)
![Wallet Manual Unlock](assets/wallet-manual-unlock.png)  

- **Auto-unlock management**:  
  Disable auto-unlock to prevent fund theft if your server is physically compromised.  
  *(Disabling requires password confirmation & can be enabled again)*
- **Aezeed Cipher Seed**:  
  View seed → Verify backup with 3-word challenge → **Securely delete from server**
- **Wallet password management**:  
  Confirm backup → **Securely delete password** from server  
  *(Required before disabling auto-unlock)*. Added manual unlock of the wallet in Dasboard Users can now change the wallet.db password in the app.
  


### 🛡️ Unified Security Status in the Dashboard
![Security Status Health Check Fail](assets/security-status-fail.png)  
![Security Status Health Check Success](assets/security-status-success.png)  
All critical security settings in one place:


✅ **ALL GREEN = Maximum security** (auto-backup enabled, manual unlock, seed/password deleted)

---



> 💡 **Critical**: Without channel backups, you **lose all Lightning channel funds** if your node fails.  
> Without seed/password deletion, anyone with physical access can **steal your Bitcoin**.

---

## 🔧 Technical Details

### Architecture
- **`custom-config.json`**: Isolated config for backup settings (never overwrites user data)
- **`channel-backup-watcher` daemon**:  
  Uses `inotifywait` + `rclone` + `mutt` for efficient, event-driven sync
- **Secure credential handling**:  
  OAuth tokens, SMTP passwords, and SSH keys stored encrypted in config

### Upgrade Safety
- **Schema backward-compatibility**:  
  All new `store.json` fields (`autoUnlockEnabled`, `seedBackupConfirmed`, etc.) use `.onMismatch()` defaults
- **Migration robustness**:  
  `custom-config.json` created during **both fresh installs AND upgrades** if none

### Dependencies
Added to Dockerfile:
- `rclone` (cloud sync)
- `mutt` + `mailutils` (email)
- `inotify-tools` (file monitoring)
- `jq` (config parsing)

---

## 📂 File Structure Highlights

actions/

├── addBackupTarget.ts # Backup provider configuration (Security group)

├── manualBackup.ts # Test backup trigger (Security group)

├── disableAutoUnlock.ts # Auto-unlock toggle + password deletion

├── aezeedCipherSeed.ts # Seed view/confirm/delete

└── confirmPasswordBackup.ts # Password confirm/delete

fileModels/

├── store.json.ts # Wallet state (with backward-compatible schema)

└── custom-config.json.ts # Backup settings (isolated from core config)

main.ts
└── channel-backup-watcher # Real-time backup daemon



<h3>Channels auto-backup setup examples (tap to expand):</h3>
  <hr>
  <details>
  <summary id="email"><b>EMAIL</b></summary>
  <br>
  <div>In the example below, SMTP2GO is used as SMTP provider because the setup is straightforward and the service is free.</div>
  <br><table >
    <thead><tr><th>Step</th><th>Action</th></tr></thead>
    <tbody>
      <tr><td>1️⃣</td><td><b>Sign up</b> at <u><a href="https://www.smtp2go.com/" target="_blank">smtp2go.com</a></u> (Free: 1k emails/mo)</td></tr>
      <tr><td>2️⃣</td><td>Verify email → Log in at <u><a href="https://app.smtp2go.com/" target="_blank">app.smtp2go.com</a></u></td></tr>
      <tr><td>3️⃣</td><td><b>Sending → Verified Senders</b>: Add &amp; verify your "From" email</td></tr>
      <tr><td>4️⃣</td><td><b>Sending → SMTP Users → Add SMTP User</b>: Create &amp; save username &amp; password</td></tr>
      <tr><td>5️⃣</td><td>Return to Channels - Auto-Backup: Enable Email as backup provider &amp; enter config:<br>
        <b>Sender Address:</b> Use your SMTP2GO "Single sender emails" address. See step 3.<br>
        <b>Recipient Address:</b> Add at least two addresses and try to mix email providers. Example: <code>youremail@proton.me, youremail@gmail.com, familymemberemail@gmail.com, friendemail@gmail.com</code><br>
        <b>SMTP Server:</b> <code>mail.smtp2go.com</code><br>
        <b>SMTP Port:</b> <code>465</code> (SSL) or <code>587</code> (TLS)<br>
        <b>SMTP Username:</b> See step 4.<br>
        <b>SMTP Password:</b> See step 4.</td></tr>
      <tr><td>6️⃣</td><td>Click <b>Submit</b> → Run <b>Channels: Test Auto-Backup</b></td></tr>
    </tbody>
  </table>
  <br>
    <div>💡 Any SMTP provider works! We recommend SMTP2GO, MailerSend, or Gmail (all free).</div>
    <br><table>
    <thead>
      <tr><th>✅ Recommended SMTP Providers</th></tr>
    </thead>
    <tbody>
      <tr><td><b>SMTP2Go</b> ⇢ <u><a href="https://www.smtp2go.com/" target="_blank">smtp2go.com 🔗</a></u><br>– Free tier: 1,000 emails/month, no domain required.<br>– SMTP server: <code>mail.smtp2go.com</code>, port 465 or 587.</td></tr>
      <tr><td><b>MailerSend</b> ⇢ <u><a href="https://www.mailersend.com/" target="_blank">mailersend.com 🔗</a></u><br>– Free tier: 500 emails/month, no domain required.<br>– Use your <b>verified email</b> as "From" address.</td></tr>
      <tr><td><b>Gmail</b> ⇢ <u><a href="https://mail.google.com/" target="_blank">mail.google.com 🔗</a></u><br>– Free tier: 500 emails/day, requires App Password (2FA must be ON).<br>⚠️ Emails can <b>only be sent to @gmail.com addresses</b> unless you verify a custom "From" address.</td></tr>
      <tr><td><b>Proton Mail</b> ⇢ <u><a href="https://mail.proton.me/" target="_blank">mail.proton.me 🔗</a></u><br>– Free tier: NONE, smtp access requires <b>paid plan</b>.<br>– SMTP server: <code>smtp.proton.me</code>, port 465 or 587.</td></tr>
     </tbody>
  </table>
</details>
<hr>
<details>
  <summary id="sftp"><b>SFTP</b></summary>
    <br><table>
    <thead><tr><th>Step</th><th>Action</th></tr></thead>
    <tbody>
      <tr><td>1️⃣</td><td><b>Choose a remote server / LAN computer</b> (desktop, laptop, Raspberry Pi, or NAS) that stays powered on.</td></tr>
      <tr><td>2️⃣</td><td><b>Check &amp; install SSH/SFTP server (if missing)</b>:<br>
        – <b>Linux (Ubuntu/Debian)</b>:<br>
          &nbsp;&nbsp;• Check: <code>sudo systemctl is-active ssh</code><br>
          &nbsp;&nbsp;• If <code>inactive</code>, run:<br>
          &nbsp;&nbsp;&nbsp;&nbsp;<code>sudo apt update &amp;&amp; sudo apt install openssh-server</code><br>
          &nbsp;&nbsp;&nbsp;&nbsp;<code>sudo systemctl enable --now ssh</code><br>
        – <b>macOS</b>:<br>
          &nbsp;&nbsp;• Go to <b>System Settings → Sharing</b> → enable <b>Remote Login</b><br>
        – <b>Windows</b>:<br>
          &nbsp;&nbsp;• Check: Open <b>Services</b> → look for "OpenSSH SSH Server" (should be "Running")<br>
          &nbsp;&nbsp;• If missing: <b>Settings → Apps → Optional Features → Add → OpenSSH Server</b><br>
          &nbsp;&nbsp;• Then in **PowerShell as Admin**:<br>
          &nbsp;&nbsp;&nbsp;&nbsp;<code>Start-Service sshd; Set-Service -Name sshd -StartupType 'Automatic'</code>
      </td></tr>
      <tr><td>3️⃣</td><td><b>Find the IP address</b>:<br>
        – Linux/macOS: run <code>ip a</code> (look for <code>inet</code> under <code>wlan0</code> or <code>eth0</code>)<br>
        – Windows: run <code>ipconfig</code> in Command Prompt (look for "IPv4 Address")
      </td></tr>
      <tr><td>4️⃣</td><td><b>Choose authentication</b>:<br>
        – ✅ <b>Password (recommended for beginners)</b>:<br>
          &nbsp;&nbsp;• Leave <b>"SFTP Private Key"</b> blank<br>
          &nbsp;&nbsp;• Enter your login password in <b>"SFTP Password"</b><br>
        – 🔑 <b>SSH Key (advanced)</b>:<br>
          &nbsp;&nbsp;• <b>How to generate a key (if you don't have one):</b><br>
          &nbsp;&nbsp;&nbsp;&nbsp;– <b>Linux / macOS</b>:<br>
          &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<code>ssh-keygen -t ed25519 -C "lnd-backup" -f ~/.ssh/lnd_backup</code><br>
          &nbsp;&nbsp;&nbsp;&nbsp;– <b>Windows (PowerShell)</b>:<br>
          &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<code>ssh-keygen -t ed25519 -C "lnd-backup" -f "$env:USERPROFILE\.ssh\lnd_backup"</code><br>
          &nbsp;&nbsp;• Your private key is at:<br>
          &nbsp;&nbsp;&nbsp;&nbsp;– Linux/macOS: <code>~/.ssh/lnd_backup</code><br>
          &nbsp;&nbsp;&nbsp;&nbsp;– Windows: <code>%USERPROFILE%\.ssh\lnd_backup</code><br>
          &nbsp;&nbsp;• <b>Paste the entire private key</b> (starts with <code>-----BEGIN OPENSSH PRIVATE KEY-----</code> and ends with <code>-----END ...</code>) into <b>"SFTP Private Key"</b><br>
          ⚠️ <b>Include every line</b> and <b>do not add extra spaces or line breaks at the end</b>.
      </td></tr>
      <tr><td>5️⃣</td><td><b>In LND SFTP Settings</b>:<br>
        <b>SFTP Host</b>: IP from Step 3 (e.g., <code>192.168.1.20</code>)<br>
        <b>SFTP Username</b>: Your login username (e.g., <code>user</code>, <code>admin</code>)<br>
        <b>SFTP Port</b>: <code>22</code> (default)<br>
        <b>SFTP Folder Path</b>: Path to the backup folder (e.g., <code>lnd-backups</code> or <code>subfolder/lnd-backups</code>). Use relative paths without a leading '/' to place it in your home directory.<br>
        → <b>Create this folder first</b> if it doesn't exist.
      </td></tr>
      <tr><td>6️⃣</td><td>Click <b>Submit</b>, then test with <b>"Test Channels Auto-Backup"</b>.</td></tr>
    </tbody>
  </table>
  💡 <b>Tip</b>: If backup fails, check: IP correctness, SSH running, firewall blocking port 22, folder permissions, or special characters in password.<br>
  💡 If your private key is **not fully saved**, try copying it again **without trailing newlines**—only the full key block.
</details>
<hr>
<details>
  <summary id="dropbox"><b>Dropbox</b></summary>
    <br><table>
    <thead><tr><th>Step</th><th>Action</th></tr></thead>
    <tbody>
      <tr><td>1️⃣</td><td>Go to <u><a href="https://www.dropbox.com/developers/apps" target="_blank">Dropbox App Console 🔗</a></u> → Create app (or use existing)</td></tr>
      <tr><td>2️⃣</td><td>Choose <b>Scoped access</b> → <b>App folder</b></td></tr>
      <tr><td>3️⃣</td><td>Give it a name → Create app</td></tr>
      <tr><td>4️⃣</td><td>Permissions → enable <code>files.content.write</code> and <code>files.content.read</code></td></tr>
      <tr><td>5️⃣</td><td>Copy <b>App key</b> (client_id) and <b>App secret</b> (client_secret)</td></tr>
      <tr><td>6️⃣</td><td>💡 If you already have Refresh Token just proceed to step 7.<br>
        <hr>Open your browser and paste this Dropbox OAuth 2 URL, replacing <b><i>APP_KEY</i></b> with your App key:<br><br>
        <i>https://www.dropbox.com/oauth2/authorize?client_id=APP_KEY&amp;response_type=code&amp;token_access_type=offline</i><br><br>
        <span>Log in to Dropbox → Allow the app: Copy the <b>Dropbox Authorization Code</b> from the URL (after ?code=) or from the page if displayed.</span><br></td></tr>
      <tr><td>7️⃣</td><td>In LND → Channels - Auto-Backup → Dropbox settings, paste:<ul><li><b>Dropbox App Key</b>: Your App key</li><li><b>Dropbox App Secret</b>: Your App secret</li><li><b>Dropbox Authorization Code</b>: The code from step 6 (fill only if you do NOT already have a Refresh Token)</li><li><b>Dropbox Refresh Token</b>: Paste your existing refresh token here if you have one OR leave empty → a new one will be generated automatically (Authorization Code is then required)</li></ul></td></tr>
      <tr><td>8️⃣</td><td>Folder path: enter new path or leave default <code>lnd-backups</code></td></tr>
      <tr><td>9️⃣</td><td>Click <b>Submit</b> → Provided settings will be exchanged for Dropbox Refresh Token automatically. Run <b>Channels - Test Auto-Backup</b>.</td></tr>
    </tbody>
  </table>
  </details>
<hr>
<details>
  <summary id="nextcloud"><b>Nextcloud</b></summary>
    <br><table>
    <thead><tr><th>Step</th><th>Action</th></tr></thead>
    <tbody>
      <tr><td>1️⃣</td><td><b>Log in</b> to your Nextcloud instance.</td></tr>
      <tr><td>2️⃣</td><td>Go to <b>Settings → Security → Devices &amp; sessions</b>.</td></tr>
      <tr><td>3️⃣</td><td>Under "App passwords", <b>create a new app password</b> (e.g., "LND Backup").</td></tr>
      <tr><td>4️⃣</td><td>Copy the generated password — you won't see it again!</td></tr>
      <tr><td>5️⃣</td><td>In LND Auto-Backup config, fill in:<br>
        <b>Nextcloud WebDAV URL:</b> <code>https://your-nextcloud.com/remote.php/dav/files/yourusername/</code> or <code>https://youronionaddress.onion/remote.php/dav/files/yourusername/</code><br>
        <b>Username:</b> Your Nextcloud login<br>
        <b>Password:</b> The app password from Step 3<br>
        <b>Folder Path:</b> <code>lnd-backups</code> (will be created automatically)</td></tr>
      <tr><td>6️⃣</td><td>Click <b>Submit</b> → Run <b>Channels - Test Auto-Backup</b>.</td></tr>
    </tbody>
  </table>
  💡 Ensure your Nextcloud server allows WebDAV access and isn't behind aggressive firewalls.
</details>
<hr>
<details>
  <summary id="google"><b>Google Drive</b></summary>
  <div><br><b>Works with FREE personal Google accounts!</b></div>
  <br>
  <div>Google Drive requires OAuth authorization. This is a 3-step process that takes about 2 minutes.</div>
    <br><table>
    <thead><tr><th>Step</th><th>Action</th></tr></thead>
    <tbody>
      <tr><td colspan="2"><h4>Part 1: Create OAuth Credentials (One-time setup)</h4></td></tr>
      <tr><td>1️⃣</td><td>Go to <u><a href="https://console.cloud.google.com/" target="_blank">Google Cloud Console 🔗</a></u> → Create a <b>new project</b> (e.g., "lnd-backup").</td></tr>
      <tr><td>2️⃣</td><td>Enable the <b>Google Drive API</b>:<br>
        • Go to "APIs &amp; Services → Library"<br>
        • Search "Google Drive API"<br>
        • Click "Enable"</td></tr>
      <tr><td>3️⃣</td><td>Configure OAuth consent screen:<br>
        • Go to "APIs &amp; Services → OAuth consent screen"<br>
        • User Type: <b>External</b> → Create<br>
        • App name: <code>LND Backup</code><br>
        • User support email: Your email<br>
        • Developer contact: Your email<br>
        • Save and Continue through all screens<br>
        • On "Test users" screen: <b>Add your email as a test user</b><br>
        • Save and Continue</td></tr>
      <tr><td>4️⃣</td><td>Create OAuth credentials:<br>
        • Go to "APIs &amp; Services → Credentials"<br>
        • Click <b>"Create Credentials" → "OAuth client ID"</b><br>
        • Application type: <b>Desktop app</b><br>
        • Name: <code>LND Backup Client</code><br>
        • Click <b>Create</b></td></tr>
      <tr><td>5️⃣</td><td>Copy the <b>Client ID</b> and <b>Client Secret</b> shown in the popup. Paste them in the fields below.</td></tr>
      <tr><td colspan="2"><h4>Part 2: Get Authorization Code</h4></td></tr>
      <tr><td>1️⃣</td><td>To get the authorization code, edit this URL, replacing <b>CLIENT_ID</b> with your Client ID:<br>
      <i>https://accounts.google.com/o/oauth2/v2/auth?client_id=CLIENT_ID&amp;redirect_uri=http://localhost&amp;response_type=code&amp;scope=https://www.googleapis.com/auth/drive&amp;access_type=offline&amp;prompt=consent</i><br>     
        </td></tr>
      <tr><td>2️⃣</td><td>After visiting the authorization URL and clicking "Allow" your browser will redirect to <code>http://localhost/?code=...</code> (this will fail to load, that's OK!). Copy the code from your browser's redirect URL. You can copy either:<br>
        • The full URL: <code>http://localhost/?code=4/0A...</code><br>
        • OR just the code: <code>4/0A...</code><br></td></tr>
      <tr><td>3️⃣</td><td>Paste the code (or full URL) into the <b>"Authorization Code"</b> field in the Google Drive settings below.</td></tr>
      <tr><td colspan="2"><h4>Part 3: Complete Setup</h4></td></tr>
      <tr><td>1️⃣</td><td>Click <b>Submit</b>. Your authorization code is automatically exchanged for permanent token. You only need to do this once! </td></tr>
      <tr><td>2️⃣</td><td>Run <b>Channels - Test Auto-Backup</b> </td></tr>
      <tr><td>3️⃣</td><td>Visit <u><a href="https://drive.google.com/" target="_blank">Google Drive 🔗</a></u> to confirm that channel.backup is there. If not, check the LND logs for error messages. </td></tr>
    </tbody>
  </table>
  <br>
  <div>💡 <b>Troubleshooting:</b></div>
  <ul>
    <li>If you see "access_blocked", make sure you added your email as a Test User in step 3 of part 1. </li>
    <li>If authorization fails, double-check you copied the complete authorization code</li>
    <li>The token lasts indefinitely with automatic refresh - you only authorize once</li>
  </ul>
</details>
  </details>