// actions/addBackupTarget.ts
import { sdk } from '../sdk'
import { customConfigJson } from '../fileModels/custom-config.json'

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

const providerMap: Record<typeof VALID_PROVIDERS[number], string> = {
  'gdrive': 'google',
  'dropbox': 'dropbox',
  'nextcloud': 'nextcloud',
  'sftp': 'sftp',
  'email': 'email',
}

export const addBackupTarget = sdk.Action.withInput(
  'add-backup-target',
  async ({ effects }) => ({
    name: 'Auto-Backup Channels',
    description: 'Add and configure backup targets for your channel.backup file. You can select multiple providers (Nextcloud, Dropbox, Google, Email, SFTP) and multiple email recipients.',
    warning: null,
    allowedStatuses: 'only-running',
    group: 'Backup',
    visibility: 'enabled',
  }),
  sdk.InputSpec.of({
    providers: sdk.Value.multiselect({
      name: 'Backup Providers',
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
        description: 'Configure settings for Email backup.',
      },
      sdk.InputSpec.of({
        'email-from': sdk.Value.text({
          name: 'Email Sender Address',
          description: 'For Email: Sender email (e.g., yourgmail@gmail.com).',
          default: '',
          required: false,
        }),
        'email-to': sdk.Value.text({
          name: 'Email Recipient Address',
          description: 'For Email: Recipient email (can be the same as sender).',
          default: '',
          required: false,
        }),
        'email-smtp-server': sdk.Value.text({
          name: 'Email SMTP Server',
          description: 'For Email: e.g., smtp.gmail.com',
          default: 'smtp.gmail.com',
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
    const config = (await customConfigJson.read().once())!
    const existingConf = config.rcloneConfig ? Buffer.from(config.rcloneConfig, 'base64').toString('utf8') : ''
    const sections = parseRcloneConf(existingConf)
    const getPath = (provider: string) => config.selectedRcloneRemotes?.find(r => r.startsWith(provider + ':'))?.split(':')[1] || 'lnd-backups'
    const selectedProviders = VALID_PROVIDERS.filter(p => {
      if (p === 'email') return !!config.emailBackup
      return !!sections[p]
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
    const rawProviders = input.providers || []
    const providers = rawProviders.filter(p => VALID_PROVIDERS.includes(p as any)) as typeof VALID_PROVIDERS[number][]
    const config = (await customConfigJson.read().once())!

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
        title: '✅ Auto-Backup Disabled',
        message: 'Channel auto-backup has been disabled.',
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
    for (const prevProvider of previousCloudProviders) {
      if (!providers.includes(prevProvider)) {
        existingConf = removeSection(existingConf, prevProvider)
        const oldRemotePath = config.selectedRcloneRemotes?.find(r => r.startsWith(prevProvider + ':'))
        if (oldRemotePath) {
          updates.selectedRcloneRemotes = (config.selectedRcloneRemotes || []).filter(r => r !== oldRemotePath)
          updates.enabledRemotes = (config.enabledRemotes || []).filter(r => r !== oldRemotePath)
        }
      }
    }

    if (!providers.includes('email') && config.emailBackup) {
      updates.emailBackup = null
      updates.emailEnabled = false
    }

    providers.forEach((provider: typeof VALID_PROVIDERS[number]) => {
      if (provider !== 'email') {
        const remoteName = provider
        const inputKey = providerMap[provider] as 'google' | 'dropbox' | 'nextcloud' | 'sftp'
        const existingSection = sections[remoteName] || {}
        let path: string
        let newSection = ''
        switch (provider) {
          case 'gdrive': {
            path = input.google['gdrive-path']?.trim() ?? config.selectedRcloneRemotes?.find(r => r.startsWith(remoteName + ':'))?.split(':')[1] ?? 'lnd-backups'
            const keyInput = input.google['gdrive-key']?.trim()
            const key = keyInput !== '' && keyInput !== undefined ? keyInput : existingSection.service_account_credentials ?? ''
            if (!key) throw new Error('Google Service Account Key is required.')
            let keyObj
            try {
              keyObj = JSON.parse(key)
            } catch {
              throw new Error('Invalid JSON in Service Account Key.')
            }
            const teamDriveInput = input.google['gdrive-team-drive']?.trim()
            const teamDrive = teamDriveInput !== '' && teamDriveInput !== undefined ? teamDriveInput : existingSection.team_drive ?? ''
            const folderIdInput = input.google['gdrive-folder-id']?.trim()
            const folderId = folderIdInput !== '' && folderIdInput !== undefined ? folderIdInput : existingSection.root_folder_id ?? ''
            if (teamDrive && folderId) {
              throw new Error('Specify either Shared Drive ID (for Workspace) OR Folder ID (for personal accounts), not both.')
            }
            if (!teamDrive && !folderId) {
              throw new Error('Either Shared Drive ID (Workspace) or Folder ID (personal) is required for Google Drive.')
            }
            newSection = `
[${remoteName}]
type = drive
scope = drive
service_account_credentials = ${JSON.stringify(keyObj)}
${teamDrive ? `team_drive = ${teamDrive}\n` : ''}
${folderId && !teamDrive ? `root_folder_id = ${folderId}\n` : ''}`
            break
          }
          case 'dropbox': {
            path = input.dropbox['dropbox-path']?.trim() ?? config.selectedRcloneRemotes?.find(r => r.startsWith(remoteName + ':'))?.split(':')[1] ?? 'lnd-backups'
            const tokenInput = input.dropbox['dropbox-token']?.trim()
            const token = tokenInput !== '' && tokenInput !== undefined ? tokenInput : existingSection.token ?? ''
            if (!token) throw new Error('Dropbox Token JSON is required.')
            let tokenObj
            try {
              tokenObj = JSON.parse(token)
            } catch {
              throw new Error('Invalid JSON in Dropbox Token.')
            }
            newSection = `
[${remoteName}]
type = dropbox
token = ${JSON.stringify(tokenObj)}
`
            break
          }
          case 'nextcloud': {
            path = input.nextcloud['nextcloud-path']?.trim() ?? config.selectedRcloneRemotes?.find(r => r.startsWith(remoteName + ':'))?.split(':')[1] ?? 'lnd-backups'
            const urlInput = input.nextcloud['nextcloud-url']?.trim()
            const url = urlInput !== '' && urlInput !== undefined ? urlInput : existingSection.url ?? ''
            const userInput = input.nextcloud['nextcloud-user']?.trim()
            const user = userInput !== '' && userInput !== undefined ? userInput : existingSection.user ?? ''
            const passInput = input.nextcloud['nextcloud-pass']?.trim()
            const pass = passInput !== '' && passInput !== undefined ? passInput : existingSection.pass ?? ''
            if (!url || !user || !pass) throw new Error('Nextcloud URL, username, and password are required.')
            newSection = `
[${remoteName}]
type = webdav
url = ${url}
vendor = nextcloud
user = ${user}
pass = ${pass}
`
            break
          }
          case 'sftp': {
            path = input.sftp['sftp-path']?.trim() ?? config.selectedRcloneRemotes?.find(r => r.startsWith(remoteName + ':'))?.split(':')[1] ?? 'lnd-backups'
            const hostInput = input.sftp['sftp-host']?.trim()
            const host = hostInput !== '' && hostInput !== undefined ? hostInput : existingSection.host ?? ''
            const userInput = input.sftp['sftp-user']?.trim()
            const user = userInput !== '' && userInput !== undefined ? userInput : existingSection.user ?? ''
            const passInput = input.sftp['sftp-pass']?.trim()
            const pass = passInput !== '' && passInput !== undefined ? passInput : existingSection.pass ?? ''
            const portInput = input.sftp['sftp-port']?.trim()
            const port = portInput !== '' && portInput !== undefined ? portInput : existingSection.port || '22'
            if (!host || !user) throw new Error('SFTP host and username are required.')
            newSection = `
[${remoteName}]
type = sftp
host = ${host}
user = ${user}
port = ${port}
${pass ? `pass = ${pass}\n` : ''}`
            break
          }
        }
        existingConf = removeSection(existingConf, remoteName)
        newSections += newSection
        const remotePath = `${remoteName}:${path}`
        const oldRemotePath = config.selectedRcloneRemotes?.find(r => r.startsWith(remoteName + ':'))
        if (oldRemotePath && oldRemotePath !== remotePath) {
          updates.selectedRcloneRemotes = (config.selectedRcloneRemotes || []).filter(r => r !== oldRemotePath)
          updates.enabledRemotes = (config.enabledRemotes || []).filter(r => r !== oldRemotePath)
        }
        if (!config.selectedRcloneRemotes?.includes(remotePath)) {
          newRemotes.push(remotePath)
        }
        if (!config.enabledRemotes?.includes(remotePath)) {
          newEnabled.push(remotePath)
        }
      } else {
        const fromInput = input.email['email-from']?.trim()
        const from = fromInput !== '' && fromInput !== undefined ? fromInput : config.emailBackup?.from ?? ''
        const toInput = input.email['email-to']?.trim()
        const to = toInput !== '' && toInput !== undefined ? toInput : config.emailBackup?.to ?? ''
        const serverInput = input.email['email-smtp-server']?.trim()
        const server = serverInput !== '' && serverInput !== undefined ? serverInput : config.emailBackup?.smtp_server ?? 'smtp.gmail.com'
        const portInput = input.email['email-smtp-port']?.trim()
        const port = portInput !== '' && portInput !== undefined ? portInput : config.emailBackup?.smtp_port?.toString() ?? '465'
        const userInput = input.email['email-smtp-user']?.trim()
        const user = userInput !== '' && userInput !== undefined ? userInput : config.emailBackup?.smtp_user ?? ''
        const passInput = input.email['email-smtp-pass']?.trim()
        const pass = passInput !== '' && passInput !== undefined ? passInput : config.emailBackup?.smtp_pass ?? ''
        if (!from || !to || !user || !pass) throw new Error('Email from, to, SMTP user, and password are required.')
        updates.emailBackup = {
          from,
          to,
          smtp_server: server,
          smtp_port: parseInt(port),
          smtp_user: user,
          smtp_pass: pass,
        }
        updates.emailEnabled = true
      }
    })

    const finalConf = (existingConf + newSections).trim()
    if (finalConf !== (config.rcloneConfig ? Buffer.from(config.rcloneConfig, 'base64').toString('utf8') : '')) {
      updates.rcloneConfig = Buffer.from(finalConf, 'utf8').toString('base64')
    }
    if (newRemotes.length) {
      updates.selectedRcloneRemotes = [...(config.selectedRcloneRemotes || []), ...newRemotes]
    }
    if (newEnabled.length) {
      updates.enabledRemotes = [...(config.enabledRemotes || []), ...newEnabled]
    }

    await customConfigJson.merge(effects, updates)

    // ✅ Instant health update
    const finalConfig = await customConfigJson.read().once()
    await sdk.setHealth(effects, {
      id: 'channel-backup-watcher',
      name: 'Channel Backup Status',
      message: finalConfig?.channelAutoBackupEnabled
        ? '✅ Active (backing up to cloud)'
        : '❌ Disabled',
      result: finalConfig?.channelAutoBackupEnabled ? 'success' : 'disabled',
    })

    return {
      version: '1',
      title: '✅ Backup Targets Added',
      message: `Your channel.backup will be synced to the selected targets in real time.`,
      result: null,
    }
  }
)