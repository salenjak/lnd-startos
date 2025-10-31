// startos/actions/manualBackup.ts
import { sdk } from '../sdk'
import { lndDataDir } from '../utils'

export const manualBackup = sdk.Action.withoutInput(
  'manual-backup',
  async ({ effects }) => ({
    name: 'Manual Channel Backup',
    description: 'Manually trigger a backup by exporting the channel.backup file.',
    warning: null,
    allowedStatuses: 'only-running',
    group: 'Backup',
    visibility: 'enabled',
  }),
  async ({ effects }) => {
    const sub = await sdk.SubContainer.of(
      effects,
      { imageId: 'lnd' },
      sdk.Mounts.of().mountVolume({
        volumeId: 'main',
        subpath: null,
        mountpoint: lndDataDir,
        readonly: false,
      }),
      'manual-touch'
    )
    await sub.exec(['lncli', '--rpcserver=lnd.startos', 'exportchanbackup', '--all', '--output_file', `${lndDataDir}/data/chain/bitcoin/mainnet/channel.backup`])
    return {
      version: '1',
      title: '✅ Manual Backup Triggered',
      message: 'The backup watcher should now sync the file.',
      result: null,
    }
  }
)