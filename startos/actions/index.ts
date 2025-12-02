import { sdk } from '../sdk'
import { autopilotConfig } from './config/autopilot'
import { backendConfig } from './config/backend'
import { bitcoinConfig } from './config/bitcoin'
import { dbBoltConfig } from './config/dbBolt'
import { general } from './config/general'
import { setExternalGateway } from './config/externalGateway'
import { protocolConfig } from './config/protocol'
import { sweeperConfig } from './config/sweeper'
import { aezeedCipherSeed, confirmSeedBackup, deleteCipherSeed } from './aezeedCipherSeed'
import { addBackupTarget } from './addBackupTarget'
import { manualBackup } from './manualBackup'
import { disableAutoUnlock } from './disableAutoUnlock'
import { walletPassword, manualWalletUnlock } from './walletPassword'
import { confirmPasswordBackup, deleteWalletPassword } from './confirmPasswordBackup'
import { wtClientConfig } from './config/watchtowerClient'
import { watchtowerServerConfig } from './config/watchtowerServer'
import { towerInfo } from './towerInfo'
import { importUmbrel } from './importUmbrel'
import { nodeInfo } from './nodeInfo'
import { recreateMacaroons } from './recreate-macaroons'
import { resetWalletTransactions } from './resetTxns'


export const actions = sdk.Actions.of()
  .addAction(general)
  .addAction(autopilotConfig)
  .addAction(backendConfig)
  .addAction(bitcoinConfig)
  .addAction(dbBoltConfig)
  .addAction(protocolConfig)
  .addAction(sweeperConfig)
  .addAction(resetWalletTransactions)
  .addAction(nodeInfo)
  .addAction(aezeedCipherSeed)
  .addAction(confirmSeedBackup)
  .addAction(deleteCipherSeed)
  .addAction(addBackupTarget)
  .addAction(manualBackup)
  .addAction(disableAutoUnlock)
  .addAction(manualWalletUnlock)
  .addAction(walletPassword)
  .addAction(confirmPasswordBackup)
  .addAction(wtClientConfig)
  .addAction(watchtowerServerConfig)
  .addAction(towerInfo)
  .addAction(recreateMacaroons)
  .addAction(importUmbrel)
  .addAction(setExternalGateway)