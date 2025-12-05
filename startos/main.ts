import { sdk } from './sdk'
import { FileHelper } from '@start9labs/start-sdk'
import {
  GetInfo,
  lndConfDefaults,
  lndDataDir,
  mainMounts,
  sleep,
} from './utils'
import { restPort } from './interfaces'
import { lndConfFile } from './fileModels/lnd.conf'
import { manifest } from './manifest'
import { storeJson } from './fileModels/store.json'
import { customConfigJson } from './fileModels/custom-config.json'
import { access } from 'fs/promises'
import { base64 } from 'rfc4648'
export const main = sdk.setupMain(async ({ effects, started }) => {
  console.log('Starting LND!')

  let {
    recoveryWindow,
    resetWalletTransactions,
    restore,
    walletInitialized,
    walletPassword,
    watchtowers,
    pendingPasswordChange,
    passwordChangeError,
    autoUnlockEnabled,
    seedBackupConfirmed,
    passwordBackupConfirmed,
  } = (await storeJson.read().once())!

  // Ensures custom-config.json is always created — critical for seamless switching between this fork and the official Start9 LND package (same version).
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

  if (autoUnlockEnabled) {
    console.log('Auto-unlock is enabled. Clearing manual-wallet-unlock task...')
    try {
      await sdk.action.clearTask(effects, 'lnd', 'manual-wallet-unlock')
      console.log('✅ Manual unlock task cleared successfully.')
    } catch (err) {
      console.log('ℹ️ No manual-wallet-unlock task to clear (or already gone).')
    }
  } else if (walletInitialized) {
    console.log('Auto-unlock disabled and wallet initialized. Creating manual unlock task...')
    try {
      const { manualWalletUnlock } = await import('./actions/walletPassword')
      await sdk.action.createOwnTask(effects, manualWalletUnlock, 'optional', {
        reason: 'LND wallet is locked and auto-unlock is disabled. Use the "Unlock Wallet" action to provide your password. If you have enabled auto-unlock, you can safely dismiss this task.',
      })
      console.log('✅ Manual unlock task created.')
    } catch (err) {
      console.warn('⚠️ Failed to create manual unlock task:', (err as Error).message)
    }
  }

  console.log('Auto-unlock enabled:', autoUnlockEnabled)
  console.log('Seed backup confirmed:', seedBackupConfirmed)
  console.log('Password backup confirmed:', passwordBackupConfirmed)

  const conf = (await lndConfFile.read().const(effects))!

  let mounts = mainMounts

  if (conf['bitcoin.node'] === 'bitcoind') {
    mounts = mounts.mountDependency({
      dependencyId: 'bitcoind',
      mountpoint: '/mnt/bitcoin',
      readonly: true,
      subpath: null,
      volumeId: 'main',
    })
    const depResult = await sdk.checkDependencies(effects)
    depResult.throwIfRunningNotSatisfied('bitcoind')
    depResult.throwIfInstalledVersionNotSatisfied('bitcoind')
    depResult.throwIfTasksNotSatisfied('bitcoind')
    depResult.throwIfHealthNotSatisfied('bitcoind', 'primary')
  }

  if (!walletInitialized) {
    console.log('Fresh install detected. Initializing LND wallet')
    await initializeLnd(effects, mounts)
    const updatedStore = (await storeJson.read().once())!
    walletPassword = updatedStore.walletPassword
    recoveryWindow = updatedStore.recoveryWindow
    resetWalletTransactions = updatedStore.resetWalletTransactions
    restore = updatedStore.restore
    walletInitialized = updatedStore.walletInitialized
    watchtowers = updatedStore.watchtowers
    pendingPasswordChange = updatedStore.pendingPasswordChange
    passwordChangeError = updatedStore.passwordChangeError
    autoUnlockEnabled = updatedStore.autoUnlockEnabled
    seedBackupConfirmed = updatedStore.seedBackupConfirmed
    passwordBackupConfirmed = updatedStore.passwordBackupConfirmed
    console.log('Auto-unlock enabled after initialization:', autoUnlockEnabled)
  }

  if (pendingPasswordChange) {
    if (!walletPassword) {
      throw new Error('Cannot change password: no current password available')
    }
    console.log('Pending password change detected. Performing change...')
    const newPassword = Buffer.from(pendingPasswordChange, 'base64').toString('utf8')
    const currentPassword = walletPassword
    

    try {
      await sdk.SubContainer.withTemp(
        effects,
        { imageId: 'lnd' },
        mounts,
        'change-password-temp',
        async (lndSub) => {
          const lndArgs: string[] = []
          if (resetWalletTransactions) lndArgs.push('--reset-wallet-transactions')
          lndArgs.push('--nobootstrap')
          lndArgs.push('--debuglevel=info')
          lndArgs.push('--rpclisten=0.0.0.0:10009')
          lndArgs.push('--restlisten=0.0.0.0:8080')

          console.log('Spawning LND with args:', lndArgs)
          await lndSub.spawn(['lnd', ...lndArgs])

          await new Promise(r => setTimeout(r, 2000))
          let attempts = 0
          const maxAttempts = 60
          let restReady = false
          while (attempts < maxAttempts) {
            try {
              const portTest = await lndSub.exec([
                'curl',
                '--no-progress-meter',
                '--insecure',
                '--cacert',
                `${lndDataDir}/tls.cert`,
                'https://localhost:8080/v1/genseed',
              ])
              if (portTest.exitCode === 0) {
                restReady = true
                break
              }
            } catch (e: unknown) {
              const errorMessage = e instanceof Error ? e.message : String(e)
              console.log('REST API check failed:', errorMessage)
            }
            await new Promise(r => setTimeout(r, 1000))
            attempts++
          }
          if (!restReady) {
            throw new Error('LND REST port not ready after 60s.')
          }

          const currentBase64 = Buffer.from(currentPassword, 'utf8').toString('base64')
          const newBase64 = Buffer.from(newPassword, 'utf8').toString('base64')
          const jsonBody = JSON.stringify({
            current_password: currentBase64,
            new_password: newBase64,
            stateless_init: false,
            new_macaroon_root_key: false,
          }).replace(/"/g, '\\"')
          const curlCmd = `curl -v -X POST --insecure --cacert ${lndDataDir}/tls.cert https://localhost:8080/v1/changepassword -H "Content-Type: application/json" -d "${jsonBody}"`
          const changeResult = await lndSub.exec(['sh', '-c', curlCmd])

          if (changeResult.exitCode !== 0) {
            const errStr = (changeResult.stderr?.toString() || changeResult.stdout?.toString() || '').toLowerCase()
            throw new Error(`Password change failed: ${errStr.substring(0, 300)}...`)
          }

          const response = changeResult.stdout?.toString().trim()
          let apiError = null
          if (response && response !== '{}') {
            try {
              const parsed = JSON.parse(response)
              if (parsed.error || parsed.message) {
                apiError = parsed.message || parsed.error || response
              }
            } catch (e) {
              apiError = response
            }
          }
          if (apiError) {
            throw new Error(`API error: ${apiError.substring(0, 200)}...`)
          }

          await lndSub.exec(['pkill', '-9', 'lnd'])
        },
      )

      console.log('Updating store with new password')
      await storeJson.merge(effects, {
        walletPassword: newPassword,
        pendingPasswordChange: null,
        passwordChangeError: null,
        autoUnlockEnabled: true,
      })
      console.log('Password changed successfully.')

      try {
        await sdk.action.clearTask(effects, 'lnd', 'manual-wallet-unlock')
        console.log('✅ Manual unlock task cleared after password change.')
      } catch (clearTaskErr) {
        console.warn('ℹ️ Could not clear manual unlock task (likely already gone).')
      }

      const updatedStore = (await storeJson.read().once())!
      walletPassword = updatedStore.walletPassword
      recoveryWindow = updatedStore.recoveryWindow
      resetWalletTransactions = updatedStore.resetWalletTransactions
      restore = updatedStore.restore
      walletInitialized = updatedStore.walletInitialized
      watchtowers = updatedStore.watchtowers
      pendingPasswordChange = updatedStore.pendingPasswordChange
      passwordChangeError = updatedStore.passwordChangeError
      autoUnlockEnabled = updatedStore.autoUnlockEnabled
      seedBackupConfirmed = updatedStore.seedBackupConfirmed
      passwordBackupConfirmed = updatedStore.passwordBackupConfirmed
      console.log('Auto-unlock enabled after password change:', autoUnlockEnabled)
    } catch (err) {
      console.error('Password change failed:', err)
      await storeJson.merge(effects, {
        pendingPasswordChange: null,
        passwordChangeError: (err as Error).message || String(err),
      })
      throw err
    }
  }

  await storeJson.read().const(effects)

  const osIp = await sdk.getOsIp(effects)

  if (
    ![conf.rpclisten].flat()?.includes(lndConfDefaults.rpclisten[0]) ||
    ![conf.restlisten].flat()?.includes(lndConfDefaults.restlisten[0]) ||
    conf['tor.socks'] !== `${osIp}:9050`
  ) {
    await lndConfFile.merge(
      effects,
      {
        'tor.socks': `${osIp}:9050`,
        rpclisten: conf.rpclisten
          ? [
              ...new Set(
                [[conf.rpclisten].flat(), lndConfDefaults.rpclisten].flat(),
              ),
            ]
          : lndConfDefaults.rpclisten,
        restlisten: conf.restlisten
          ? [
              ...new Set(
                [[conf.restlisten].flat(), lndConfDefaults.restlisten].flat(),
              ),
            ]
          : lndConfDefaults.restlisten,
      },
      { allowWriteAfterConst: true },
    )
  }

  const lndArgs: string[] = []

  if (resetWalletTransactions) lndArgs.push('--reset-wallet-transactions')

  const lndSub = await sdk.SubContainer.of(
    effects,
    { imageId: 'lnd' },
    mounts,
    'lnd-sub',
  )

  if (conf['bitcoin.node'] === 'bitcoind') {
    await FileHelper.string(`${lndSub.rootfs}/mnt/bitcoin/.cookie`)
      .read()
      .const(effects)
  }

  return sdk.Daemons.of(effects, () => started(() => Promise.resolve()))
    .addDaemon('primary', {
      exec: { command: ['lnd', ...lndArgs] },
      subcontainer: lndSub,
      ready: {
        display: 'REST Interface',
        fn: () =>
          sdk.healthCheck.checkPortListening(effects, restPort, {
            successMessage: 'The REST interface is ready to accept connections',
            errorMessage: 'The REST Interface is not ready',
          }),
      },
      requires: [],
    })
    .addOneshot('unlock-wallet', {
      exec: {
        fn: async (subcontainer, abort) => {
          const currentStore = (await storeJson.read().const(effects))!
          const currentAutoUnlockEnabled = currentStore.autoUnlockEnabled
          const currentWalletPasswordPlaintext = currentStore.walletPassword
            if (!currentWalletPasswordPlaintext) {
            console.log('No wallet password found. Skipping unlock.')
            return null
            }
          const walletPasswordForApi = Buffer.from(currentWalletPasswordPlaintext, 'utf8').toString('base64')
          const currentWalletInitialized = currentStore.walletInitialized
          const recoveryWindow = currentStore.recoveryWindow
          const restore = currentStore.restore

          console.log(`Unlock oneshot started... Auto-unlock: ${currentAutoUnlockEnabled}`)

         if (!currentWalletInitialized) {
  console.log('Wallet not initialized. Skipping unlock.')
  return null
}

if (currentAutoUnlockEnabled && currentWalletPasswordPlaintext) {
  console.log('Auto-unlock enabled. Unlocking wallet...')
  
  let unlockAttempts = 0;
  const maxUnlockAttempts = 5;
  let unlockSuccess = false;

  while (unlockAttempts < maxUnlockAttempts && !unlockSuccess) {
    try {
      
      const command = [
        'curl',
        '--no-progress-meter',
        '-X', 'POST',
        '--insecure',
        '--cacert', `${lndDataDir}/tls.cert`,
        'https://lnd.startos:8080/v1/unlockwallet',
        '-d',
        restore
          ? JSON.stringify({ wallet_password: walletPasswordForApi, recovery_window: recoveryWindow })
          : JSON.stringify({ wallet_password: walletPasswordForApi })
      ];
      
      const result = await subcontainer.exec(command, undefined, undefined, { 
        abort: abort.reason, 
        signal: abort 
      });
      
      if (result.exitCode === 0 && result.stdout?.toString().trim() === '{}') { 
        unlockSuccess = true;
      } else {
        throw new Error(`Unlock failed: ${result.stderr?.toString() || 'Unknown error'}`);
      }
    } catch (err) {
      console.error('Unlock attempt failed:', (err as Error).message);
      unlockAttempts++;
      if (unlockAttempts < maxUnlockAttempts) {
        const delayStart = Date.now();
        const totalDelayMs = 5000;
        const pollIntervalMs = 500;
        while (Date.now() - delayStart < totalDelayMs) {
          if (abort.aborted) {
            throw new Error('Unlock aborted during retry delay');
          }
          await new Promise(resolve => setTimeout(resolve, pollIntervalMs));  // Check abort every 0.5s
        }
      } else {
        throw new Error(`Failed to unlock wallet after ${maxUnlockAttempts} attempts: ${(err as Error).message}`);
      }
    }
  }

  if (!unlockSuccess) {
    throw new Error('Unlock failed after all attempts');
  }
  
  return null
} else {
  console.log('Auto-unlock disabled or no password. Skipping auto-unlock.')
  return null
}
      },
    },
    subcontainer: lndSub,
    requires: ['primary'],
  })
    
.addDaemon('channel-backup-watcher', {
  exec: {
    command: [
      'sh', '-c',
      [
        'SHOULD_EXIT=0',
        'cleanup() { SHOULD_EXIT=1; pkill -P $$ -f inotifywait 2>/dev/null; exit 0; }',
        'trap cleanup TERM INT',
        'backup_file="' + lndDataDir + '/data/chain/bitcoin/mainnet/channel.backup"',
        'config_file="' + lndDataDir + '/custom-config.json"',
        '',
        '# Wait for config file to exist',
        'while [ ! -f "$config_file" ]; do',
        ' if [ "$SHOULD_EXIT" = "1" ]; then exit 0; fi',
        ' sleep 2',
        'done',
        '',
        'while :; do',
        ' if [ "$SHOULD_EXIT" = "1" ]; then exit 0; fi',
        ' enabled=$(jq -r \'.channelAutoBackupEnabled // false\' "$config_file" 2>/dev/null || echo "false")',
        ' if [ "$enabled" != "true" ]; then',
        ' # Auto-backup disabled: wait for config change with short timeout',
        ' inotifywait -q -t 2 -e modify "$config_file" 2>/dev/null',
        ' continue',
        ' fi',
        ' if [ ! -s "$backup_file" ]; then',
        ' lncli --rpcserver=lnd.startos exportchanbackup --all --output_file "$backup_file" 2>/dev/null || sleep 5',
        ' continue',
        ' fi',
        ' # Wait for channel.backup change with short timeout',
        ' if ! inotifywait -q -t 2 -e modify,move,create "$backup_file" 2>/dev/null; then',
        ' continue # timeout → loop and check SHOULD_EXIT',
        ' fi',
        ' echo "[$(date -Iseconds)] 🔄 Channel backup file changed. Triggering backup..." >&2',
        '',
        ' # Load config',
        ' rclone_b64=$(jq -r \'.rcloneConfig // empty\' "$config_file" 2>/dev/null)',
        ' [ -n "$rclone_b64" ] && echo "$rclone_b64" | base64 -d > /tmp/rclone.conf 2>/dev/null',
        ' remotes=$(jq -r \'.selectedRcloneRemotes // empty | .[]\' "$config_file" 2>/dev/null)',
        '',
        ' # Define normal and onion-specific timings',
        ' normal_overall_timeout=12',
        ' normal_contimeout=5s',
        ' normal_timeout=10s',
        ' onion_overall_timeout=60',
        ' onion_contimeout=30s',
        ' onion_timeout=50s',
        '',
        ' # Rclone',
        ' for remote in $remotes; do',
        ' echo "[$(date -Iseconds)] [RCLONE] Starting backup to $remote..." >&2',
        ' remote_name=$(echo "$remote" | cut -d: -f1)',
        '',
        ' # Check if this remote is SFTP and uses .onion',
        ' if [ "$remote_name" = "sftp" ]; then',
        '   sftp_host=$(jq -r --arg rname "$remote_name" \'.rcloneConfig // empty\' "$config_file" | base64 -d 2>/dev/null | grep -A 10 "\\[$remote_name\\]" | grep -i "host.*\\.onion" || echo "")',
        '   if [ -n "$sftp_host" ]; then',
        '     echo "[$(date -Iseconds)] [RCLONE] Detected SFTP .onion address, using Tor proxy (timeout=60s)..." >&2',
        '     overall_timeout=$onion_overall_timeout',
        '     contimeout=$onion_contimeout',
        '     timeout_opt=$onion_timeout',
        '     if RCLONE_CONFIG=/tmp/rclone.conf timeout ${overall_timeout}s rclone copy "$backup_file" "$remote" \\',
        '       --log-level=INFO \\',
        '       --contimeout=${contimeout} \\',
        '       --timeout=${timeout_opt} \\',
        '       --retries=1; then',
        '       echo "[$(date -Iseconds)] [RCLONE: $remote] ✅ Success" >&2',
        '     else',
        '       echo "[$(date -Iseconds)] [RCLONE: $remote] ❌ Failed" >&2',
        '     fi',
        '     continue',
        '   fi',
        ' fi',
        '',
        ' # Check if this remote is Nextcloud and uses .onion',
        ' if [ "$remote_name" = "nextcloud" ]; then',
        '   uses_onion=$(jq -r --arg rname "$remote_name" \'.rcloneConfig // empty\' "$config_file" | base64 -d 2>/dev/null | grep -A 10 "\\[$remote_name\\]" | grep -i "url.*\\.onion" || echo "")',
        '   if [ -n "$uses_onion" ]; then',
        '     echo "[$(date -Iseconds)] [RCLONE] Detected Nextcloud .onion address, using Tor proxy (timeout=60s)..." >&2',
        '     overall_timeout=$onion_overall_timeout',
        '     contimeout=$onion_contimeout',
        '     timeout_opt=$onion_timeout',
        '     if HTTP_PROXY=socks5://10.0.3.1:9050 HTTPS_PROXY=socks5://10.0.3.1:9050 ALL_PROXY=socks5://10.0.3.1:9050 RCLONE_CONFIG=/tmp/rclone.conf timeout ${overall_timeout}s rclone copy "$backup_file" "$remote" \\',
        '       --log-level=INFO \\',
        '       --contimeout=${contimeout} \\',
        '       --timeout=${timeout_opt} \\',
        '       --retries=1 \\',
        '       --no-check-certificate; then',
        '       echo "[$(date -Iseconds)] [RCLONE: $remote] ✅ Success" >&2',
        '     else',
        '       echo "[$(date -Iseconds)] [RCLONE: $remote] ❌ Failed" >&2',
        '     fi',
        '     continue',
        '   fi',
        ' fi',
        '',
        ' # Normal clearnet remote (Dropbox, GDrive, non-onion SFTP/Nextcloud, etc.)',
        ' overall_timeout=$normal_overall_timeout',
        ' contimeout=$normal_contimeout',
        ' timeout_opt=$normal_timeout',
        ' if RCLONE_CONFIG=/tmp/rclone.conf timeout ${overall_timeout}s rclone copy "$backup_file" "$remote" \\',
        '   --log-level=INFO \\',
        '   --contimeout=${contimeout} \\',
        '   --timeout=${timeout_opt} \\',
        '   --retries=1; then',
        '   echo "[$(date -Iseconds)] [RCLONE: $remote] ✅ Success" >&2',
        ' else',
        '   echo "[$(date -Iseconds)] [RCLONE: $remote] ❌ Failed" >&2',
        ' fi',
        ' done',
        '',
        ' # Email',
        ' email_enabled=$(jq -r \'.emailEnabled // false\' "$config_file" 2>/dev/null)',
        ' if [ "$email_enabled" = "true" ]; then',
        ' email_to=$(jq -r \'.emailBackup.to // empty\' "$config_file" 2>/dev/null)',
        ' if [ -z "$email_to" ] || [ "$email_to" = "empty" ]; then',
        ' echo "[$(date -Iseconds)] [EMAIL] ⚠️ Skipped: email_to not configured" >&2',
        ' else',
        ' email_from=$(jq -r \'.emailBackup.from // empty\' "$config_file" 2>/dev/null)',
        ' email_smtp_server=$(jq -r \'.emailBackup.smtp_server // "smtp.gmail.com"\' "$config_file" 2>/dev/null)',
        ' email_smtp_port=$(jq -r \'.emailBackup.smtp_port // 465\' "$config_file" 2>/dev/null)',
        ' email_smtp_user=$(jq -r \'.emailBackup.smtp_user // empty\' "$config_file" 2>/dev/null)',
        ' email_smtp_pass=$(jq -r \'.emailBackup.smtp_pass // empty\' "$config_file" 2>/dev/null)',
        ' if [ -z "$email_smtp_pass" ] || [ "$email_smtp_pass" = "empty" ]; then',
        ' echo "[$(date -Iseconds)] [EMAIL] ❌ Skipped: missing password" >&2',
        ' else',
        ' echo "[$(date -Iseconds)] [EMAIL] Starting backup to $email_to..." >&2',
        ' protocol="smtps"; starttls="no"',
        ' [ "$email_smtp_port" = "587" ] && { protocol="smtp"; starttls="yes"; }',
        ' cat > /tmp/muttrc <<EOF',
        'set from = "$email_from"',
        'set realname = "LND Backup"',
        'set smtp_url = "$protocol://$email_smtp_user@$email_smtp_server:$email_smtp_port/"',
        'set smtp_pass = "$email_smtp_pass"',
        'set ssl_starttls = $starttls',
        'set ssl_force_tls = yes',
        'EOF',
        ' attempt=1',
        ' max_attempts=5',
        ' while [ $attempt -le $max_attempts ]; do',
        ' if nslookup "$email_smtp_server" >/dev/null 2>&1; then',
        ' break',
        ' fi',
        ' echo "[$(date -Iseconds)] [EMAIL] DNS lookup failed for \'$email_smtp_server\' (attempt $attempt/$max_attempts). Retrying in 2s..." >&2',
        ' sleep 2',
        ' attempt=$((attempt + 1))',
        ' done',
        ' if [ $attempt -gt $max_attempts ]; then',
        ' echo "[$(date -Iseconds)] [EMAIL] ❌ Failed: Could not resolve host \'$email_smtp_server\' after $max_attempts retries" >&2',
        ' else',
        ' recipients=$(echo "$email_to" | tr -d \' \' | tr \',\' \' \')',
        ' if echo "Backup attached." | mutt -F /tmp/muttrc -s "LND Channel Backup $(date -Iseconds)" -a "$backup_file" -- $recipients; then',
        ' echo "[$(date -Iseconds)] [EMAIL] ✅ Success" >&2',
        ' else',
        ' echo "[$(date -Iseconds)] [EMAIL] ❌ Failed" >&2',
        ' fi',
        ' fi',
        ' fi',
        ' fi',
        ' fi',
        'done'
      ].join('\n')
    ],
  },
  subcontainer: lndSub,
  ready: {
  display: null, 
    fn: async () => {
      const config = await customConfigJson.read().once()
      return config?.channelAutoBackupEnabled
        ? { result: 'success', message: '✅ Active' }
        : { result: 'disabled', message: '❌ Disabled' }
    },
  },
  requires: ['primary'],
})
    .addHealthCheck('sync-progress', {
      requires: ['primary', 'unlock-wallet'],
      ready: {
        display: 'Network and Graph Sync Progress',
        fn: async () => {
          const res = await lndSub.exec(
            ['lncli', '--rpcserver=lnd.startos', 'getinfo'],
            {},
            30_000,
          )
          if (
            res.exitCode === 0 &&
            res.stdout !== '' &&
            typeof res.stdout === 'string'
          ) {
            const info: GetInfo = JSON.parse(res.stdout)

            if (info.synced_to_chain && info.synced_to_graph) {
              return {
                message: 'Synced to chain and graph',
                result: 'success',
              }
            } else if (!info.synced_to_chain && info.synced_to_graph) {
              return {
                message: 'Synced to graph but not to chain',
                result: 'loading',
              }
            } else if (info.synced_to_chain && !info.synced_to_graph) {
              return {
                message: 'Synced to chain but not to graph',
                result: 'loading',
              }
            } else {
              return {
                message: 'Not synced to chain or graph',
                result: 'loading',
              }
            }
          } else if (
            res.exitCode === 2 &&
            typeof res.stderr === 'string' &&
            res.stderr.includes(
              'rpc error: code = Unknown desc = waiting to start',
            )
          ) {
            return {
              message: 'LND is starting…',
              result: 'starting',
            }
          }

          if (res.exitCode === null) {
            return {
              message: 'Syncing to graph',
              result: 'loading',
            }
          }
          return {
            message: `Error: ${res.stderr as string}`,
            result: 'failure',
          }
        },
      },
    })
    .addHealthCheck('wallet-status', {
      requires: ['primary'],
      ready: {
        display: 'Wallet Status',
        fn: async () => {
          const store = await storeJson.read().const(effects);
          const autoUnlockEnabled = store?.autoUnlockEnabled ?? false;
          const walletInitialized = store?.walletInitialized ?? false;

          if (!walletInitialized) {
            return {
              message: 'Wallet not initialized',
              result: 'loading',
            };
          }

          const res = await lndSub.exec(['lncli', '--rpcserver=lnd.startos', 'getinfo'], {}, 30_000);

          if (res.exitCode === 0) {
            return {
              message: 'Wallet is unlocked',
              result: 'success',
            };
          } else if (
            res.stderr &&
            typeof res.stderr === 'string' &&
            (res.stderr.includes('wallet locked, unlock it to enable full RPC access') ||
             res.stderr.includes('wallet is encrypted'))
          ) {
            if (autoUnlockEnabled) {
              return {
                message: `Wallet is locked, but auto-unlock is enabled. \u{1F511} Password is not correct! Go to "Actions ⇢ Security ⇢ Wallet - Auto-Unlock" and enter correct password.`,
                result: 'failure',
              };
            } else {
              return {
                message: 'Wallet is locked as auto-unlock is disabled. Go to \u{21D3} Tasks or "Actions ⇢ Security ⇢ Wallet - Manual Unlock" and enter correct password.',
                result: 'failure',
              };
            }
          } else {
            return {
              message: `Unknown error: ${res.stderr as string}`,
              result: 'failure',
            };
          }
        },
      },
    })
    .addHealthCheck('security-status', {
  requires: ['primary'],
  ready: {
    display: 'Security Status',
    fn: async () => {
      const store = await storeJson.read().const(effects);
      const config = await customConfigJson.read().once();
      const conf = (await lndConfFile.read().const(effects))!;

      const backupEnabled = config?.channelAutoBackupEnabled ?? false;
      const backupIcon = backupEnabled ? '🟢】' : '🔴】';
      const backupText = backupEnabled ? 'ENABLED' : 'DISABLED';
      const backupStatus = `${backupText}${backupIcon}`;

      const autoUnlock = store?.autoUnlockEnabled ?? false;
      const unlockIcon = autoUnlock ? '🟡】' : '🟢】';
      const unlockText = autoUnlock ? 'AUTO ' : 'MANUAL';
      const unlockStatus = `${unlockText}${unlockIcon}`;

      const seedOnServer = (store?.aezeedCipherSeed || []).length > 0;
      const seedIcon = seedOnServer ? '🟡】' : '🟢】';
      const seedText = seedOnServer ? 'ON SERVER' : 'DELETED';
      const seedStatus = `${seedText}${seedIcon}`;

     
      const wtClientEnabled = (store?.watchtowers || []).length > 0;
      const wtIcon = wtClientEnabled ? '🟢】' : '🔴】';
      const wtText = wtClientEnabled ? 'ENABLED' : 'DISABLED';
      const wtStatus = `${wtText}${wtIcon}`;

      const allGood = backupEnabled && !autoUnlock && !seedOnServer && wtClientEnabled;
      const result = allGood ? 'success' : 'failure';

      const label1 = `【① Channels Backup: `; 
      const label2 = `【② Wallet Unlocking: `; 
      const label3 = `【③ Aezeed Seed: `;
      const label4 = `【④ Watchtower Client: `; 

      

      const message = `${label1}${(backupStatus)}` +
                      `${label2}${(unlockStatus)}` +
                      `${label3}${(seedStatus)}` +
                      `${label4}${(wtStatus)}`;

      return {
        message,
        result,
      };
    },
  },
})
    .addOneshot('restore', () =>
      restore
        ? ({
            subcontainer: lndSub,
            exec: {
              fn: async () => {
                await sdk.setHealth(effects, {
                  id: 'restored',
                  name: 'Backup Restoration Detected',
                  message:
                    'Lightning Labs strongly recommends against continuing to use a LND node after running restorechanbackup. Please recover and sweep any remaining funds to another wallet. Afterwards LND should be uninstalled. LND can then be re-installed fresh if you would like to continue using LND.',
                  result: 'failure',
                })
                return {
                  command: [
                    'lncli',
                    '--rpcserver=lnd.startos',
                    'restorechanbackup',
                    '--multi_file',
                    `${lndDataDir}/data/chain/bitcoin/mainnet/channel.backup`,
                  ],
                }
              },
            },
            requires: ['primary', 'unlock-wallet'],
          } as const)
        : null,
    )
    .addHealthCheck('reachability', () =>
      !conf.externalip && !conf.externalhosts?.length
        ? ({
            ready: {
              display: 'Node Reachability',
              fn: () => ({
                result: 'disabled',
                message:
                  'Your node can peer with other nodes, but other nodes cannot peer with you. Optionally add a Tor domain, public domain, or public IP address to change this behavior.',
              }),
            },
            requires: ['primary'],
          } as const)
        : null,
    )
    .addOneshot('add-watchtowers', () =>
      watchtowers.length > 0
        ? ({
            subcontainer: lndSub,
            exec: {
              fn: async (subcontainer: typeof lndSub, abort) => {
                for (const tower of watchtowers || []) {
                  if (abort.aborted) return null
                  console.log(`Watchtower client adding ${tower}`)
                  let res = await subcontainer.exec(
                    [
                      'lncli',
                      '--rpcserver=lnd.startos',
                      'wtclient',
                      'add',
                      tower,
                    ],
                    undefined,
                    undefined,
                    {
                      abort: abort.reason,
                      signal: abort,
                    },
                  )

                  if (
                    res.exitCode === 0 &&
                    res.stdout !== '' &&
                    typeof res.stdout === 'string'
                  ) {
                    console.log(`Result adding tower ${tower}: ${res.stdout}`)
                  } else {
                    console.log(`Error adding tower ${tower}: ${res.stderr}`)
                  }
                }
                return null
              },
            },
            requires: ['primary', 'unlock-wallet', 'sync-progress'],
          } as const)
        : null,
    )
})

async function initializeLnd(
  effects: any,
  mounts: typeof mainMounts,
) {
  await sdk.SubContainer.withTemp(
    effects,
    {
      imageId: 'lnd',
    },
    mounts,
    'initialize-lnd',
    async (subc) => {
      const child = await subc.spawn(['lnd'])

      let cipherSeed: string[] = []
      do {
        const res = await subc.exec([
          'curl',
          '--no-progress-meter',
          'GET',
          '--insecure',
          '--cacert',
          `${lndDataDir}/tls.cert`,
          '--fail-with-body',
          'https://lnd.startos:8080/v1/genseed',
        ])
        if (
          res.exitCode === 0 &&
          res.stdout !== '' &&
          typeof res.stdout === 'string'
        ) {
          cipherSeed = JSON.parse(res.stdout)['cipher_seed_mnemonic']
          break
        } else {
          console.log('Waiting for RPC to start...')
          await sleep(5_000)
        }
      } while (true)

      const store = (await storeJson.read().once())!

const walletPasswordPlaintext = store.walletPassword!
const walletPasswordForApi = Buffer.from(walletPasswordPlaintext, 'utf8').toString('base64')

await storeJson.merge(effects, {
  aezeedCipherSeed: cipherSeed,
  walletInitialized: true,
  autoUnlockEnabled: true,
  seedBackupConfirmed: store.seedBackupConfirmed ?? false,
  passwordBackupConfirmed: store.passwordBackupConfirmed ?? false,
})

const status = await subc.exec([
  'curl',
  '--no-progress-meter',
  '-X', 'POST',
  '--insecure',
  '--cacert', `${lndDataDir}/tls.cert`,
  '--fail-with-body',
  'https://lnd.startos:8080/v1/initwallet',
  '-d', JSON.stringify({
    wallet_password: walletPasswordForApi,
    cipher_seed_mnemonic: cipherSeed,
  }),
])

      if (status.stderr !== '' && typeof status.stderr === 'string') {
        console.log(`Error running initwallet: ${status.stderr}`)
      }

      child.kill('SIGTERM')
      await new Promise<void>((resolve) => {
        child.on('exit', () => resolve())
        setTimeout(resolve, 60_000)
      })
    },
  )
}