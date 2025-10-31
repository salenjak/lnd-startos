FROM lightninglabs/lnd:v0.19.3-beta
RUN apk add --no-cache inotify-tools jq rclone mutt bind-tools