import { VersionInfo, IMPOSSIBLE } from '@start9labs/start-sdk'
import { access } from 'fs/promises'
import { customConfigJson } from '../../fileModels/custom-config.json'


export const v0_20_0_1_beta_0 = VersionInfo.of({
  version: '0.20.0-beta:1-beta.0',
  releaseNotes: '- Automated, encrypted backups of channel.backup triggered on every channel open/close\n- 5 backup provider options: Email (SMTP), SFTP, Dropbox, Google Drive, Nextcloud\n- Multi-recipient email: Configure ≥2 email addresses for redundancy\n- OAuth 2.0 support: Secure token handling for Dropbox/Google Drive (refresh tokens stored encrypted)\n- Tor-aware: Full .onion support for SFTP and Nextcloud backups via SOCKS5 proxy\n- Robust sync daemon: inotifywait + rclone + mutt with per-provider success/failure logging\n- Manual trigger: Test backups instantly via "Channels - Test Auto-Backup" action',
  migrations: {


    up: async ({ effects }) => {
      try {
          await access('/media/startos/volumes/main/custom-config.json')
          console.log('Found existing custom-config.json')
        } catch {
          console.log("Couldn't find custom-config.json. Creating defaults.")
          await customConfigJson.write(effects, {
            rcloneConfig: null,
            selectedRcloneRemotes: null,
            enabledRemotes: null,
            channelAutoBackupEnabled: false,
            emailBackup: null,
            emailEnabled: false,
          })
        }
      
        },


    down: IMPOSSIBLE,
  },
})
