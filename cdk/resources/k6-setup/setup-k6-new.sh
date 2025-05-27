#!/usr/bin/env bash
set -e

TEMP_DIR=/opt/aws/k6
sudo yum install amazon-cloudwatch-agent golang tar -y
go env -w GOPROXY=direct
env GOOS=linux GOARCH=amd64
## install nodejs
# curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
# . ~/.nvm/nvm.sh
# nvm install 22

## install k6
go install go.k6.io/xk6/cmd/xk6@latest
# RUN go env -w GOPROXY=direct
# RUN env GOOS=linux GOARCH=arm64
sudo mv go/bin/xk6 /usr/local/bin/xk6
env GOOS=linux GOARCH=arm64 xk6 build v1.0.0 \
    --with github.com/LeonAdato/xk6-output-statsd@latest \
    --with github.com/grafana/xk6-sql@latest \
    --with github.com/bersanf/xk6-sql-driver-hdb@latest


