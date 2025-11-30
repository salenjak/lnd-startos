import { sdk } from '../sdk'
import { customConfigJson } from '../fileModels/custom-config.json'
import * as crypto from 'crypto'
import * as http from 'http';
import * as https from 'https';
import { URLSearchParams } from 'url';

const VALID_PROVIDERS = ['gdrive', 'dropbox', 'nextcloud', 'sftp', 'email'] as const

function parseRcloneConf(conf: string): Record<string, Record<string, string>> {
  const sections: Record<string, Record<string, string>> = {}
  let currentSection = ''
  conf.split('\n').forEach(line => {
    line = line.trim()
    if (line.startsWith('[') && line.endsWith(']')) {
      currentSection = line.slice(1, -1)
      sections[currentSection] = {}
    } else if (line.includes('=') && currentSection) {
      const eqIndex = line.indexOf('=')
      const k = line.substring(0, eqIndex).trim()
      const v = line.substring(eqIndex + 1).trim()
      sections[currentSection][k] = v
    }
  })
  return sections
}

function removeSection(conf: string, sectionName: string): string {
  const lines = conf.split('\n')
  let inSection = false
  const newLines = lines.filter(line => {
    const trimmed = line.trim()
    if (trimmed === `[${sectionName}]`) {
      inSection = true
      return false
    }
    if (inSection && trimmed.startsWith('[') && trimmed.endsWith(']')) {
      inSection = false
      return true
    }
    return !inSection
  })
  return newLines.join('\n').trim()
}

function obscure(plain: string): string {
  const key = Buffer.from('9c935b48730a554d6bfd7c63c886a92bd390198eb8128afbf4de162b8b95f638', 'hex')
  const iv = crypto.randomBytes(16)
  const cipher = crypto.createCipheriv('aes-256-ctr', key, iv)
  const encrypted = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()])
  let base64 = Buffer.concat([iv, encrypted]).toString('base64')
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function isObscured(value: string): boolean {
  if (!value) return false
  try {
    const padded = value + '==='.slice(value.length % 4)
    const bs = Buffer.from(padded, 'base64')
    return bs.length >= 16
  } catch {
    return false
  }
}

function generateGoogleAuthUrl(clientId: string): string {
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: 'http://localhost',
    response_type: 'code',
    scope: 'https://www.googleapis.com/auth/drive',
    access_type: 'offline',
    prompt: 'consent',
  })
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`
}

export const addBackupTarget = sdk.Action.withInput(
  'add-backup-target',
  async ({ effects }) => ({
    name: 'Channels - Auto-Backup',
    description: 'Add and configure backup providers for your channel.backup file. You can select multiple providers (Nextcloud, Dropbox, Google Drive, Email, SFTP) and multiple email recipients.',
    warning: `<details>
  <summary>
  <b>IMPORTANT</b></summary>
  <div><br>CHANNEL.BACKUP file is encrypted with your AEZEED Cipher Seed so it can be stored on third-party servers without any risk.<br> Email is the most recommended backup method but for maximum security use it with at least one additional backup provider.</div>
  <h3>Setup examples:</h3>
  <hr>
  <details>
  <summary><b>EMAIL</b></summary>
  <br>
  <div>In the example below, SMTP2GO is used as SMTP provider because the setup is straightforward and the service is free.</div>
  <br><table class="g-table tui-space_top-4">
    <thead><tr><th>Step</th><th>Action</th></tr></thead>
    <tbody>
      <tr><td>1️⃣</td><td><b>Sign up</b> at <u><a href="https://www.smtp2go.com/" target="_blank">smtp2go.com</a></u> (Free: 1k emails/mo)</td></tr>
      <tr><td>2️⃣</td><td>Verify email → Log in at <u><a href="https://app.smtp2go.com/" target="_blank">app.smtp2go.com</a></u></td></tr>
      <tr><td>3️⃣</td><td><b>Sending → Verified Senders</b>: Add & verify your "From" email</td></tr>
      <tr><td>4️⃣</td><td><b>Sending → SMTP Users → Add SMTP User</b>: Create & save username & password</td></tr>
      <tr><td>5️⃣</td><td>Return to Channels - Auto-Backup: Enable Email as backup provider & enter config:<br>
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
    <br><table class="g-table tui-space_top-4">
    <thead>
      <tr><th>✅ Recommended SMTP Providers</th></tr>
    </thead>
    <tbody>
      <tr><td><b>SMTP2Go</b> ⇢ <u><a href="https://www.smtp2go.com/" target="_blank">smtp2go.com 🔗</a></u><br/>– Free tier: 1,000 emails/month, no domain required.<br/>– SMTP server: <code>mail.smtp2go.com</code>, port 465 or 587.</td></tr>
      <tr><td><b>MailerSend</b> ⇢ <u><a href="https://www.mailersend.com/" target="_blank">mailersend.com 🔗</a></u><br/>– Free tier: 500 emails/month, no domain required.<br/>– Use your <b>verified email</b> as "From" address.</td></tr>
      <tr><td><b>Gmail</b> ⇢ <u><a href="https://mail.google.com/" target="_blank">mail.google.com 🔗</a></u><br/>– Free tier: 500 emails/day, requires App Password (2FA must be ON).<br/>⚠️ Emails can <b>only be sent to @gmail.com addresses</b> unless you verify a custom "From" address.</td></tr>
      <tr><td><b>Proton Mail</b> ⇢ <u><a href="https://mail.proton.me/" target="_blank">mail.proton.me 🔗</a></u><br/>– Free tier: NONE, smtp access requires <b>paid plan</b>.<br/>– SMTP server: <code>smtp.proton.me</code>, port 465 or 587.</td></tr>
     </tbody>
  </table>
