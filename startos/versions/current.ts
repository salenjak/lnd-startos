import { VersionInfo } from '@start9labs/start-sdk'

export const current = VersionInfo.of({
  version: '0.21.3-beta:1',
  releaseNotes: {
    en_US: `Updated LND to 0.21.3-beta. Fixes native SQLite migration for AMP invoices, peer-triggered resource exhaustion, a wallet-wide channel-funding deadlock, stuck forwarded HTLCs, cooperative-close failures, and REST WebSocket and transaction-pagination panics. [Full upstream release notes](https://github.com/lightningnetwork/lnd/releases/tag/v0.21.3-beta)

New Security group and automatic channel-backup feature:

- Channels - Auto-Backup: back up channel.backup to SFTP, Dropbox, Nextcloud, Google Drive, and/or by email whenever a channel opens or closes.
- Channels - Test Auto-Backup: manually trigger a backup to confirm your providers work.
- Wallet - Auto-Unlock: toggle whether LND unlocks automatically with a password stored on the server (an unlocked wallet is at risk if the server is stolen).
- Wallet - Manual Unlock: unlock a wallet whose auto-unlock is disabled.
- Wallet - Password: view / change the wallet password.
- Wallet - Password Backup: confirm you have the password saved.
- Aezeed Cipher Seed: display, confirm backup of, and delete the on-chain seed.
- Watchtower - Server / Client: configure watchtower under Actions > Security.
- A Security Status health check summarizes channels backup, wallet unlocking, seed, and watchtower status.`,
    es_ES: `LND se ha actualizado a 0.21.3-beta. Corrige la migración nativa a SQLite de facturas AMP, el agotamiento de recursos provocado por pares, un bloqueo de la financiación de canales que afectaba a todo el monedero, HTLC reenviados atascados, fallos en cierres cooperativos y errores críticos en WebSocket REST y en la paginación de transacciones. [Notas completas de la versión upstream](https://github.com/lightningnetwork/lnd/releases/tag/v0.21.3-beta)

Nuevo grupo Seguridad y la función de respaldo automático de canales:

- Canales - Respaldo automático: respalda channel.backup en SFTP, Dropbox, Nextcloud, Google Drive y/o por correo cuando un canal se abre o cierra.
- Canales - Probar respaldo automático: activa manualmente un respaldo para comprobar tus proveedores.
- Cartera - Desbloqueo automático: decide si LND se desbloquea automáticamente con una contraseña almacenada en el servidor.
- Cartera - Desbloqueo manual: desbloquea una cartera cuyo desbloqueo automático está desactivado.
- Cartera - Contraseña: consulta / cambia la contraseña de la cartera.
- Cartera - Respaldo de contraseña: confirma que has guardado la contraseña.
- Semilla Aezeed Cipher: muestra, confirma el respaldo y elimina la semilla on-chain.
- Watchtower - Server / Client: configura el watchtower en Acciones > Seguridad.
- El estado de Seguridad resume el respaldo de canales, el desbloqueo de la cartera, la semilla y el estado del watchtower.`,
    de_DE: `LND wurde auf 0.21.3-beta aktualisiert. Behebt die native SQLite-Migration für AMP-Rechnungen, durch Peers ausgelöste Ressourcenerschöpfung, eine walletweite Blockade der Kanalfinanzierung, festhängende weitergeleitete HTLCs, Fehler beim kooperativen Schließen sowie Abstürze bei REST-WebSockets und der Transaktionspaginierung. [Vollständige Upstream-Versionshinweise](https://github.com/lightningnetwork/lnd/releases/tag/v0.21.3-beta)

Neue Sicherheits-Gruppe und automatische Kanal-Sicherung:

- Kanäle - Auto-Backup: Sichert channel.backup per SFTP, Dropbox, Nextcloud, Google Drive und/oder E-Mail, sobald ein Kanal geöffnet oder geschlossen wird.
- Kanäle - Auto-Backup testen: Sicherung manuell auslösen, um die Anbieter zu prüfen.
- Wallet - Auto-Unlock: bestimmt, ob LND automatisch mit einem auf dem Server gespeicherten Passwort entsperrt wird.
- Wallet - Manual Unlock: entsperrt ein Wallet mit deaktiviertem Auto-Unlock.
- Wallet - Passwort: zeigt / ändert das Wallet-Passwort.
- Wallet - Passwort-Sicherung: bestätige, dass du das Passwort gesichert hast.
- Aezeed-Cipher-Seed: zeigt, bestätigt und löscht den On-Chain-Seed.
- Watchtower - Server / Client: konfiguriert den Watchtower unter Aktionen > Sicherheit.
- Der Sicherheitsstatus fasst Kanal-Sicherung, Wallet-Entsperrung, Seed- und Watchtower-Status zusammen.`,
    pl_PL: `Zaktualizowano LND do wersji 0.21.3-beta. Naprawiono natywną migrację SQLite dla faktur AMP, wyczerpywanie zasobów wywoływane przez peery, blokadę finansowania kanałów obejmującą cały portfel, zablokowane przekazywane HTLC, błędy przy kooperacyjnym zamykaniu kanałów oraz awarie WebSocket REST i stronicowania transakcji. [Pełne informacje o wydaniu upstream](https://github.com/lightningnetwork/lnd/releases/tag/v0.21.3-beta)

Nowa grupa Bezpieczeństwo oraz automatyczne tworzenie kopii zapasowych kanałów:

- Kanały - Auto-Backup: kopiuje channel.backup do SFTP, Dropbox, Nextcloud, Google Drive i/lub e-mailem za każdym razem, gdy kanał zostaje otwarty lub zamknięty.
- Kanały - Test auto backupu: ręczne wywołanie kopii, aby sprawdzić dostawców.
- Portfel - Automatyczne odblokowywanie: decyduje, czy LND automatycznie odblokowuje portfel zapisanym hasłem.
- Portfel - Ręczne odblokowywanie: odblokowuje portfel z wyłączonym auto-odblokiem.
- Portfel - Hasło: wyświetla / zmienia hasło portfela.
- Portfel - Kopia zapasowa hasła: potwierdź zapis hasła.
- Ziarno Aezeed Cipher: wyświetla, potwierdza kopię i usuwa ziarno on-chain.
- Watchtower - Server / Client: skonfiguruj watchtower w Działania > Bezpieczeństwo.
- Stan Bezpieczeństwa podsumowuje kopię kanałów, odblokowanie portfela, ziarno i stan watchtowera.`,
    fr_FR: `LND a été mis à jour vers la version 0.21.3-beta. Corrige la migration SQLite native des factures AMP, l'épuisement des ressources provoqué par des pairs, un blocage du financement des canaux affectant tout le portefeuille, des HTLC transférés bloqués, des échecs de fermeture coopérative ainsi que des plantages liés aux WebSockets REST et à la pagination des transactions. [Notes de version upstream complètes](https://github.com/lightningnetwork/lnd/releases/tag/v0.21.3-beta)

Nouveau groupe Sécurité et la fonction de sauvegarde automatique des canaux :

- Canaux - Sauvegarde auto : sauvegarde channel.backup vers SFTP, Dropbox, Nextcloud, Google Drive et/ou par e-mail à chaque ouverture/fermeture de canal.
- Canaux - Tester la sauvegarde auto : déclenche manuellement une sauvegarde pour vérifier vos fournisseurs.
- Portefeuille - Auto-déverrouillage : détermine si LND se déverrouille automatiquement avec un mot de passe stocké sur le serveur.
- Portefeuille - Déverrouillage manuel : déverrouille un portefeuille dont l'auto-déverrouillage est désactivé.
- Portefeuille - Mot de passe : visualise / change le mot de passe du portefeuille.
- Portefeuille - Sauvegarde du mot de passe : confirmez la sauvegarde du mot de passe.
- Graine Aezeed Cipher : affiche, confirme la sauvegarde et supprime la graine on-chain.
- Watchtower - Server / Client : configurez le watchtower sous Actions > Sécurité.
- Le Statut de sécurité résume la sauvegarde des canaux, le déverrouillage du portefeuille, la graine et l'état du watchtower.`,
  },
  migrations: {
    up: async () => {},
  },
})
