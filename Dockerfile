FROM node:26-alpine

WORKDIR /app
ENV NODE_ENV=production PORT=8080 DATA_DIR=/data

COPY server.js web-adapter.js gym.html ./
RUN mkdir -p /data && chown -R node:node /data /app

USER node
EXPOSE 8080
VOLUME ["/data"]
HEALTHCHECK --interval=15s --timeout=3s --start-period=5s --retries=3 CMD node -e "fetch('http://127.0.0.1:8080/healthz').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"
CMD ["node", "server.js"]
