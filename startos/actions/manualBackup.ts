// startos/actions/manualBackup.ts
import { sdk } from '../sdk'
import { lndDataDir } from '../utils'
import { writeFile } from 'fs/promises'  // Add this import

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
    // Run export without --output_file
    const res = await sub.exec(['lncli', '--rpcserver=lnd.startos', 'exportchanbackup', '--all'])
    if (res.exitCode !== 0) {
      throw new Error(`Export failed: ${res.stderr}`)
    }
    // Parse JSON output
    const data = JSON.parse(res.stdout)
    // Decode base64 multi backup blob
    const multiBackup = Buffer.from(data.multi_chan_backup, 'base64')
    // Write to file inside subcontainer (updates mtime, triggers watcher)
    await writeFile(`${sub.rootfs}${lndDataDir}/data/chain/bitcoin/mainnet/channel.backup`, multiBackup)
    return {
      version: '1',
      title: '✅ Manual Backup Triggered',
      message: 'The backup watcher should now sync the file.',
      result: null,
    }
  }
)