// startos/actions/addBackupTarget.ts
import { sdk } from '../sdk'
import { storeJson } from '../fileModels/store.json'

const VALID_PROVIDERS = ['gdrive', 'dropbox', 'nextcloud', 'sftp', 'email'] as const

export const addBackupTarget = sdk.Action.withInput(
  'add-backup-target',
  async ({ effects }) => ({
    name: 'Add Cloud Backup Target',
    description: 'Add and configure backup targets for your channel state. You can select multiple providers.',
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
    'remote-name': sdk.Value.text({
      name: 'Remote Name (for cloud providers)',
      description: 'Unique name for this backup remote in rclone (e.g., mygdrive). Not used for Email.',
      default: '',
      required: false,
    }),
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
  async ({ effects }) => {
    const store = (await storeJson.read().once())!
    const selectedProviders = [
      ...(store.selectedRcloneRemotes || []).map(r => r.split(':')[0]),
      ...(store.emailBackup ? ['email'] : [])
    ].filter(p => VALID_PROVIDERS.includes(p as any)) as typeof VALID_PROVIDERS[number][]
    return {
      providers: [...new Set(selectedProviders)],
      'remote-name': '',
      'gdrive-key': '',
      'gdrive-path': 'lnd-backups',
      'gdrive-team-drive': '',
      'gdrive-folder-id': '',
      'dropbox-token': '',
      'dropbox-path': 'lnd-backups',
      'nextcloud-url': '',
      'nextcloud-user': '',
      'nextcloud-pass': '',
      'nextcloud-path': 'lnd-backups',
      'sftp-host': '',
      'sftp-user': '',
      'sftp-pass': '',
      'sftp-port': '22',
      'sftp-path': 'lnd-backups',
      'email-from': store.emailBackup?.from || '',
      'email-to': store.emailBackup?.to || '',
      'email-smtp-server': store.emailBackup?.smtp_server || 'smtp.gmail.com',
      'email-smtp-port': store.emailBackup?.smtp_port?.toString() || '465',
      'email-smtp-user': store.emailBackup?.smtp_user || '',
      'email-smtp-pass': store.emailBackup?.smtp_pass || '',
    }
  },
  async ({ effects, input }) => {
    const rawProviders = input.providers || []
    const providers = rawProviders.filter(p => VALID_PROVIDERS.includes(p as any))

    const store = (await storeJson.read().once())!

    // ✅ Handle disabling all backups
    if (providers.length === 0) {
      await storeJson.merge(effects, {
        channelAutoBackupEnabled: false,
        selectedRcloneRemotes: [],
        enabledRemotes: [],
        emailBackup: null,
        emailEnabled: false,
      })
      return {
        version: '1',
        title: '✅ Auto-Backup Disabled',
        message: 'Channel auto-backup has been disabled.',
        result: null,
      }
    }

    let updates: any = { channelAutoBackupEnabled: true }
    let newSections = ''
    let newRemotes: string[] = []
    let newEnabled: string[] = []

    providers.forEach((provider: string) => {
      if (provider !== 'email') {
        const remoteName = input['remote-name']?.trim() || provider
        let path = 'lnd-backups'
        if (provider === 'gdrive') path = input['gdrive-path']?.trim() || 'lnd-backups'
        if (provider === 'dropbox') path = input['dropbox-path']?.trim() || 'lnd-backups'
        if (provider === 'nextcloud') path = input['nextcloud-path']?.trim() || 'lnd-backups'
        if (provider === 'sftp') path = input['sftp-path']?.trim() || 'lnd-backups'
        const remotePath = `${remoteName}:${path}`

        let newSection = ''
        switch (provider) {
          case 'gdrive': {
            const key = input['gdrive-key']?.trim()
            if (!key) throw new Error('Google Service Account Key is required.')
            let keyObj
            try {
              keyObj = JSON.parse(key)
            } catch {
              throw new Error('Invalid JSON in Service Account Key.')
            }
            const teamDrive = input['gdrive-team-drive']?.trim()
            const folderId = input['gdrive-folder-id']?.trim()

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
            const token = input['dropbox-token']?.trim()
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
            const url = input['nextcloud-url']?.trim()
            const user = input['nextcloud-user']?.trim()
            const pass = input['nextcloud-pass']?.trim()
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
            const host = input['sftp-host']?.trim()
            const user = input['sftp-user']?.trim()
            const pass = input['sftp-pass']?.trim()
            const port = input['sftp-port']?.trim() || '22'
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
        newSections += newSection
        if (!store.selectedRcloneRemotes?.includes(remotePath)) {
          newRemotes.push(remotePath)
        }
        if (!store.enabledRemotes?.includes(remotePath)) {
          newEnabled.push(remotePath)
        }
      } else {
        const from = input['email-from']?.trim()
        const to = input['email-to']?.trim()
        const server = input['email-smtp-server']?.trim() || 'smtp.gmail.com'
        const port = input['email-smtp-port']?.trim() || '465'
        const user = input['email-smtp-user']?.trim()
        const pass = input['email-smtp-pass']?.trim()
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

    if (newSections) {
      let existingConf = ''
      if (store.rcloneConfig) {
        existingConf = Buffer.from(store.rcloneConfig, 'base64').toString('utf8')
      }
      const rcloneConf = (existingConf + newSections).trim()
      const rcloneConfigB64 = Buffer.from(rcloneConf, 'utf8').toString('base64')
      updates.rcloneConfig = rcloneConfigB64
    }

    if (newRemotes.length) {
      updates.selectedRcloneRemotes = [...(store.selectedRcloneRemotes || []), ...newRemotes]
    }
    if (newEnabled.length) {
      updates.enabledRemotes = [...(store.enabledRemotes || []), ...newEnabled]
    }

await storeJson.merge(effects, updates, { allowRestart: false } as any)
    return {
      version: '1',
      title: '✅ Backup Targets Added',
      message: `Your channel.backup will be synced to the selected targets in real time.`,
      result: null,
    }
  }
)