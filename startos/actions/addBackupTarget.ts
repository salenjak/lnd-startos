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
          // ✅ FIX: Safe .filter with type guard
          updates.selectedRcloneRemotes = (config.selectedRcloneRemotes || []).filter((r: unknown) => typeof r === 'string' && !r.startsWith(prevProvider + ':'))
          updates.enabledRemotes = (config.enabledRemotes || []).filter((r: unknown) => typeof r === 'string' && !r.startsWith(prevProvider + ':'))
        }
      }

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
              updates.selectedRcloneRemotes = (config.selectedRcloneRemotes || []).filter((r: unknown) => typeof r === 'string' && !r.startsWith('gdrive:'))
              updates.enabledRemotes = (config.enabledRemotes || []).filter((r: unknown) => typeof r === 'string' && !r.startsWith('gdrive:'))
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
              updates.selectedRcloneRemotes = (config.selectedRcloneRemotes || []).filter((r: unknown) => typeof r === 'string' && !r.startsWith('dropbox:'))
              updates.enabledRemotes = (config.enabledRemotes || []).filter((r: unknown) => typeof r === 'string' && !r.startsWith('dropbox:'))
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
              if (!url || !user || !passValue) throw new Error('Nextcloud URL, username, and password are required.')
              newSectionLines.push('type = webdav')
              newSectionLines.push(`url = ${url}`)
              newSectionLines.push('vendor = nextcloud')
              newSectionLines.push(`user = ${user}`)
              newSectionLines.push(`pass = ${passValue}`)
              updates.selectedRcloneRemotes = (config.selectedRcloneRemotes || []).filter((r: unknown) => typeof r === 'string' && !r.startsWith('nextcloud:'))
              updates.enabledRemotes = (config.enabledRemotes || []).filter((r: unknown) => typeof r === 'string' && !r.startsWith('nextcloud:'))
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
              const hasPassword = !!passValue
              const hasKey = !!key
              if (!host || !user) throw new Error('SFTP host and username are required.')
              if (!hasPassword && !hasKey) throw new Error('SFTP requires password or key.')
              newSectionLines.push('type = sftp')
              newSectionLines.push(`host = ${host}`)
              newSectionLines.push(`user = ${user}`)
              newSectionLines.push(`port = ${port}`)
              newSectionLines.push('key_use_agent = false')
              if (hasKey) newSectionLines.push(`key_pem = ${key.replace(/\n/g, '\\n')}`)
              if (hasPassword && !hasKey) newSectionLines.push(`pass = ${passValue}`)
              updates.selectedRcloneRemotes = (config.selectedRcloneRemotes || []).filter((r: unknown) => typeof r === 'string' && !r.startsWith('sftp:'))
              updates.enabledRemotes = (config.enabledRemotes || []).filter((r: unknown) => typeof r === 'string' && !r.startsWith('sftp:'))
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
          if (!from || !to || !user || !pass) throw new Error('Email from, to, SMTP user, and password are required.')
          updates.emailBackup = { from, to, smtp_server: server, smtp_port: parseInt(port), smtp_user: user, smtp_pass: pass }
          updates.emailEnabled = true
        }
      })

      const finalConf = (existingConf.trim() + '\n' + newSections.trim()).trim()
      if (finalConf) {
        updates.rcloneConfig = Buffer.from(finalConf, 'utf8').toString('base64')
      }
      if (newRemotes.length) {
        updates.selectedRcloneRemotes = [...(updates.selectedRcloneRemotes || config.selectedRcloneRemotes || []), ...newRemotes]
      }
      if (newEnabled.length) {
        updates.enabledRemotes = [...(updates.enabledRemotes || config.enabledRemotes || []), ...newEnabled]
      }

      await customConfigJson.merge(effects, updates)
      const finalConfig = await customConfigJson.read().once()
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