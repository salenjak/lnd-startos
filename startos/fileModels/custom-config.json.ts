import { FileHelper, matches } from '@start9labs/start-sdk'

const { arrayOf, object, string, natural, boolean } = matches

export const customConfigShape = object({
  rcloneConfig: string.nullable(),
  selectedRcloneRemotes: arrayOf(string).nullable(),
  enabledRemotes: arrayOf(string).nullable(),
  channelAutoBackupEnabled: boolean.onMismatch(false),

  emailBackup: object({
    from: string,
    to: string,
    smtp_server: string,
    smtp_port: natural,
    smtp_user: string,
    smtp_pass: string,
  }).nullable().onMismatch(null),
  emailEnabled: boolean.onMismatch(false),
})

export const customConfigJson = FileHelper.json(
  {
    volumeId: 'main',
    subpath: '/custom-config.json',
  },
  customConfigShape,
)