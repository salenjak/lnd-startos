// actions/manualBackup.ts
import { sdk } from '../sdk'
import { lndDataDir } from '../utils'

export const manualBackup = sdk.Action.withoutInput(
  'manual-backup',
  async ({ effects }) => ({
    name: 'Test Channels Auto-Backup',
    description: 'Manually trigger a backup of the channel.backup file.',
    warning: null,
    allowedStatuses: 'only-running',
    group: 'Backup',
    visibility: 'enabled',
  }),
  async ({ effects }) => {
    const res = await sdk.SubContainer.withTemp(
      effects,
      { imageId: 'lnd' },
      sdk.Mounts.of().mountVolume({
        volumeId: 'main',
        subpath: null,
        mountpoint: lndDataDir,
        readonly: false,
      }),
      'manual-backup',
      async (sub) => {
        // Export the binary backup
        const exportRes = await sub.exec([
          'lncli',
          '--rpcserver=lnd.startos',
          'exportchanbackup',
          '--all',
          '--output_file',
          `${lndDataDir}/data/chain/bitcoin/mainnet/channel.backup`
        ])

        if (exportRes.exitCode !== 0) {
          throw new Error(`Export failed: ${exportRes.stderr}`)
        }

        // Safely trigger inotify MODIFY without corrupting binary
        const touchRes = await sub.exec([
          'sh', '-c',
          `touch -c -m "${lndDataDir}/data/chain/bitcoin/mainnet/channel.backup"`
        ])

        if (touchRes.exitCode !== 0) {
          console.warn('⚠️ Failed to touch channel.backup (file may not exist yet). Backup watcher may not trigger.')
        }

        return { exitCode: 0, stdout: '', stderr: '' }
      }
    )

    return {
      version: '1',
      title: '✅ Manual Backup Triggered',
      message: 'The backup watcher should now sync the file.',
      result: null,
    }
  }
)