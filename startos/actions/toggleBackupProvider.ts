// startos/actions/toggleBackupProvider.ts
import { sdk } from '../sdk'
import { storeJson } from '../fileModels/store.json'
export const toggleBackupProvider = sdk.Action.withInput(
  'toggle-backup-provider',
  async ({ effects }) => ({
    name: 'Toggle Backup Provider',
    description: 'Enable or disable a specific backup provider.',
    warning: null,
    allowedStatuses: 'only-running',
    group: 'Backup',
    visibility: 'enabled',
  }),
  sdk.InputSpec.of({
    provider: sdk.Value.text({
      name: 'Provider Remote Path or "email"',
      description: 'The remote path (e.g., gdrive:lnd-backups) or "email" to toggle.',
      default: '',
      required: true,
    }),
  }),
  async ({ effects }) => null,
  async ({ effects, input }) => {
    const provider = input.provider?.trim()
    if (!provider) throw new Error('Provider is required.')
    const store = (await storeJson.read().once())!
    let updates: any = {}
    if (provider === 'email') {
      updates.emailEnabled = ! (store.emailEnabled ?? true)
    } else {
      let currentEnabled = store.enabledRemotes || []
      if (currentEnabled.includes(provider)) {
        currentEnabled = currentEnabled.filter((r: string) => r !== provider)
      } else if (store.selectedRcloneRemotes?.includes(provider)) {
        currentEnabled.push(provider)
      } else {
        throw new Error('Provider not found.')
      }
      updates.enabledRemotes = currentEnabled
    }
    await storeJson.merge(effects, updates)
    return {
      version: '1',
      title: '✅ Provider Toggled',
      message: `The provider ${provider} is now ${updates.emailEnabled ?? updates.enabledRemotes.includes(provider) ? 'enabled' : 'disabled'}.`,
      result: null,
    }
  }
)