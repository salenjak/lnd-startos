// actions/addBackupTarget.ts
import { sdk } from '../sdk'
import { customConfigJson } from '../fileModels/custom-config.json'
import * as crypto from 'crypto'

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
      const [k, v] = line.split('=', 2).map(s => s.trim())
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

export const addBackupTarget = sdk.Action.withInput(
  'add-backup-target',
  async ({ effects }) => ({
    name: 'Channels - Auto-Backup',
    description: 'Add and configure backup targets for your channel.backup file. You can select multiple providers (Nextcloud, Dropbox, Google, Email, SFTP) and multiple email recipients.',
warning: `<details>
  <summary style="background: var(--tui-background-neutral-1);padding: 0.5rem;border-radius: 1rem;cursor: pointer;"><b>IMPORTANT   <span tuiappearance="" tuiicons="" tuiiconbutton="" size="m" iconstart="@tui.chevron-down" type="button" class="button" style="border-radius: 100%; --t-icon-start: url(assets/taiga-ui/icons/chevron-down.svg);" data-appearance="warning" data-icon-start="svg" data-size="m"></span></b></summary>
  <div><br>CHANNEL.BACKUP file is encrypted with your AEZEED Cipher Seed so it can be stored on third-party servers without any risk.<br> Email is the most recommended backup method but for maximum security use it with at least one additional backup provider.</div>
  <h3>Setup examples:</h3>
  <hr>
  <details>
  <summary style="background: var(--tui-background-neutral-1);padding: 0.5rem;border-radius: 1rem;cursor: pointer;"><b>EMAIL <span tuiappearance="" tuiicons="" tuiiconbutton="" size="s" iconstart="@tui.chevron-down" type="button" class="button" style="border-radius: 100%; --t-icon-start: url(assets/taiga-ui/icons/chevron-down.svg);" data-appearance="warning" data-icon-start="svg" data-size="s"></span></b></summary>
  <br>
  <div>In the example below, SMTP2GO is used as SMTP provider because the setup is straightforward and the service is free.</div>
  <table class="g-table">
    <thead><tr><th>Step</th><th>Action</th></tr></thead>
    <tbody>
      <tr><td>1️⃣</td><td><strong>Sign up</strong> at <u><a href="https://www.smtp2go.com/" target="_blank">smtp2go.com</a></u> (Free: 1k emails/mo)</td></tr>
      <tr><td>2️⃣</td><td>Verify email → Log in at <u><a href="https://app.smtp2go.com/" target="_blank">app.smtp2go.com</a></u></td></tr>
      <tr><td>3️⃣</td><td><strong>Sending → Verified Senders</strong>: Add & verify your “From” email</td></tr>
      <tr><td>4️⃣</td><td><strong>Sending → SMTP Users → Add SMTP User</strong>: Create & save username & password</td></tr>
      <tr><td>5️⃣</td><td>Return to Channels - Auto-Backup: Enable Email as backup provider & enter config:<br>
        <strong>Sender Address:</strong> Use your SMTP2GO "Single sender emails" address. See step 3.<br>
        <strong>Recipient Address:</strong> Add at least two addresses and try to mix email providers. Example: <code>youremail@proton.me, youremail@gmail.com, familymemberemail@gmail.com, friendemail@gmail.com</code><br>
        <strong>SMTP Server:</strong> <code>mail.smtp2go.com</code><br>
        <strong>SMTP Port:</strong> <code>465</code> (SSL) or <code>587</code> (TLS)<br>
        <strong>SMTP Username:</strong> See step 4.<br>
        <strong>SMTP Password:</strong> See step 4.</td></tr>
      <tr><td>6️⃣</td><td>Click <strong>Submit</strong> → Run <strong>Channels: Test Auto-Backup</strong></td></tr>
    </tbody>
  </table>
  <br>
    <div>💡 Any SMTP provider works! We recommend SMTP2GO, MailerSend, or Gmail (all free).</div>
  <table class="g-table">
    <thead>
      <tr><th>✅ Recommended SMTP Providers</th></tr>
    </thead>
    <tbody>
      <tr><td><b>SMTP2Go</b> ⇢ <u><a href="https://www.smtp2go.com/" target="_blank">smtp2go.com \u{1F517}</a></u><br/>– Free tier: 1,000 emails/month, no domain required.<br/>– SMTP server: <code>mail.smtp2go.com</code>, port 465 or 587.</td></tr>
      <tr><td><b>MailerSend</b> ⇢ <u><a href="https://www.mailersend.com/" target="_blank">mailersend.com \u{1F517}</a></u><br/>– Free tier: 500 emails/month, no domain required.<br/>– Use your <b>verified email</b> as "From" address.</td></tr>
      <tr><td><b>Gmail</b> ⇢ <u><a href="https://mail.google.com/" target="_blank">mail.google.com \u{1F517}</a></u><br/>– Free tier: 500 emails/day, requires App Password (2FA must be ON).<br/>⚠️ Emails can <b>only be sent to @gmail.com addresses</b> unless you verify a custom "From" address.</td></tr>
      <tr><td><b>Proton Mail</b> ⇢ <u><a href="https://mail.proton.me/" target="_blank">mail.proton.me \u{1F517}</a></u><br/>– Free tier: NONE, smtp access requires <b>paid plan</b>.<br/>– SMTP server: <code>smtp.proton.me</code>, port 465 or 587.</td></tr>
     </tbody>
  </table>
</details>
<hr>
<details>
  <summary style="background: var(--tui-background-neutral-1);padding: 0.5rem;border-radius: 1rem;cursor: pointer;"><b>SFTP <span tuiappearance="" tuiicons="" tuiiconbutton="" size="s" iconstart="@tui.chevron-down" type="button" class="button" style="border-radius: 100%; --t-icon-start: url(assets/taiga-ui/icons/chevron-down.svg);" data-appearance="warning" data-icon-start="svg" data-size="s"></span></b></summary>
  <table class="g-table">
    <thead><tr><th>Step</th><th>Action</th></tr></thead>
    <tbody>
      <tr><td>1️⃣</td><td><strong>Choose a remote server / LAN computer</strong> (desktop, laptop, Raspberry Pi, or NAS) that stays powered on.</td></tr>
      <tr><td>2️⃣</td><td><strong>Check & install SSH/SFTP server (if missing)</strong>:<br>
        – <strong>Linux (Ubuntu/Debian)</strong>:<br>
          &nbsp;&nbsp;• Check: <code>sudo systemctl is-active ssh</code><br>
          &nbsp;&nbsp;• If <code>inactive</code>, run:<br>
          &nbsp;&nbsp;&nbsp;&nbsp;<code>sudo apt update && sudo apt install openssh-server</code><br>
          &nbsp;&nbsp;&nbsp;&nbsp;<code>sudo systemctl enable --now ssh</code><br>
        – <strong>macOS</strong>:<br>
          &nbsp;&nbsp;• Go to <strong>System Settings → Sharing</strong> → enable <strong>Remote Login</strong><br>
        – <strong>Windows</strong>:<br>
          &nbsp;&nbsp;• Check: Open <strong>Services</strong> → look for “OpenSSH SSH Server” (should be “Running”)<br>
          &nbsp;&nbsp;• If missing: <strong>Settings → Apps → Optional Features → Add → OpenSSH Server</strong><br>
          &nbsp;&nbsp;• Then in **PowerShell as Admin**:<br>
          &nbsp;&nbsp;&nbsp;&nbsp;<code>Start-Service sshd; Set-Service -Name sshd -StartupType 'Automatic'</code>
      </td></tr>
      <tr><td>3️⃣</td><td><strong>Find the IP address</strong>:<br>
        – Linux/macOS: run <code>ip a</code> (look for <code>inet</code> under <code>wlan0</code> or <code>eth0</code>)<br>
        – Windows: run <code>ipconfig</code> in Command Prompt (look for “IPv4 Address”)
      </td></tr>
      <tr><td>4️⃣</td><td><strong>Choose authentication</strong>:<br>
        – ✅ <strong>Password (recommended for beginners)</strong>:<br>
          &nbsp;&nbsp;• Leave <strong>“SFTP Private Key”</strong> blank<br>
          &nbsp;&nbsp;• Enter your login password in <strong>“SFTP Password”</strong><br>
        – 🔑 <strong>SSH Key (advanced)</strong>:<br>
          &nbsp;&nbsp;• <strong>Linux/macOS</strong>: Key is usually at <code>~/.ssh/id_rsa</code> or <code>~/.ssh/id_ed25519</code><br>
          &nbsp;&nbsp;• <strong>Windows</strong>: Run in PowerShell:<br>
          &nbsp;&nbsp;&nbsp;&nbsp;<code>Get-Content "$env:USERPROFILE\.ssh\id_rsa"</code><br>
          &nbsp;&nbsp;• Paste the **entire private key** (starts with <code>-----BEGIN OPENSSH PRIVATE KEY-----</code>) into <strong>“SFTP Private Key”</strong>
      </td></tr>
      <tr><td>5️⃣</td><td><strong>In LND SFTP Settings</strong>:<br>
        <strong>SFTP Host</strong>: IP from Step 3 (e.g., <code>192.168.1.20</code>)<br>
        <strong>SFTP Username</strong>: Your login username (e.g., <code>smole</code>, <code>pi</code>)<br>
        <strong>SFTP Port</strong>: <code>22</code> (default)<br>
        <strong>SFTP Folder Path</strong>: Backup folder (e.g., <code>/home/smole/lnd-backups</code> or <code>C:\lnd-backups</code>)<br>
        → <strong>Create this folder first</strong> if it doesn’t exist.
      </td></tr>
      <tr><td>6️⃣</td><td>Click <strong>Submit</strong>, then test with <strong>“Test Channels Auto-Backup”</strong>.</td></tr>
    </tbody>
  </table>
  💡 <strong>Tip</strong>: If backup fails, check: IP correctness, SSH running, firewall blocking port 22, folder permissions, or special characters in password.
</details>
<hr>
<details>
  <summary style="background: var(--tui-background-neutral-1);padding: 0.5rem;border-radius: 1rem;cursor: pointer;"><b>Google Drive <span tuiappearance="" tuiicons="" tuiiconbutton="" size="s" iconstart="@tui.chevron-down" type="button" class="button" style="border-radius: 100%; --t-icon-start: url(assets/taiga-ui/icons/chevron-down.svg);" data-appearance="warning" data-icon-start="svg" data-size="s"></span></b></summary>
  <div></div>
</details>
<hr>
<details>
  <summary style="background: var(--tui-background-neutral-1);padding: 0.5rem;border-radius: 1rem;cursor: pointer;"><b>Dropbox <span tuiappearance="" tuiicons="" tuiiconbutton="" size="s" iconstart="@tui.chevron-down" type="button" class="button" style="border-radius: 100%; --t-icon-start: url(assets/taiga-ui/icons/chevron-down.svg);" data-appearance="warning" data-icon-start="svg" data-size="s"></span></b></summary>
  <div></div>
</details>
<hr>
<details>
  <summary style="background: var(--tui-background-neutral-1);padding: 0.5rem;border-radius: 1rem;cursor: pointer;"><b>Nextcloud <span tuiappearance="" tuiicons="" tuiiconbutton="" size="s" iconstart="@tui.chevron-down" type="button" class="button" style="border-radius: 100%; --t-icon-start: url(assets/taiga-ui/icons/chevron-down.svg);" data-appearance="warning" data-icon-start="svg" data-size="s"></span></b></summary>
  <div></div>
</details>

  </details>`,
    allowedStatuses: 'only-running',
    group: 'Backup',
    visibility: 'enabled',
  }),
  sdk.InputSpec.of({
    providers: sdk.Value.multiselect({
      name: 'Enabled Backup Providers \u{26DB}',
      default: [],
      values: {
        'gdrive': 'Google Drive',
        'dropbox': 'Dropbox',
        'nextcloud': 'Nextcloud',
        'sftp': 'SFTP',
        'email': 'Email',
      },
    }),
    google: sdk.Value.object(
      {
        name: 'Google Drive Settings',
        description: 'Configure settings for Google Drive backup.',
      },
      sdk.InputSpec.of({
        'gdrive-key': sdk.Value.text({
          name: 'Google Service Account Key (JSON)',
          description: 'For Google Drive: Paste the contents of your Google Service Account JSON key file.',
          default: '',
          masked: true,
          required: false,
        }),
        'gdrive-path': sdk.Value.text({
          name: 'Google Drive Folder Path',
          description: 'For Google Drive: Example: lnd-backups',
          default: 'lnd-backups',
          required: false,
        }),
        'gdrive-team-drive': sdk.Value.text({
          name: 'Google Shared Drive ID',
          description: 'For Google Drive (Workspace accounts): ID of the shared drive. Optional for personal accounts.',
          default: '',
          required: false,
        }),
        'gdrive-folder-id': sdk.Value.text({
          name: 'Google Folder ID (for personal accounts)',
          description: 'For free Google accounts: ID of the shared folder (from URL: drive.google.com/drive/folders/<ID>). Required if no Shared Drive ID.',
          default: '',
          required: false,
        }),
      }),
    ),
    dropbox: sdk.Value.object(
      {
        name: 'Dropbox Settings',
        description: 'Configure settings for Dropbox backup.',
      },
      sdk.InputSpec.of({
        'dropbox-token': sdk.Value.text({
          name: 'Dropbox Token (JSON)',
          description: 'For Dropbox: Run `rclone config create mydropbox dropbox` on your local machine, complete OAuth in browser, then copy the "token = {...}" JSON from ~/.rclone.conf and paste here.',
          default: '',
          masked: true,
          required: false,
        }),
        'dropbox-path': sdk.Value.text({
          name: 'Dropbox Folder Path',
          description: 'For Dropbox: Example: lnd-backups',
          default: 'lnd-backups',
          required: false,
        }),
      }),
    ),
    nextcloud: sdk.Value.object(
      {
        name: 'Nextcloud Settings',
        description: 'Configure settings for Nextcloud backup.',
      },
      sdk.InputSpec.of({
        'nextcloud-url': sdk.Value.text({
          name: 'Nextcloud WebDAV URL',
          description: 'For Nextcloud: Base URL, e.g., https://your.nextcloud.com/remote.php/dav/files/yourusername/',
          default: '',
          required: false,
        }),
        'nextcloud-user': sdk.Value.text({
          name: 'Nextcloud Username',
          description: 'For Nextcloud: Your login username.',
          default: '',
          required: false,
        }),
        'nextcloud-pass': sdk.Value.text({
          name: 'Nextcloud Password',
          description: 'For Nextcloud: App password or login password (stored in plain text internally).',
          default: '',
          masked: true,
          required: false,
        }),
        'nextcloud-path': sdk.Value.text({
          name: 'Nextcloud Folder Path',
          description: 'For Nextcloud: Example: lnd-backups',
          default: 'lnd-backups',
          required: false,
        }),
      }),
    ),
    sftp: sdk.Value.object(
      {
        name: 'SFTP Settings',
        description: 'Configure settings for SFTP backup.',
      },
      sdk.InputSpec.of({
        'sftp-host': sdk.Value.text({
          name: 'SFTP Host',
          description: 'For SFTP: Hostname or IP of the SFTP server.',
          default: '',
          required: false,
        }),
        'sftp-user': sdk.Value.text({
          name: 'SFTP Username',
          description: 'For SFTP: Login username.',
          default: '',
          required: false,
        }),
        'sftp-key': sdk.Value.text({
          name: 'SFTP Private Key (optional)',
          description: 'Paste your SSH private key (e.g., contents of ~/.ssh/id_rsa) for passwordless auth. If provided, password is ignored. Multiline OK.',
          default: '',
          masked: true,
          required: false,
        }),
        'sftp-pass': sdk.Value.text({
          name: 'SFTP Password',
          description: 'For SFTP: Password (stored in plain text internally; use key auth if possible).',
          default: '',
          masked: true,
          required: false,
        }),
        'sftp-port': sdk.Value.text({
          name: 'SFTP Port',
          description: 'For SFTP: Default 22.',
          default: '22',
          required: false,
        }),
        'sftp-path': sdk.Value.text({
          name: 'SFTP Folder Path',
          description: 'For SFTP: Example: /path/to/lnd-backups',
          default: 'lnd-backups',
          required: false,
        }),
      }),
    ),
    email: sdk.Value.object(
      {
        name: 'Email Settings',
              
        description: `<div>Here you can configure settings for Email backup. Your <code>channel.backup</code> file will be <strong>automatically attached and emailed</strong> every time it changes — that means whenever you <strong>open a new channel</strong>, 
  <strong>close a channel</strong>, or Lightning updates the backup for any other reason.</div>
<div><strong>You’ll receive an email within seconds</strong> of every channel state change.</div>`
      },
      sdk.InputSpec.of({
        'email-from': sdk.Value.text({
          name: 'Email Sender Address',
          description: 'For Email: Sender email (e.g., yourusername@gmail.com).',
          default: '',
          required: false,
        }),
        'email-to': sdk.Value.text({
          name: 'Email Recipient Address',
          description: `Recipient email can be the same as sender, but try to add at least 2 email recipients addresses and try to mix email providers. Example: <code>youremail@protonmail.com, youremail@gmail.com, youremail@tutanota.com, famillymemberemail@gmail.com, friendemail@gmail.com</code></div>`,
          default: '',
          required: false,
        }),
        'email-smtp-server': sdk.Value.text({
          name: 'Email SMTP Server',
          description: `<table><thead><tr><th>✅ Recommended SMTP Providers</th></tr></thead>
                        <tbody>
                        <tr><td><b>MailerSend</b> ⇢  <a href="https://www.mailersend.com/" target="_blank">mailersend.com \u{1F517}</a><br/>– Free tier: 3,000 emails/month, no domain required.<br/>– Use your <b>verified email</b> as "From" address.</td></tr>
                        <tr><td><b>SMTP2Go</b> ⇢  <a href="https://www.smtp2go.com/" target="_blank">smtp2go.com \u{1F517}</a><br/>– Free tier: 1,000 emails/month, no domain required.<br/>– SMTP server: <code>mail.smtp2go.com</code>, port 465 or 587.</td></tr>
                        <tr><td><b>Gmail</b> ⇢ <a href="https://mail.google.com/" target="_blank">mail.google.com \u{1F517}</a><br/>– Free tier: 500 emails/day, requires App Password (2FA must be ON).<br/>⚠️ Emails can <b>only be sent to @gmail.com addresses</b> unless you verify a custom "From" address.</td></tr>
                        <tr><td><b>Proton Mail</b> ⇢ <a href="https://mail.proton.me/" target="_blank">mail.proton.me \u{1F517}</a><br/>– Free tier: NONE, smtp access requires <b>paid plan</b>.<br/>– SMTP server: <code>smtp.proton.me</code>, port 465 or 587.</td></tr>
                        </tbody>
                        </table>`,
          default: 'mail.smtp2go.com',
          required: false,
        }),
        'email-smtp-port': sdk.Value.text({
          name: 'Email SMTP Port',
          description: 'For Email: 465 for SSL, 587 for TLS.',
          default: '465',
          required: false,
        }),
        'email-smtp-user': sdk.Value.text({
          name: 'Email SMTP Username',
          description: 'For Email: Usually the sender email.',
          default: '',
          required: false,
        }),
        'email-smtp-pass': sdk.Value.text({
          name: 'Email SMTP Password',
          description: 'For Email: App password if using Gmail (enable 2FA and create at myaccount.google.com/apppasswords). Stored in plain text internally.',
          default: '',
          masked: true,
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
    // ✅ FIX: Use selectedRcloneRemotes, not !!sections[p]
    const selectedProviders = VALID_PROVIDERS.filter(p => {
      if (p === 'email') return !!config.emailBackup
      return config.selectedRcloneRemotes?.some((r: string) => r.startsWith(p + ':'))
    }) as typeof VALID_PROVIDERS[number][]
    return {
      providers: selectedProviders,
      google: {
        'gdrive-key': '',
        'gdrive-path': getPath('gdrive'),
        'gdrive-team-drive': sections['gdrive']?.team_drive || '',
        'gdrive-folder-id': sections['gdrive']?.root_folder_id || '',
      },
      dropbox: {
        'dropbox-token': '',
        'dropbox-path': getPath('dropbox'),
      },
      nextcloud: {
        'nextcloud-url': sections['nextcloud']?.url || '',
        'nextcloud-user': sections['nextcloud']?.user || '',
        'nextcloud-pass': '',
        'nextcloud-path': getPath('nextcloud'),
      },
      sftp: {
        'sftp-host': sections['sftp']?.host || '',
        'sftp-user': sections['sftp']?.user || '',
        'sftp-pass': '',
        'sftp-port': sections['sftp']?.port || '22',
        'sftp-path': getPath('sftp'),
      },
      email: {
        'email-from': config.emailBackup?.from || '',
        'email-to': config.emailBackup?.to || '',
        'email-smtp-server': config.emailBackup?.smtp_server || 'smtp.gmail.com',
        'email-smtp-port': config.emailBackup?.smtp_port?.toString() || '465',
        'email-smtp-user': config.emailBackup?.smtp_user || '',
        'email-smtp-pass': '',
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
          message: `Channel auto-backup has been disabled. Please use built StartOS backup or download <code>channel.backup</code> manually (e.g. via RTL or ThunderHub) whenever you open/close channels.`,
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
      providers.forEach((provider: typeof VALID_PROVIDERS[number]) => {
        if (provider !== 'email') {
          const remoteName = provider
          const existingSection = sections[remoteName] || {}
          let path: string
          let newSectionLines: string[] = [`[${remoteName}]`]
          switch (provider) {
            case 'gdrive': {
              path = input.google['gdrive-path']?.trim() ?? config.selectedRcloneRemotes?.find((r: string) => r.startsWith(remoteName + ':'))?.split(':')[1] ?? 'lnd-backups'
              const keyInput = input.google['gdrive-key']?.trim()
              const key = keyInput || existingSection.service_account_credentials || ''
              if (!key.trim()) throw new Error('Google Service Account Key is required.')
              let keyObj
              try {
                keyObj = JSON.parse(key)
              } catch {
                throw new Error('Invalid JSON in Service Account Key.')
              }
              const teamDrive = input.google['gdrive-team-drive']?.trim() || existingSection.team_drive || ''
              const folderId = input.google['gdrive-folder-id']?.trim() || existingSection.root_folder_id || ''
              if (teamDrive && folderId) throw new Error('Specify either Shared Drive ID or Folder ID, not both.')
              if (!teamDrive && !folderId) throw new Error('Shared Drive ID or Folder ID required for Google Drive.')
              newSectionLines.push('type = drive')
              newSectionLines.push('scope = drive')
              newSectionLines.push(`service_account_credentials = ${JSON.stringify(keyObj)}`)
              if (teamDrive) newSectionLines.push(`team_drive = ${teamDrive}`)
              if (folderId && !teamDrive) newSectionLines.push(`root_folder_id = ${folderId}`)
              updates.selectedRcloneRemotes = updates.selectedRcloneRemotes.filter((r: unknown) => typeof r === 'string' && !r.startsWith('gdrive:'))
              updates.enabledRemotes = updates.enabledRemotes.filter((r: unknown) => typeof r === 'string' && !r.startsWith('gdrive:'))
              break
            }
            case 'dropbox': {
              path = input.dropbox['dropbox-path']?.trim() ?? config.selectedRcloneRemotes?.find((r: string) => r.startsWith(remoteName + ':'))?.split(':')[1] ?? 'lnd-backups'
              const token = input.dropbox['dropbox-token']?.trim() || existingSection.token || ''
              if (!token.trim()) throw new Error('Dropbox Token JSON is required.')
              let tokenObj
              try {
                tokenObj = JSON.parse(token)
              } catch {
                throw new Error('Invalid JSON in Dropbox Token.')
              }
              newSectionLines.push('type = dropbox')
              newSectionLines.push(`token = ${JSON.stringify(tokenObj)}`)
              updates.selectedRcloneRemotes = updates.selectedRcloneRemotes.filter((r: unknown) => typeof r === 'string' && !r.startsWith('dropbox:'))
              updates.enabledRemotes = updates.enabledRemotes.filter((r: unknown) => typeof r === 'string' && !r.startsWith('dropbox:'))
              break
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
              updates.selectedRcloneRemotes = updates.selectedRcloneRemotes.filter((r: unknown) => typeof r === 'string' && !r.startsWith('nextcloud:'))
              updates.enabledRemotes = updates.enabledRemotes.filter((r: unknown) => typeof r === 'string' && !r.startsWith('nextcloud:'))
              break
            }
            case 'sftp': {
              path = input.sftp['sftp-path']?.trim() ?? config.selectedRcloneRemotes?.find((r: string) => r.startsWith(remoteName + ':'))?.split(':')[1] ?? 'lnd-backups'
              const host = input.sftp['sftp-host']?.trim() || existingSection.host || ''
              const user = input.sftp['sftp-user']?.trim() || existingSection.user || ''
              let passValue = existingSection.pass || ''
              const passInput = input.sftp['sftp-pass']?.trim()
              const key = input.sftp['sftp-key']?.trim() || existingSection.key_pem || ''
              const port = input.sftp['sftp-port']?.trim() || existingSection.port || '22'
              if (passInput) {
                passValue = obscure(passInput)
              } else if (passValue && !isObscured(passValue)) {
                passValue = obscure(passValue)
              }
              const hasPassword = !!passValue.trim()
              const hasKey = !!key.trim()
              if (!host.trim() || !user.trim()) throw new Error('SFTP host and username are required.')
              if (!hasPassword && !hasKey) throw new Error('SFTP requires password or key.')
              newSectionLines.push('type = sftp')
              newSectionLines.push(`host = ${host}`)
              newSectionLines.push(`user = ${user}`)
              newSectionLines.push(`port = ${port}`)
              newSectionLines.push('key_use_agent = false')
              if (hasKey) newSectionLines.push(`key_pem = ${key.replace(/\n/g, '\\n')}`)
              if (hasPassword && !hasKey) newSectionLines.push(`pass = ${passValue}`)
              updates.selectedRcloneRemotes = updates.selectedRcloneRemotes.filter((r: unknown) => typeof r === 'string' && !r.startsWith('sftp:'))
              updates.enabledRemotes = updates.enabledRemotes.filter((r: unknown) => typeof r === 'string' && !r.startsWith('sftp:'))
              break
            }
          }
          newSections += newSectionLines.join('\n') + '\n'
          existingConf = removeSection(existingConf, remoteName)
          const remotePath = `${remoteName}:${path}`
          newRemotes.push(remotePath)
          newEnabled.push(remotePath)
        } else {
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
      })
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
      const finalConfig = await customConfigJson.read().once().catch(() => ({})) as any
      await sdk.setHealth(effects, {
        id: 'channel-backup-watcher',
        name: 'Channel Backup Status',
        message: finalConfig?.channelAutoBackupEnabled ? '✅ Active (backing up to cloud)' : '❌ Disabled',
        result: finalConfig?.channelAutoBackupEnabled ? 'success' : 'disabled',
      })
      return {
        version: '1',
        title: '✅ Backup Targets Added',
        message: 'Your channel.backup will be synced to the selected targets in real time.',
        result: null,
      }
    } catch (e) {
      console.error('addBackupTarget submit error:', e)
      return {
        version: '1',
        title: 'Error',
        message: 'An unexpected error occurred. Please try again.',
        result: null,
      }
    }
  }
)