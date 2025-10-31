// startos/fileModels/store.json.ts (updated shape)
import { FileHelper, matches } from '@start9labs/start-sdk'
const { arrayOf, object, string, natural, boolean } = matches
// ✅ Add new fields INSIDE the shape object
export const shape = object({
  restore: boolean,
  aezeedCipherSeed: arrayOf(string).nullable(),
  walletPassword: string.nullable(),
  recoveryWindow: natural,
  bitcoindSelected: boolean,
  resetWalletTransactions: boolean,
  watchtowers: arrayOf(string),
  walletInitialized: boolean,
  externalGateway: string.nullable().onMismatch(null),
  pendingPasswordChange: string.nullable().onMismatch(null),
  passwordChangeError: string.nullable().onMismatch(null),
  autoUnlockEnabled: boolean,
  seedBackupConfirmed: boolean,
  passwordBackupConfirmed: boolean,
  seedBackupIndices: arrayOf(natural).nullable(),
  // ✅ NEW FIELDS FOR RCLONE BACKUP
  rcloneConfig: string.nullable(),
  selectedRcloneRemotes: arrayOf(string).nullable(),
  channelAutoBackupEnabled: boolean,
  // ✅ NEW FIELD FOR EMAIL BACKUP
  emailBackup: object({
    from: string,
    to: string,
    smtp_server: string,
    smtp_port: natural,
    smtp_user: string,
    smtp_pass: string,
  }).nullable().onMismatch(null),
  enabledRemotes: arrayOf(string).nullable(),
  emailEnabled: boolean.onMismatch(false),
  backupStatus: object({}).nullable().onMismatch(null),
})
export const storeJson = FileHelper.json(
  {
    volumeId: 'main',
    subpath: '/store.json',
  },
  shape,
)