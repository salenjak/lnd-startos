// fileModels/store.json.ts
import { FileHelper, matches } from '@start9labs/start-sdk'

const { arrayOf, object, string, natural, boolean } = matches

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
  // ❌ BACKUP FIELDS REMOVED
})

export const storeJson = FileHelper.json(
  {
    volumeId: 'main',
    subpath: '/store.json',
  },
  shape,
)