FROM grafana/k6:latest

USER root

RUN apk add --no-cache bash bind-tools coreutils curl gnuplot ttf-dejavu fontconfig iputils jq

COPY plot-scaling /usr/local/bin/plot-scaling
RUN chmod +x /usr/local/bin/plot-scaling

WORKDIR /workspace
