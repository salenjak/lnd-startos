// startos/actions/manualBackup.ts-v7
import { sdk } from '../sdk'
import { lndDataDir } from '../utils'

export const manualBackup = sdk.Action.withoutInput(
  'manual-backup',
  async ({ effects }) => ({
    name: 'Test Channels Auto-Backup',
    description: 'Manually trigger a backup of the channel.backup file (lncli exportchanbackup --all).',
    warning: null,
    allowedStatuses: 'only-running',
    group: 'Backup',
    visibility: 'enabled',
  }),
  async ({ effects }) => {
    // ✅ Use withTemp to ensure subcontainer is cleaned up
    const res = await sdk.SubContainer.withTemp(
      effects,
      { imageId: 'lnd' },
      sdk.Mounts.of().mountVolume({
        volumeId: 'main',
        subpath: null,
        mountpoint: lndDataDir,
        readonly: false,
      }),
      'manual-backup', // unique name, but temporary
      async (sub) => {
        return await sub.exec([
          'lncli',
          '--rpcserver=lnd.startos',
          'exportchanbackup',
          '--all',
          '--output_file',
          `${lndDataDir}/data/chain/bitcoin/mainnet/channel.backup`
        ])
      }
    )
    if (res.exitCode !== 0) {
      throw new Error(`Export failed: ${res.stderr}`)
    }
    return {
      version: '1',
      title: '✅ Manual Backup Triggered',
      message: 'The backup watcher should now sync the file.',
      result: null,
    }
  }
)