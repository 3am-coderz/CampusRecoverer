#!/bin/sh
set -e

BACKEND="${BACKEND_URL:-http://campus-recoverer-api:4000}"

# If protocol is missing, assume HTTP internal service on port 4000
case "$BACKEND" in
  http://*|https://*) ;;
  *) BACKEND="http://${BACKEND}:4000" ;;
esac

echo "Configuring Campus Recoverer Web proxy to backend: $BACKEND"

if echo "$BACKEND" | grep -q "^https://"; then
  # HTTPS external backend: extract host, enable SSL SNI and public resolver
  EXT_HOST=$(echo "$BACKEND" | sed -e 's|^https://||' -e 's|/.*$||' -e 's|:.*$||')
  cat <<EOF > /etc/nginx/conf.d/default.conf
server {
    listen 80;
    server_name localhost;

    location / {
        root /usr/share/nginx/html;
        index index.html index.htm;
        try_files \$uri \$uri/ /index.html;
    }

    location /api/ {
        resolver 1.1.1.1 8.8.8.8 valid=30s;
        set \$backend "$BACKEND";
        rewrite ^/api/?(.*) /\$1 break;
        proxy_pass \$backend;
        proxy_ssl_server_name on;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $EXT_HOST;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;
        proxy_cache_bypass \$http_upgrade;
    }
}
EOF
else
  # HTTP internal backend (e.g. Render private network or Docker Compose)
  cat <<EOF > /etc/nginx/conf.d/default.conf
server {
    listen 80;
    server_name localhost;

    location / {
        root /usr/share/nginx/html;
        index index.html index.htm;
        try_files \$uri \$uri/ /index.html;
    }

    location /api/ {
        rewrite ^/api/?(.*) /\$1 break;
        proxy_pass $BACKEND;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
    }
}
EOF
fi