</details>
<hr>
<details>
  <summary><b>SFTP</b></summary>
    <br><table class="g-table tui-space_top-4">
    <thead><tr><th>Step</th><th>Action</th></tr></thead>
    <tbody>
      <tr><td>1️⃣</td><td><b>Choose a remote server / LAN computer</b> (desktop, laptop, Raspberry Pi, or NAS) that stays powered on.</td></tr>
      <tr><td>2️⃣</td><td><b>Check & install SSH/SFTP server (if missing)</b>:<br>
        – <b>Linux (Ubuntu/Debian)</b>:<br>
          &nbsp;&nbsp;• Check: <code>sudo systemctl is-active ssh</code><br>
          &nbsp;&nbsp;• If <code>inactive</code>, run:<br>
          &nbsp;&nbsp;&nbsp;&nbsp;<code>sudo apt update && sudo apt install openssh-server</code><br>
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
          &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<code>ssh-keygen -t ed25519 -C "lnd-backup" -f "$env:USERPROFILE\\.ssh\\lnd_backup"</code><br>
          &nbsp;&nbsp;• Your private key is at:<br>
          &nbsp;&nbsp;&nbsp;&nbsp;– Linux/macOS: <code>~/.ssh/lnd_backup</code><br>
          &nbsp;&nbsp;&nbsp;&nbsp;– Windows: <code>%USERPROFILE%\\.ssh\\lnd_backup</code><br>
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
  <summary><b>Dropbox</b></summary>
    <br><table class="g-table tui-space_top-4">
    <thead><tr><th>Step</th><th>Action</th></tr></thead>
    <tbody>
      <tr><td>1️⃣</td><td>Go to <u><a href="https://www.dropbox.com/developers/apps" target="_blank">Dropbox App Console 🔗</a></u> → Create app (or use existing)</td></tr>
      <tr><td>2️⃣</td><td>Choose <b>Scoped access</b> → <b>App folder</b></td></tr>
      <tr><td>3️⃣</td><td>Give it a name → Create app</td></tr>
      <tr><td>4️⃣</td><td>Permissions → enable <code>files.content.write</code> and <code>files.content.read</code></td></tr>
      <tr><td>5️⃣</td><td>Copy <b>App key</b> (client_id) and <b>App secret</b> (client_secret)</td></tr>
      <tr><td>6️⃣</td><td>💡 If you already have Refresh Token just proceed to step 7.<br>
        <hr>Open your browser and paste this Dropbox OAuth 2 URL, replacing <b><i>APP_KEY</i></b> with your App key:<br><br>
        <i>https://www.dropbox.com/oauth2/authorize?client_id=APP_KEY&response_type=code&token_access_type=offline</i><br><br>
        <span>Log in to Dropbox → Allow the app: Copy the <b>Dropbox Authorization Code</b> from the URL (after ?code=) or from the page if displayed.</span><br></td></tr>
      <tr><td>7️⃣</td><td>In LND → Channels - Auto-Backup → Dropbox settings, paste:<ul><li><b>Dropbox App Key</b>: Your App key</li><li><b>Dropbox App Secret</b>: Your App secret</li><li><b>Dropbox Authorization Code</b>: The code from step 6 (fill only if you do NOT already have a Refresh Token)</li><li><b>Dropbox Refresh Token</b>: Paste your existing refresh token here if you have one OR leave empty → a new one will be generated automatically (Authorization Code is then required)</li></ul></td></tr>
      <tr><td>8️⃣</td><td>Folder path: enter new path or leave default <code>lnd-backups</code></td></tr>
      <tr><td>9️⃣</td><td>Click <b>Submit</b> → Provided settings will be exchanged for Dropbox Refresh Token automatically. Run <b>Channels - Test Auto-Backup</b>.</td></tr>
    </tbody>
  </table>
  </details>
<hr>
<details>
  <summary><b>Nextcloud</b></summary>
    <br><table class="g-table tui-space_top-4">
    <thead><tr><th>Step</th><th>Action</th></tr></thead>
    <tbody>
      <tr><td>1️⃣</td><td><b>Log in</b> to your Nextcloud instance.</td></tr>
      <tr><td>2️⃣</td><td>Go to <b>Settings → Security → Devices & sessions</b>.</td></tr>
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
  <summary><b>Google Drive</b></summary>
  <div><br><b>Works with FREE personal Google accounts!</b></div>
  <br>
  <div>Google Drive requires OAuth authorization. This is a 3-step process that takes about 2 minutes.</div>
    <br><table class="g-table tui-space_top-4">
    <thead><tr><th>Step</th><th>Action</th></tr></thead>
    <tbody>
      <tr><td colspan="2"><h4>Part 1: Create OAuth Credentials (One-time setup)</h4></td></tr>
      <tr><td>1️⃣</td><td>Go to <u><a href="https://console.cloud.google.com/" target="_blank">Google Cloud Console 🔗</a></u> → Create a <b>new project</b> (e.g., "lnd-backup").</td></tr>
      <tr><td>2️⃣</td><td>Enable the <b>Google Drive API</b>:<br>
        • Go to "APIs & Services → Library"<br>
        • Search "Google Drive API"<br>
        • Click "Enable"</td></tr>
      <tr><td>3️⃣</td><td>Configure OAuth consent screen:<br>
        • Go to "APIs & Services → OAuth consent screen"<br>
        • User Type: <b>External</b> → Create<br>
        • App name: <code>LND Backup</code><br>
        • User support email: Your email<br>
        • Developer contact: Your email<br>
        • Save and Continue through all screens<br>
        • On "Test users" screen: <b>Add your email as a test user</b><br>
        • Save and Continue</td></tr>
      <tr><td>4️⃣</td><td>Create OAuth credentials:<br>
        • Go to "APIs & Services → Credentials"<br>
        • Click <b>"Create Credentials" → "OAuth client ID"</b><br>
        • Application type: <b>Desktop app</b><br>
        • Name: <code>LND Backup Client</code><br>
        • Click <b>Create</b></td></tr>
      <tr><td>5️⃣</td><td>Copy the <b>Client ID</b> and <b>Client Secret</b> shown in the popup. Paste them in the fields below.</td></tr>
      <tr><td colspan="2"><h4>Part 2: Get Authorization Code</h4></td></tr>
      <tr><td>1️⃣</td><td>To get the authorization code, edit this URL, replacing <b>CLIENT_ID</b> with your Client ID:<br>
      <i>https://accounts.google.com/o/oauth2/v2/auth?client_id=CLIENT_ID&redirect_uri=http://localhost&response_type=code&scope=https://www.googleapis.com/auth/drive&access_type=offline&prompt=consent</i><br>     
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
  </details>`,
  allowedStatuses: 'only-running',
  group: 'Security',
  visibility: 'enabled',
}),
sdk.InputSpec.of({
  providers: sdk.Value.multiselect({
    name: 'Enabled Backup Providers 🞃',
    description: 'Enable or disable backup providers. Unchecking a provider deletes its settings from the config on submit. Settings for disabled providers are discarded on submit.',
    default: [],
    values: {
    'email': 'Email',
    'sftp': 'SFTP',
    'dropbox': 'Dropbox',
    'nextcloud': 'Nextcloud',
    'gdrive': 'Google Drive',
  },
  }),
  email: sdk.Value.object(
    {
      name: 'Email Settings',
      description: `<div>Here you can configure settings for Email backup. Your <code>channel.backup</code> file will be <b>automatically attached and emailed</b> every time it changes — that means whenever you <b>open a new channel</b>,
  <b>close a channel</b>, or Lightning updates the backup for any other reason.</div>
