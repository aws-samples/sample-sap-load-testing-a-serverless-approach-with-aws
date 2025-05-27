# syntax=docker/dockerfile:1

FROM grafana/xk6:latest AS build
RUN go env -w GOPROXY=direct
RUN env GOOS=linux GOARCH=arm64

RUN env GOOS=linux GOARCH=arm64 xk6 build v1.0.0 \
    --with github.com/LeonAdato/xk6-output-statsd@latest \
    --with github.com/grafana/xk6-sql@latest \
    --with github.com/bersanf/xk6-sql-driver-hdb@latest


# Step 2: Create a lightweight image to run the k6 binary
FROM public.ecr.aws/amazonlinux/amazonlinux:latest

COPY entrypoint.sh /k6/entrypoint.sh

RUN yum upgrade -y && \ 
    yum install shadow-utils vim zip unzip findutils jq -y -q && \
    groupadd --gid 1000 k6 && \
    useradd --uid 1000 --gid k6 -m k6 && \
    usermod -aG wheel k6 && \
    chmod +x /k6/entrypoint.sh && \
    chown -R k6:k6 /k6 && \
    curl "https://awscli.amazonaws.com/awscli-exe-linux-aarch64.zip" -o "awscliv2.zip" && \
    unzip awscliv2.zip && \
    ./aws/install

# Set the working directory

# Copy the built k6 binary from the builder stage
COPY --from=build /xk6/k6 /usr/bin/k6

USER k6
WORKDIR /k6

# Set the entrypoint to k6
ENTRYPOINT ["/k6/entrypoint.sh"]