<div><b>You'll receive an email within seconds</b> of every channel state change.</div><br> (Check Email setup example in "IMPORTANT" section above for more info).`,
    },
    sdk.InputSpec.of({
      'email-from': sdk.Value.text({
        name: 'Email Sender Address',
        description: 'Your sender email (e.g., yourusername@gmail.com), which will be used as the From address. If you need an SMTP server, use the same email address with whichever provider you decide to open an account with.',
        default: '',
        required: false,
        patterns: [
    {
      regex: '^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$',
      description: 'Must be a valid email address'
    }
  ],
      }),
      'email-to': sdk.Value.text({
        name: 'Email Recipient Address',
        description: `Recipient email can be the same as sender, but try to add at least 2 email recipients addresses and try to mix email providers. Example: <code>youremail@protonmail.com, youremail@gmail.com, youremail@tutanota.com, famillymemberemail@gmail.com, friendemail@gmail.com</code></div>`,
        default: '',
        required: false,
        patterns: [
    {
      regex: '^([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,})(\\s*,\\s*[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,})*$',
      description: 'Must be one or more valid email addresses separated by commas'
    }
  ],
      }),
      'email-smtp-server': sdk.Value.text({
        name: 'Email SMTP Server',
        description: `<table><thead><tr><th>✅ Recommended SMTP Providers</th></tr></thead>
                        <tbody>
                        <tr><td><b>MailerSend</b> ⇢ <a href="https://www.mailersend.com/" target="_blank">mailersend.com 🔗</a><br/>– Free tier: 500 emails/month, no domain required.<br/>– Use your <b>verified email</b> as "From" address.</td></tr>
                        <tr><td><b>SMTP2Go</b> ⇢ <a href="https://www.smtp2go.com/" target="_blank">smtp2go.com 🔗</a><br/>– Free tier: 1,000 emails/month, no domain required.<br/>– SMTP server: <code>mail.smtp2go.com</code>, port 465 or 587.</td></tr>
                        <tr><td><b>Gmail</b> ⇢ <a href="https://mail.google.com/" target="_blank">mail.google.com 🔗</a><br/>– Free tier: 500 emails/day, requires App Password (2FA must be ON).<br/>⚠️ Emails can <b>only be sent to @gmail.com addresses</b> unless you verify a custom "From" address.</td></tr>
                        <tr><td><b>Proton Mail</b> ⇢ <a href="https://mail.proton.me/" target="_blank">mail.proton.me 🔗</a><br/>– Free tier: NONE, smtp access requires <b>paid plan</b>.<br/>– SMTP server: <code>smtp.proton.me</code>, port 465 or 587.</td></tr>
                        </tbody>
                        </table>`,
        default: 'smtp.gmail.com',
        required: false,
        patterns: [
    {
      regex: '^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$',
      description: 'Must be a valid hostname'
    }
  ],
      }),
      'email-smtp-port': sdk.Value.text({
        name: 'Email SMTP Port',
        description: '465 for SSL, 587 for TLS.',
        default: '465',
        required: false,
        patterns: [
                  { regex: '^([1-9]|[1-9]\\d{1,3}|[1-5]\\d{4}|6[0-4]\\d{3}|65[0-4]\\d{2}|655[0-2]\\d|6553[0-5])$', description: 'Must be between 1 and 65535. E.g., use 587 (TLS) or 465 (SSL).' }
                ],
      }),
      'email-smtp-user': sdk.Value.text({
        name: 'Email SMTP Username',
        description: 'Usually the sender email.',
        default: '',
        required: false,
        patterns: [
                  { regex: '^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$', description: 'Can contain letters, numbers, @, underscores, and hyphens.' }
                ]
      }),
      'email-smtp-pass': sdk.Value.text({
        name: 'Email SMTP Password',
        description: 'Enter your (Sender) email account password. Gmail users: use an App Password (required if 2FA is on).',
        default: '',
        masked: true,
        required: false,
      }),
    }),
  ),
   sftp: sdk.Value.object(
    {
      name: 'SFTP Settings',
      description: `Configure SFTP backups to your remote or local server using a password or SSH key. Although you can use a LAN computer (desktop or laptop), keep in mind that it needs to stay powered on 24/7. For better reliability, consider options like a Raspberry Pi or NAS.<br> (Check SFTP setup example in "IMPORTANT" section above for more info).`,
    },
    sdk.InputSpec.of({
      auth: sdk.Value.union({
        name: 'Select Authentication Type',
        description: 'Choose password or SSH key.',
        default: 'password',
        variants: sdk.Variants.of({
          password: {
            name: 'Password',
            spec: sdk.InputSpec.of({
              'sftp-host': sdk.Value.text({
                name: 'SFTP Host',
                description: 'Hostname or IP of the SFTP server / LAN device (desktop, laptop, Raspberry Pi, NAS ...).',
                default: '',
                required: false,
                patterns: [
                  { regex: '^((([a-zA-Z0-9]|[a-zA-Z0-9][a-zA-Z0-9\\-]*[a-zA-Z0-9])\\.)+([A-Za-z0-9]|[A-Za-z0-9][a-zA-Z0-9\\-]*[a-zA-Z0-9])|(\\d{1,3}\\.){3}\\d{1,3})$', description: 'Must be a valid domain or IP address.' }
                ]
              }),
              'sftp-user': sdk.Value.text({
                name: 'SFTP Username',
                description: 'Login username.',
                default: '',
                required: false,
                patterns: [
                  { regex: '^([a-zA-Z0-9._-]+|[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,})$', description: 'Can contain letters, numbers, @, underscores, and hyphens.' }
                ]
              }),
              'sftp-pass': sdk.Value.text({
                name: 'SFTP Password',
                description: 'Login password.',
                default: '',
                masked: true,
                required: false,
              }),
              'sftp-port': sdk.Value.text({
                name: 'SFTP Port',
                description: 'Default port is 22. If you use shared hosting some providers use a different port (e.g., 2222) so check with your provider.',
                default: '22',
                required: false,
                patterns: [
                  { regex: '^([1-9]|[1-9]\\d{1,3}|[1-5]\\d{4}|6[0-4]\\d{3}|65[0-4]\\d{2}|655[0-2]\\d|6553[0-5])$', description: 'Must be between 1 and 65535.' }
                ]
              }),
              'sftp-path': sdk.Value.text({
                name: 'SFTP Folder Path',
                description: 'Path to the backup folder (e.g., <code>lnd-backups</code> or <code>subfolder/lnd-backups</code>). Use relative paths without a leading /.',
                default: 'lnd-backups',
                required: false,
                patterns: [
                  { regex: '^/?([a-zA-Z0-9_-]+/)*[a-zA-Z0-9_-]*$', description: 'Optional leading /, valid characters (alphanum, _, -).' }
                ]
              }),
            }),
          },
          key: {
            name: 'SSH Key',
            spec: sdk.InputSpec.of({
              'sftp-host': sdk.Value.text({
                name: 'SFTP Host',
                description: 'Hostname or IP of the SFTP server.',
                default: '',
                required: false,
                patterns: [
                  { regex: '^((([a-zA-Z0-9]|[a-zA-Z0-9][a-zA-Z0-9\\-]*[a-zA-Z0-9])\\.)+([A-Za-z0-9]|[A-Za-z0-9][a-zA-Z0-9\\-]*[a-zA-Z0-9])|(\\d{1,3}\\.){3}\\d{1,3})$', description: 'Must be a valid domain or IP address.' }
                ]
              }),
              'sftp-user': sdk.Value.text({
                name: 'SFTP Username',
                description: 'Login username.',
                default: '',
                required: false,
                patterns: [
                { regex: '^([a-zA-Z0-9._-]+|[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,})$', description: 'Can contain letters, numbers, @, underscores, and hyphens.' }
                ]
              }),
              'sftp-key': sdk.Value.text({
                name: 'SFTP Private Key',
                description: 'Paste your full SSH private key (starts with -----BEGIN OPENSSH PRIVATE KEY-----).',
                default: '',
                required: false,
                masked: false,
                patterns: [
    { regex: '^-----BEGIN OPENSSH PRIVATE KEY-----[\\s\\S]*-----END OPENSSH PRIVATE KEY-----\\s*$', description: 'Must be a valid OpenSSH private key PEM format.' }
                ]
              }),
              'sftp-port': sdk.Value.text({
                name: 'SFTP Port',
                description: 'Default port is 22. If you use shared hosting some providers use a different port (e.g., 2222) so check with your provider.',
                default: '22',
                required: false,
                patterns: [
                  { regex: '^([1-9]|[1-9]\\d{1,3}|[1-5]\\d{4}|6[0-4]\\d{3}|65[0-4]\\d{2}|655[0-2]\\d|6553[0-5])$', description: 'Must be between 1 and 65535.' }
                ]
              }),
              'sftp-path': sdk.Value.text({
                name: 'SFTP Folder Path',
                description: 'Path to the backup folder (e.g., <code>lnd-backups</code> or <code>subfolder/lnd-backups</code>). Use relative paths without a leading /.',
                default: 'lnd-backups',
                required: false,
                patterns: [
                  { regex: '^/?([a-zA-Z0-9_-]+/)*[a-zA-Z0-9_-]*$', description: 'Optional leading /, valid characters (alphanum, _, -).' }
                ]
              }),
            }),
          },
        }),
      }),
    }),
  ),
  dropbox: sdk.Value.object(
  {
    name: 'Dropbox Settings',
    description: `Provide either App Key + App Secret + Authorization Code to auto-generate Refresh Token or App Key + App Secret + Refresh Token.<br> (Check Dropbox setup example in "IMPORTANT" section above for more info)`,
  },
  sdk.InputSpec.of({
    'dropbox-client-id': sdk.Value.text({
      name: 'Dropbox App Key',
      description: 'From your Dropbox App Console → "App key". Required for long-lived refresh tokens. (Check Dropbox setup example in "IMPORTANT" section above for more info)',
      default: '',
      required: false,
    }),
    'dropbox-client-secret': sdk.Value.text({
      name: 'Dropbox App Secret',
      description: 'From your Dropbox App Console → "App secret". Required for long-lived refresh tokens. (Check Dropbox setup example in "IMPORTANT" section above for more info)',
      default: '',
      masked: true,
      required: false,
    }),
    'dropbox-auth-code': sdk.Value.text({
      name: 'Dropbox Authorization Code (if no Refresh Token)',
      description: `Open https://www.dropbox.com/oauth2/authorize?client_id=APP_KEY&response_type=code&token_access_type=offline in your browser, replacing APP_KEY with your App key. Log in to Dropbox, allow the app, and then copy the Dropbox Authorization Code from the URL (after ?code=) or from the page if displayed.`,
      default: '',
      masked: true,
      required: false,
    }),
    'dropbox-refresh-token': sdk.Value.text({
      name: `Dropbox Refresh Token (paste / generate using Auth Code)`,
      description: `If you already have a long-lived refresh token, paste it here. Otherwise, enter your App Key, App Secret, and Authorization Code in the fields above. After submission, a new Refresh Token will be generated. You can then copy it along with your App Key and App Secret for safekeeping.`,
      default: '',
      masked: true,
      required: false,
    }),
    'dropbox-path': sdk.Value.text({
      name: 'Dropbox Folder Path',
      description: 'Folder inside your App Folder (e.g., lnd-backups). Will be created automatically.',
      default: 'lnd-backups',
      required: false,
      patterns: [
        {
          regex: '^[a-zA-Z0-9_\\-/ ]+$',
          description: 'Valid folder path (alphanumeric, spaces, hyphens, underscores, forward slashes)'
        }
      ],
    }),
  })
),
  nextcloud: sdk.Value.object(
    {
      name: 'Nextcloud Settings',
      description: `Configure settings for Nextcloud backup.<br> (Check Nextcloud setup example in "IMPORTANT" section above for more info).`,
    },
    sdk.InputSpec.of({
      'nextcloud-url': sdk.Value.text({
        name: 'Nextcloud WebDAV URL',
        description: `Replace <b>your.nextcloud.com</b> with your domain and <b>yourusername</b> with your Nextcloud username. Base URL, e.g., https://your.nextcloud.com/remote.php/dav/files/yourusername/, https://youronionaddress.onion/remote.php/dav/files/yourusername/`,
        default: '',
        required: false,
      }),
      'nextcloud-user': sdk.Value.text({
        name: 'Nextcloud Username',
        description: 'Your login username. Default is admin.',
        default: '',
        required: false,
      }),
      'nextcloud-pass': sdk.Value.text({
        name: 'Nextcloud Password',
        description: `1️⃣	Log in to your Nextcloud instance.<br>
        2️⃣	Go to Settings → Security → Devices & sessions.<br>
        3️⃣	Under “App passwords”, create a new app password (e.g., “LND Backup”).<br>
        4️⃣	Copy the generated password — also save it as you won’t see it again!`,
        default: '',
        masked: true,
        required: false,
      }),
      'nextcloud-path': sdk.Value.text({
        name: 'Nextcloud Folder Path',
        description: 'Folder will be created if it doesn’t exist. Example: lnd-backups',
        default: 'lnd-backups',
        required: false,
      }),
    }),
  ),
  google: sdk.Value.object(
  {
    name: 'Google Drive Settings',
    description: `<div><b>Google Drive - Personal Accounts (Free)</b></div>
<div>Google Drive requires OAuth authorization. Provide either:<br>
• <b>Client ID + Client Secret + Authorization Code</b> → auto-generate Refresh Token<br>
• <b>Client ID + Client Secret + Refresh Token</b> → skip OAuth</div>`,
  },
  sdk.InputSpec.of({
    'gdrive-client-id': sdk.Value.text({
      name: 'Google OAuth Client ID',
      description: 'From Google Cloud Console → OAuth credentials. Example: ...-....apps.googleusercontent.com.<br> Follow the Google Drive setup example in the "IMPORTANT" section above to get OAuth Client ID.',
      default: '',
      required: false,
    }),
    'gdrive-client-secret': sdk.Value.text({
      name: 'Google OAuth Client Secret',
      description: 'From Google Cloud Console → OAuth credentials.<br> Follow the Google Drive setup example in the "IMPORTANT" section above to get OAuth Client Secret.',
      default: '',
      masked: true,
      required: false,
    }),
    'gdrive-auth-code': sdk.Value.text({
      name: 'Authorization Code (if no Refresh Token)',
      description: `<div>💡 To get the authorization code, replace <b>CLIENT_ID</b> with your Client ID and then open following URL in your browser:</div><br>
<code>https://accounts.google.com/o/oauth2/v2/auth?client_id=CLIENT_ID&redirect_uri=http://localhost&response_type=code&scope=https://www.googleapis.com/auth/drive&access_type=offline&prompt=consent</code>
<div>After visiting the authorization URL and clicking "Allow", paste the code from your browser's redirect URL here. You can paste either:<br>
        • The full URL: <code>http://localhost/?code=4/0A...</code><br>
        • OR just the code: <code>4/0A...</code><br>
        <br>Leave empty if you already have a refresh token.</div>`,
      default: '',
      masked: true,
      required: false,
    }),
    'gdrive-refresh-token': sdk.Value.text({
      name: 'Refresh Token (paste / generate using Authorization Code)',
      description: `If you already have a refresh token, paste it here. After successful OAuth, this field will show the generated token for backup.`,
      default: '',
      masked: true,
      required: false,
    }),
    'gdrive-path': sdk.Value.text({
      name: 'Google Drive Folder Path',
      description: 'Folder name in your Google Drive root (e.g., lnd-backups).',
      default: 'lnd-backups',
      required: false,
    }),
  }),
),
}),
async ({ effects }) => {
  const config = (await customConfigJson.read().once().catch(() => ({}))) as any
  const existingConf = config.rcloneConfig ? Buffer.from(config.rcloneConfig, 'base64').toString('utf8') : ''
  const sections = parseRcloneConf(existingConf)
  const getPath = (provider: string) => config.selectedRcloneRemotes?.find((r: string) => r.startsWith(provider + ':'))?.split(':')[1] || 'lnd-backups'
  const selectedProviders = VALID_PROVIDERS.filter(p => {
    if (p === 'email') return !!config.emailBackup
    return config.selectedRcloneRemotes?.some((r: string) => r.startsWith(p + ':'))
  }) as typeof VALID_PROVIDERS[number][]
  
  // Get Google Drive client ID to generate auth URL
  const gdriveSection = sections['gdrive'] || {}
  const existingClientId = gdriveSection.client_id || ''
  const authUrl = existingClientId ? generateGoogleAuthUrl(existingClientId) : ''
  
  return {
    providers: selectedProviders,
    email: {
      'email-from': config.emailBackup?.from || '',
      'email-to': config.emailBackup?.to || '',
      'email-smtp-server': config.emailBackup?.smtp_server || 'smtp.gmail.com',
      'email-smtp-port': config.emailBackup?.smtp_port?.toString() || '465',
      'email-smtp-user': config.emailBackup?.smtp_user || '',
      'email-smtp-pass': '',
    },
    sftp: (() => {
      const sftpSection = sections['sftp'] || {}
      let selection: 'password' | 'key' = 'password'
      let value: any = {
      'sftp-host': sftpSection.host || '',
      'sftp-user': sftpSection.user || '',
      'sftp-port': sftpSection.port || '22',
      'sftp-path': getPath('sftp'),
      }
      if (sftpSection.key_pem) {
      selection = 'key'
      value['sftp-key'] = ''
      } else if (sftpSection.pass) {
      selection = 'password'
      value['sftp-pass'] = ''
      }
      return { auth: { selection, value } }
    })(),
    google: {
  'gdrive-client-id': existingClientId,
  'gdrive-client-secret': gdriveSection.client_secret || '',
  'gdrive-auth-code': '', // Never pre-fill auth code
  'gdrive-refresh-token': (() => {
    try {
      const tokenObj = JSON.parse(gdriveSection.token || '{}');
      return tokenObj.refresh_token || '';
    } catch (e) {
      return '';
    }
  })(),
  'gdrive-path': getPath('gdrive'),
},
    dropbox: (() => {
      const dropboxSection = sections['dropbox'] || {}
      let refreshToken = ''
      try {
        const tokenObj = JSON.parse(dropboxSection.token || '{}')
        refreshToken = tokenObj.refresh_token || ''
        } catch (e) { /* ignore */ }
      return {
      'dropbox-client-id': dropboxSection.client_id || '',
      'dropbox-client-secret': dropboxSection.client_secret || '',
      'dropbox-refresh-token': refreshToken,
      'dropbox-path': getPath('dropbox'),
       }
    })(),
    nextcloud: {
      'nextcloud-url': sections['nextcloud']?.url || '',
      'nextcloud-user': sections['nextcloud']?.user || '',
      'nextcloud-pass': '',
      'nextcloud-path': getPath('nextcloud'),
    },
   
  }
},
async ({ effects, input }) => {
  try {
    const rawProviders = input.providers || []
    const providers = rawProviders.filter(p => VALID_PROVIDERS.includes(p as any)) as typeof VALID_PROVIDERS[number][]
    const config = (await customConfigJson.read().once().catch(() => ({}))) as any
    
    if (providers.length === 0) {
      await customConfigJson.merge(effects, {
        channelAutoBackupEnabled: false,
        selectedRcloneRemotes: [],
        enabledRemotes: [],
        emailBackup: null,
        emailEnabled: false,
        rcloneConfig: null,
      })
      return {
        version: '1',
        title: '⚠️ Channels - Auto-Backup: Disabled',
        message: `Channel auto-backup has been disabled. Please use built-in StartOS backup or download <b>channel.backup</b> manually (e.g. via RTL or ThunderHub) whenever you open/close channels.`,
        result: null,
      }
    }
    
    let updates: any = { channelAutoBackupEnabled: true }
    let existingConf = config.rcloneConfig ? Buffer.from(config.rcloneConfig, 'base64').toString('utf8') : ''
    let sections = parseRcloneConf(existingConf)
    let newSections = ''
    let newRemotes: string[] = []
    let newEnabled: string[] = []
    
    const previousCloudProviders = VALID_PROVIDERS.filter(p => p !== 'email' && !!sections[p]) as Exclude<typeof VALID_PROVIDERS[number], 'email'>[]
    let filteredSelected = config.selectedRcloneRemotes || []
    let filteredEnabled = config.enabledRemotes || []
    
    for (const prevProvider of previousCloudProviders) {
      if (!providers.includes(prevProvider)) {
        existingConf = removeSection(existingConf, prevProvider)
        filteredSelected = filteredSelected.filter((r: unknown) => typeof r === 'string' && !r.startsWith(prevProvider + ':'))
        filteredEnabled = filteredEnabled.filter((r: unknown) => typeof r === 'string' && !r.startsWith(prevProvider + ':'))
        delete sections[prevProvider]
      }
    }
    
    updates.selectedRcloneRemotes = filteredSelected
    updates.enabledRemotes = filteredEnabled
    
    if (!providers.includes('email') && config.emailBackup) {
      updates.emailBackup = null
      updates.emailEnabled = false
    }
    
    for (const provider of providers) {
      if (provider !== 'email') {
        const remoteName = provider
        const existingSection = sections[remoteName] || {}
        let path: string = ''
        let newSectionLines: string[] = [`[${remoteName}]`]
        
        switch (provider) {
          case 'gdrive': {
  path = input.google['gdrive-path']?.trim() ?? 
    config.selectedRcloneRemotes?.find((r: string) => r.startsWith(remoteName + ':'))?.split(':')[1] ?? 
    'lnd-backups'
  const clientId = input.google['gdrive-client-id']?.trim()
  const clientSecret = input.google['gdrive-client-secret']?.trim()
  const authCodeInput = input.google['gdrive-auth-code']?.trim()
  const refreshTokenInput = input.google['gdrive-refresh-token']?.trim()  // ← NEW
  // Check if we have existing config
  const existingClientId = existingSection.client_id || ''
  const existingClientSecret = existingSection.client_secret || ''
  const existingToken = existingSection.token || ''
  // Use new values if provided, otherwise use existing
  const finalClientId = clientId || existingClientId
  const finalClientSecret = clientSecret || existingClientSecret
  let finalToken = existingToken

  // ← NEW: If user provided a refresh token directly, use it
  if (refreshTokenInput && finalClientId && finalClientSecret) {
    const dummyExpiry = '2020-01-01T00:00:00Z'
    finalToken = JSON.stringify({
      access_token: "DUMMY",
      token_type: "Bearer",
      refresh_token: refreshTokenInput,
      expiry: dummyExpiry
    })
  }
  // If user provided a new authorization code, exchange it for tokens
  else if (authCodeInput && finalClientId && finalClientSecret) {
    console.log('Exchanging authorization code for Google Drive tokens...')
    // Extract code from URL if full URL was provided
    let authCode = authCodeInput
    if (authCodeInput.includes('code=')) {
      const match = authCodeInput.match(/code=([^&]+)/)
      if (match) {
        authCode = match[1]
      }
    }
    // Exchange authorization code for tokens using Google OAuth2 API
    try {
      const tokenResponse = await new Promise<any>((resolve, reject) => {
        const postData = new URLSearchParams({
          code: authCode,
          client_id: finalClientId,
          client_secret: finalClientSecret,
          redirect_uri: 'http://localhost',
          grant_type: 'authorization_code',
        }).toString()
        const options = {
          hostname: 'oauth2.googleapis.com',
          path: '/token',
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Content-Length': postData.length
          }
        }
        const req = https.request(options, (res) => {
          let data = ''
          res.on('data', (chunk) => { data += chunk })
          res.on('end', () => {
            if (res.statusCode !== 200) {
              reject(new Error(`Google OAuth failed (${res.statusCode}): ${data}`))
            } else {
              try {
                resolve(JSON.parse(data))
              } catch (e) {
                reject(new Error(`Failed to parse Google response: ${data}`))
              }
            }
          })
        })
        req.on('error', reject)
        req.write(postData)
        req.end()
      })
      // Validate token response
      if (!tokenResponse.access_token || !tokenResponse.refresh_token) {
        throw new Error('Google did not return valid tokens. Make sure you copied the complete authorization code.')
      }
      // Format token for rclone
      const expiry = new Date(Date.now() + (tokenResponse.expires_in * 1000)).toISOString()
      finalToken = JSON.stringify({
        access_token: tokenResponse.access_token,
        token_type: tokenResponse.token_type || 'Bearer',
        refresh_token: tokenResponse.refresh_token,
        expiry: expiry
      })
      console.log('✅ Successfully obtained Google Drive tokens')
    } catch (err) {
      console.error('Failed to exchange authorization code:', err)
      throw new Error(`Failed to authorize with Google: ${(err as Error).message}. Please try again and make sure you copied the complete authorization code from the redirect URL.`)
    }
  }

  if (!finalClientId || !finalClientSecret) {
    throw new Error('Google Drive requires Client ID and Client Secret.')
  }
  if (!finalToken) {
    const authUrl = generateGoogleAuthUrl(finalClientId)
    throw new Error(`Google Drive authorization required. Please visit this URL to authorize:
${authUrl}
Then paste the authorization code or refresh token in the fields above and submit again.`)
  }
  newSectionLines.push('type = drive')
  newSectionLines.push('scope = drive')
  newSectionLines.push(`client_id = ${finalClientId}`)
  newSectionLines.push(`client_secret = ${finalClientSecret}`)
  newSectionLines.push(`token = ${finalToken}`)
  updates.selectedRcloneRemotes = updates.selectedRcloneRemotes.filter(
    (r: unknown) => typeof r === 'string' && !r.startsWith('gdrive:')
  )
  updates.enabledRemotes = updates.enabledRemotes.filter(
    (r: unknown) => typeof r === 'string' && !r.startsWith('gdrive:')
  )
  break
}
          
          case 'dropbox': {
            path = input.dropbox['dropbox-path']?.trim() ??
              config.selectedRcloneRemotes?.find((r: string) => r.startsWith(remoteName + ':'))?.split(':')[1] ??
              'lnd-backups';

            const clientId = input.dropbox['dropbox-client-id']?.trim();
            const clientSecret = input.dropbox['dropbox-client-secret']?.trim();
            const authCode = input.dropbox['dropbox-auth-code']?.trim();
            const refreshToken = input.dropbox['dropbox-refresh-token']?.trim();

            const existingToken = existingSection.token;
            const hasValidExistingConfig = !!existingToken && (
              existingToken.includes('"refresh_token"') ||
              (existingToken.includes('"access_token"') && !existingToken.includes('"access_token":""'))
            );
            const existingClientId = existingSection.client_id || '';
            const existingClientSecret = existingSection.client_secret || '';

            const exchangeCode = async (clientId: string, clientSecret: string, authCode: string): Promise<any> => {
              return new Promise((resolve, reject) => {
                const postData = new URLSearchParams({
                  code: authCode,
                  grant_type: 'authorization_code',
                }).toString();

                const options = {
                  hostname: 'api.dropboxapi.com',
                  path: '/oauth2/token',
                  method: 'POST',
                  headers: {
                    'Authorization': `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'Content-Length': postData.length
                  }
                };

                const req = https.request(options, (res) => {
                  let data = '';
                  res.on('data', (chunk) => { data += chunk; });
                  res.on('end', () => {
                    if (res.statusCode !== 200) {
                      reject(new Error(`Dropbox token exchange failed: ${res.statusCode} - ${data}`));
                    } else {
                      try {
                        const json = JSON.parse(data);
                        resolve(json);
                      } catch (e) {
                        reject(e);
                      }
                    }
                  });
                });

                req.on('error', reject);
                req.write(postData);
                req.end();
              });
            };

            if (clientId && clientSecret && authCode) {
              const tokens = await exchangeCode(clientId, clientSecret, authCode);
              const { access_token, refresh_token, expires_in } = tokens;
              if (!refresh_token) {
                throw new Error('Failed to obtain refresh token from Dropbox.');
              }
              const expiry = new Date(Date.now() + (expires_in * 1000)).toISOString();
              newSectionLines.push('type = dropbox');
              newSectionLines.push(`client_id = ${clientId}`);
              newSectionLines.push(`client_secret = ${clientSecret}`);
              newSectionLines.push(`token = {"access_token":"${access_token}","token_type":"bearer","refresh_token":"${refresh_token}","expiry":"${expiry}"}`);
            } else if (clientId && clientSecret && refreshToken) {
              newSectionLines.push('type = dropbox');
              newSectionLines.push(`client_id = ${clientId}`);
              newSectionLines.push(`client_secret = ${clientSecret}`);
              newSectionLines.push(`token = {"access_token":"DUMMY","token_type":"bearer","refresh_token":"${refreshToken}","expiry":"2020-01-01T00:00:00Z"}`);
            } else if (hasValidExistingConfig && existingClientId && existingClientSecret) {
              newSectionLines.push('type = dropbox');
              newSectionLines.push(`client_id = ${existingClientId}`);
              newSectionLines.push(`client_secret = ${existingClientSecret}`);
              newSectionLines.push(`token = ${existingToken}`);
            } else {
              throw new Error('Dropbox: Provide either (App Key + App Secret + Authorization Code) or (App Key + App Secret + Refresh Token).');
            }

            updates.selectedRcloneRemotes = updates.selectedRcloneRemotes.filter((r: unknown) => typeof r === 'string' && !r.startsWith('dropbox:'));
            updates.enabledRemotes = updates.enabledRemotes.filter((r: unknown) => typeof r === 'string' && !r.startsWith('dropbox:'));
            break;
          }
          
          case 'nextcloud': {
            path = input.nextcloud['nextcloud-path']?.trim() ?? config.selectedRcloneRemotes?.find((r: string) => r.startsWith(remoteName + ':'))?.split(':')[1] ?? 'lnd-backups'
            const url = input.nextcloud['nextcloud-url']?.trim() || existingSection.url || ''
            const user = input.nextcloud['nextcloud-user']?.trim() || existingSection.user || ''
            let passValue = existingSection.pass || ''
            const passInput = input.nextcloud['nextcloud-pass']?.trim()
            if (passInput) {
              passValue = obscure(passInput)
            } else if (passValue && !isObscured(passValue)) {
              passValue = obscure(passValue)
            }
            if (!url.trim() || !user.trim() || !passValue.trim()) throw new Error('Nextcloud URL, username, and password are required.')
            
            newSectionLines.push('type = webdav')
            newSectionLines.push(`url = ${url}`)
            newSectionLines.push('vendor = nextcloud')
            newSectionLines.push(`user = ${user}`)
            newSectionLines.push(`pass = ${passValue}`)
            
            if (url.includes('.onion')) {
              newSectionLines.push('http_proxy = socks5://10.0.3.1:9050')
              newSectionLines.push('https_proxy = socks5://10.0.3.1:9050')
              newSectionLines.push('no_check_certificate = true')
            }

            updates.selectedRcloneRemotes = updates.selectedRcloneRemotes.filter((r: unknown) => typeof r === 'string' && !r.startsWith('nextcloud:'))
            updates.enabledRemotes = updates.enabledRemotes.filter((r: unknown) => typeof r === 'string' && !r.startsWith('nextcloud:'))
            break
          }
          
          case 'sftp': {
            const sftpInput = input.sftp.auth;
            const authInput = sftpInput.value;
            const host = (authInput as any)['sftp-host']?.trim() || existingSection.host || '';
            const user = (authInput as any)['sftp-user']?.trim() || existingSection.user || '';
            const port = (authInput as any)['sftp-port']?.trim() || existingSection.port || '22';
            path = (authInput as any)['sftp-path']?.trim() ||
              config.selectedRcloneRemotes?.find((r: string) => r.startsWith('sftp:'))?.split(':')[1] ||
              'lnd-backups';

            if (!host || !user) {
              throw new Error('SFTP host and username are required.');
            }

            newSectionLines.push('type = sftp');
            newSectionLines.push(`host = ${host}`);
            newSectionLines.push(`user = ${user}`);
            newSectionLines.push('key_use_agent = false');
            
            if (host.endsWith('.onion')) {
              newSectionLines.push('socks_proxy = 10.0.3.1:9050');
              newSectionLines.push('shell_type = unix');
              newSectionLines.push('md5sum_command = md5sum');
              newSectionLines.push('sha1sum_command = sha1sum');
            }
            
            newSectionLines.push(`port = ${port}`);
            
            if (sftpInput.selection === 'password') {
              const passInput = (authInput as any)['sftp-pass']?.trim();
              let passValue = existingSection.pass || '';
              if (passInput) {
                passValue = obscure(passInput);
              } else if (passValue && !isObscured(passValue)) {
                passValue = obscure(passValue);
              }
              if (passValue) {
                newSectionLines.push(`pass = ${passValue}`);
              }
            } else if (sftpInput.selection === 'key') {
              const keyInput = (authInput as any)['sftp-key'];
              let keyValue = '';

              if (keyInput && keyInput.trim()) {
                const begin = '-----BEGIN OPENSSH PRIVATE KEY-----';
                const end = '-----END OPENSSH PRIVATE KEY-----';
                const normalizedKey = keyInput.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();

                if (!normalizedKey.includes(begin) || !normalizedKey.includes(end)) {
                  throw new Error('Invalid SSH key: missing BEGIN/END markers.');
                }
                
                const beginIdx = normalizedKey.indexOf(begin);
                const endIdx = normalizedKey.indexOf(end);

                if (beginIdx === -1 || endIdx === -1 || endIdx <= beginIdx) {
                  throw new Error('Invalid SSH key: malformed structure.');
                }

                const header = begin;
                const footer = end;
                const bodyStart = beginIdx + begin.length;
                const bodyEnd = endIdx;
                const body = normalizedKey.substring(bodyStart, bodyEnd).replace(/\s+/g, '');

                const lines = [header];
                for (let i = 0; i < body.length; i += 70) {
                  lines.push(body.substring(i, i + 70));
                }
                lines.push(footer);

                const reformattedKey = lines.join('\n');
                keyValue = reformattedKey.replace(/\n/g, '\\n');
              } else if (existingSection.key_pem) {
                keyValue = existingSection.key_pem;
              }

              if (!keyValue) {
                throw new Error('SFTP private key is required.');
              }

              newSectionLines.push(`key_pem = ${keyValue}`);
            } else {
              throw new Error('Invalid SFTP auth selection.');
            }

            updates.selectedRcloneRemotes = (updates.selectedRcloneRemotes || []).filter((r: unknown) => typeof r === 'string' && !r.startsWith('sftp:'));
            updates.enabledRemotes = (updates.enabledRemotes || []).filter((r: unknown) => typeof r === 'string' && !r.startsWith('sftp:'));
            break;
          }
        }
        
        newSections += newSectionLines.join('\n') + '\n'
        existingConf = removeSection(existingConf, remoteName)
        const remotePath = `${remoteName}:${path}`
        newRemotes.push(remotePath)
        newEnabled.push(remotePath)
      } else {
        // Email provider
        const from = input.email['email-from']?.trim() || config.emailBackup?.from || ''
        const to = input.email['email-to']?.trim() || config.emailBackup?.to || ''
        const server = input.email['email-smtp-server']?.trim() || config.emailBackup?.smtp_server || 'smtp.gmail.com'
        const port = input.email['email-smtp-port']?.trim() || config.emailBackup?.smtp_port?.toString() || '465'
        const user = input.email['email-smtp-user']?.trim() || config.emailBackup?.smtp_user || ''
        const pass = input.email['email-smtp-pass']?.trim() || config.emailBackup?.smtp_pass || ''
        if (!from.trim() || !to.trim() || !user.trim() || !pass.trim()) throw new Error('Email from, to, SMTP user, and password are required.')
        updates.emailBackup = { from, to, smtp_server: server, smtp_port: parseInt(port), smtp_user: user, smtp_pass: pass }
        updates.emailEnabled = true
      }
    }
    
    const finalConf = (existingConf.trim() + '\n' + newSections.trim()).trim()
    if (finalConf) {
      updates.rcloneConfig = Buffer.from(finalConf, 'utf8').toString('base64')
    } else {
      updates.rcloneConfig = null
    }
    
    if (newRemotes.length) {
      updates.selectedRcloneRemotes = [...updates.selectedRcloneRemotes, ...newRemotes]
    }
    if (newEnabled.length) {
      updates.enabledRemotes = [...updates.enabledRemotes, ...newEnabled]
    }
    
    await customConfigJson.merge(effects, updates)
    
    return {
      version: '1',
      title: '✅ Backup Provider(s) Added/Edited',
      message: `Your <b>channel.backup</b> will be synced to the selected provider(s) whenever a channel is opened or closed.<br><hr>
                💡 Please test backup provider(s) by clicking <b>Channels - Test Auto-Backup</b>, then check the LND logs to confirm success or failure for every enabled provider.<br>
                Also, verify that the backup folders contain the channel.backup file.`,
      result: null,
    }
  } catch (e) {
    console.error('addBackupTarget submit error:', e)
    return {
      version: '1',
      title: 'Error',
      message: (e as Error).message || 'An unexpected error occurred. Please try again.',
      result: null,
    }
  }
}
)